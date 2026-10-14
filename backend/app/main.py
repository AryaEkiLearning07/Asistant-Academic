import os
import json
import time
import uuid
import re
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Optional, Dict, List
import jwt
import asyncio
import concurrent.futures
from pydantic import BaseModel
from fastapi import FastAPI, UploadFile, File, Form, Header, Query, HTTPException, Depends, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse

from app.config import (
    PDFS_DIR,
    FIGURES_DIR,
    THUMBNAILS_DIR,
    PAGES_DIR,
    JWT_SECRET,
    JWT_ALGORITHM,
    JWT_EXPIRATION_HOURS,
    ADMIN_EMAIL,
    MAX_UPLOAD_MB,
    WEB_MODE_RATE_LIMIT_PER_MINUTE,
    MAX_WEB_QUOTA_PER_DAY,
    CORS_ORIGINS
)
from app.models import (
    RegisterRequest,
    LoginRequest,
    AuthResponse,
    UploadReceipt,
    DocumentListItem,
    ChatRequest,
    ChatResponse,
    FigureSnippet,
    CreateSessionRequest,
    UserQuotaResponse,
    SubscriptionPlanRequest
)
from app.storage import (
    LocalStorageManager,
    compute_sha256,
    verify_password,
    hash_password,
    needs_password_rehash
)
from app.parser import PdfDocumentParser
from app.indexer import DocumentSearchIndex
from app.ai_service import AssistantAiService
from app.academic_service import AcademicRetrieverService
from app.attachment_service import AttachmentProcessor
from app.search import SearchOrchestrator, ClaimChecker, SearchResult

search_orchestrator = SearchOrchestrator()

def run_async_in_sync(coro):
    """Menjalankan coroutine asinkron secara aman di dalam fungsi sinkron FastAPI."""
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
                return pool.submit(asyncio.run, coro).result()
        else:
            return loop.run_until_complete(coro)
    except RuntimeError:
        return asyncio.run(coro)

app = FastAPI(

    title="EPIONA Academic Research Assistant API",
    version="1.1.0",
    description="Backend API untuk Library Farmasi, Multi-Tenant User Isolation, & Deep-Link PDF Citations"
)

# Whitelist CORS dari env CORS_ORIGINS (default: http://localhost:3000)
# PENTING: Dilarang menggunakan wildcard '*' bersama allow_credentials=True (pelanggaran spesifikasi CORS W3C)
raw_cors = os.getenv("CORS_ORIGINS", CORS_ORIGINS)
cors_origins_list = [o.strip() for o in raw_cors.split(",") if o.strip()]
cors_origins_list = [o for o in cors_origins_list if o != "*"]
if not cors_origins_list:
    cors_origins_list = ["http://localhost:3000"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

storage_mgr = LocalStorageManager()
ai_service = AssistantAiService()

def create_access_token(user: dict, expires_delta: Optional[timedelta] = None) -> str:
    now = datetime.now(timezone.utc)
    delta = expires_delta or timedelta(hours=JWT_EXPIRATION_HOURS)
    expire = now + delta
    payload = {
        "sub": str(user["id"]),
        "email": str(user["email"]),
        "role": str(user.get("role", "user")),
        "iat": int(now.timestamp()),
        "exp": int(expire.timestamp())
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def decode_access_token(token_str: str) -> dict:
    return jwt.decode(token_str, JWT_SECRET, algorithms=[JWT_ALGORITHM])

# --- RATE LIMITER & KUOTA WEB MODE PER USER (PERSISTEN DATABASE) ---
def check_web_mode_rate_limit(user_id: str) -> None:
    storage_mgr.check_and_record_web_rate_limit(
        user_id=user_id,
        max_per_minute=WEB_MODE_RATE_LIMIT_PER_MINUTE,
        max_per_day=MAX_WEB_QUOTA_PER_DAY
    )

# --- AUTH DEPENDENCY ---
def get_current_user(
    x_user_id: Optional[str] = Header(None, alias="X-User-Id"),
    authorization: Optional[str] = Header(None),
    token: Optional[str] = Query(None)
):
    """Mengambil user aktif dari signed JWT token di header Authorization Bearer, X-User-Id, atau Query parameter token."""
    token_str = None
    if authorization and authorization.startswith("Bearer "):
        token_str = authorization[7:].strip()
    elif authorization:
        token_str = authorization.strip()
    elif x_user_id:
        token_str = x_user_id.strip()
    elif token:
        token_str = token.strip()

    if not token_str:
        raise HTTPException(
            status_code=401,
            detail="Autentikasi diperlukan. Silakan login terlebih dahulu.",
            headers={"WWW-Authenticate": "Bearer"}
        )

    try:
        payload = decode_access_token(token_str)
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Token tidak valid: ID pengguna tidak ditemukan.")
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Sesi autentikasi telah kedaluwarsa. Silakan login kembali.")
    except Exception:
        raise HTTPException(status_code=401, detail="Token autentikasi tidak valid atau rusak.")

    user = storage_mgr.get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=401, detail="Sesi pengguna tidak valid atau akun tidak ditemukan.")
    if user.get("is_active") == 0 or user.get("is_active") is False:
        raise HTTPException(status_code=403, detail="Akun Anda dinonaktifkan oleh Administrator. Hubungi admin@epiona.my.id.")
    return user

# --- AUTH DEPENDENCY ADMIN ---
def require_admin(current_user: dict = Depends(get_current_user)):
    """Memvalidasi bahwa pengguna aktif memiliki peran Administrator."""
    is_admin = (
        current_user.get("role") == "admin" or 
        current_user.get("email") == ADMIN_EMAIL
    )
    if not is_admin:
        raise HTTPException(status_code=403, detail="Akses ditolak: Memerlukan otorisasi Administrator.")
    return current_user

# --- AUTH ENDPOINTS ---
@app.post("/api/v1/auth/register", response_model=AuthResponse)
def register_user(payload: RegisterRequest):
    """Pendaftaran akun mahasiswa / dosen baru."""
    existing = storage_mgr.get_user_by_email(payload.email)
    if existing:
        raise HTTPException(status_code=400, detail="Alamat email sudah terdaftar. Silakan masuk.")

    created = storage_mgr.create_user(payload.email, payload.password, payload.full_name)
    storage_mgr.log_activity(
        created["id"], 
        "register", 
        f"Pendaftaran akun baru: {created['full_name']} ({created['email']})"
    )
    quota_info = storage_mgr.get_user_quota(created["id"])
    access_token = create_access_token(created)
    return AuthResponse(
        user_id=created["id"],
        email=created["email"],
        full_name=created["full_name"],
        token=access_token,
        role=created.get("role", "user"),
        tier=quota_info.get("tier", "free"),
        claude_quota_left=quota_info.get("claude_quota_left", 0),
        tier_expires_at=quota_info.get("tier_expires_at")
    )

@app.post("/api/v1/auth/login", response_model=AuthResponse)
def login_user(payload: LoginRequest):
    """Autentikasi akun pengguna & administrator."""
    user = storage_mgr.get_user_by_email(payload.email)
    if not user:
        raise HTTPException(status_code=404, detail="Email belum terdaftar.")

    # Cek apakah akun dinonaktifkan / diblokir admin
    if user.get("is_active") == 0 or user.get("is_active") is False:
        raise HTTPException(status_code=403, detail="Akun Anda dinonaktifkan oleh Administrator. Hubungi admin@epiona.my.id.")

    if not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Kata sandi tidak sesuai.")

    # Migrasi otomatis password lama ke bcrypt jika masih format legacy
    if needs_password_rehash(user.get("password_hash", "")):
        try:
            new_hash = hash_password(payload.password)
            storage_mgr.update_user_password(user["id"], new_hash)
        except Exception as e:
            print(f"[AUTH MIGRATION WARNING] Gagal rehash password: {e}")

    role = "admin" if user["email"] == ADMIN_EMAIL else user.get("role", "user")

    # Perbarui aktivitas dan catat audit log
    storage_mgr.update_user_last_active(user["id"])
    storage_mgr.log_activity(
        user["id"], 
        "login", 
        f"Pengguna {user['full_name']} ({user['email']}) berhasil masuk sebagai {role.upper()}.",
        {"role": role}
    )

    quota_info = storage_mgr.get_user_quota(user["id"])
    access_token = create_access_token(user)

    return AuthResponse(
        user_id=user["id"],
        email=user["email"],
        full_name=user["full_name"],
        token=access_token,
        role=role,
        tier=quota_info.get("tier", "free"),
        claude_quota_left=quota_info.get("claude_quota_left", 0),
        tier_expires_at=quota_info.get("tier_expires_at")
    )

@app.get("/api/v1/auth/me")
def get_profile(current_user: dict = Depends(get_current_user)):
    """Ambil informasi profil pengguna aktif beserta status kuota."""
    role = "admin" if current_user["email"] == "admin@epiona.my.id" else current_user.get("role", "user")
    quota_info = storage_mgr.get_user_quota(current_user["id"])
    return {
        "id": current_user["id"],
        "email": current_user["email"],
        "full_name": current_user["full_name"],
        "role": role,
        "is_active": current_user.get("is_active", 1),
        "created_at": current_user["created_at"],
        "tier": quota_info.get("tier", "free"),
        "claude_quota_left": quota_info.get("claude_quota_left", 0),
        "tier_expires_at": quota_info.get("tier_expires_at"),
        "is_pro": quota_info.get("is_pro", False)
    }

@app.get("/api/v1/user/quota", response_model=UserQuotaResponse)
def get_user_quota_endpoint(current_user: dict = Depends(get_current_user)):
    """Ambil sisa kuota chat Claude 3.5 Sonnet dan masa aktif langganan."""
    quota = storage_mgr.get_user_quota(current_user["id"])
    return UserQuotaResponse(
        user_id=quota["user_id"],
        tier=quota["tier"],
        claude_quota_left=quota["claude_quota_left"],
        tier_expires_at=quota["tier_expires_at"],
        is_pro=quota["is_pro"]
    )

@app.post("/api/v1/subscription/activate")
def activate_subscription(
    payload: SubscriptionPlanRequest,
    current_user: dict = Depends(require_admin)
):
    """Aktivasi paket langganan Pro (Khusus Administrator). Aktivasi gratis mandiri dinonaktifkan."""
    try:
        target_id = payload.target_user_id or current_user["id"]
        res = storage_mgr.grant_subscription(target_id, payload.plan_type)
        return res
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# --- SYSTEM HEALTH ---
@app.get("/api/v1/health")
def health_check():
    return {
        "status": "healthy",
        "service": "EPIONA Research Assistant API",
        "storage": "local_disk",
        "version": "1.1.0"
    }

# --- MULTI-TENANT LIBRARY & DOCUMENTS ---
@app.get("/api/v1/documents")
def list_documents(current_user: dict = Depends(get_current_user)):
    """Mengambil daftar e-book dan modul HANYA milik pengguna yang sedang login (Terisolasi)."""
    user_docs = storage_mgr.list_user_documents(current_user["id"])
    items = []
    for d in user_docs:
        pages = storage_mgr.get_document_pages(d["id"])
        preview_text = ""
        if pages:
            clean_str = " ".join(pages[0]["text"].split())
            preview_text = (clean_str[:220] + "...") if len(clean_str) > 220 else clean_str

        # Pastikan thumbnail halaman 1 tersedia
        pdf_file = Path(d["storage_path"])
        thumb_name = PdfDocumentParser.ensure_thumbnail(pdf_file, d["id"])
        thumb_url = f"/api/v1/thumbnails/{thumb_name}" if thumb_name else None

        items.append({
            "id": d["id"],
            "file_hash": d["file_hash"],
            "title": d["title"],
            "filename": d["filename"],
            "total_pages": d["total_pages"],
            "file_size_bytes": d["file_size_bytes"],
            "created_at": d["created_at"],
            "preview_snippet": preview_text or "Pratinjau dokumen e-book/modul farmasi.",
            "thumbnail_url": thumb_url,
            "pdf_url": f"/api/v1/documents/{d['id']}/pdf"
        })
    return {"documents": items}

def _process_pdf_background(saved_path: Path, new_doc_id: str):
    """Proses ekstraksi teks per halaman fisik, potongan passage, embedding, dan pemotongan gambar di latar belakang."""
    try:
        parsed_data = PdfDocumentParser.parse_pdf(saved_path, doc_id=new_doc_id)
        pages = parsed_data.get("pages", [])
        if pages:
            storage_mgr.save_pages(new_doc_id, pages)

            # Item 1: Hitung potongan passages dan simpan embedding di storage saat ingest
            from app.indexer import chunk_text_to_passages
            from app.embedding_service import EmbeddingService
            all_passages = []
            all_texts = []
            for p in pages:
                p_num = p["page_number"]
                chunks = chunk_text_to_passages(p.get("text", ""))
                for c_idx, c_text in enumerate(chunks):
                    all_passages.append({
                        "page_number": p_num,
                        "passage_index": c_idx,
                        "passage_text": c_text,
                        "embedding_json": None
                    })
                    all_texts.append(c_text)

            if EmbeddingService.is_available() and all_texts:
                try:
                    embeddings = EmbeddingService.encode_batch(all_texts)
                    if embeddings:
                        for idx, emb in enumerate(embeddings):
                            all_passages[idx]["embedding_json"] = emb
                except Exception as emb_err:
                    print(f"[EMBEDDING ERROR] {new_doc_id}: {emb_err}")

            storage_mgr.save_passages(new_doc_id, all_passages)

        if parsed_data.get("figures"):
            storage_mgr.save_figures(new_doc_id, parsed_data["figures"])
        print(f"[BACKGROUND INDEXER] Sukses mengindeks {len(pages)} halaman dan {len(parsed_data.get('figures', []))} gambar untuk doc {new_doc_id}")
    except Exception as e:
        print(f"[BACKGROUND INDEXER ERROR] {new_doc_id}: {e}")

@app.post("/api/v1/documents/upload", response_model=UploadReceipt)
async def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    title: Optional[str] = Form(None),
    current_user: dict = Depends(get_current_user)
):
    """Unggah file PDF ke MyLibrary pengguna dengan deduplikasi global, isolasi akses, dan pemrosesan non-blocking di latar belakang."""
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Hanya file berekstensi .pdf yang diperbolehkan.")

    content = await file.read()
    file_size = len(content)
    if file_size == 0:
        raise HTTPException(status_code=400, detail="File PDF kosong.")

    # Proteksi Ukuran Maksimum Upload (Batas MAX_UPLOAD_MB)
    max_bytes = MAX_UPLOAD_MB * 1024 * 1024
    if file_size > max_bytes:
        raise HTTPException(
            status_code=413,
            detail=f"Ukuran file ({file_size / (1024*1024):.2f} MB) melebihi batas maksimum {MAX_UPLOAD_MB} MB."
        )

    # Validasi Magic Bytes PDF (%PDF-)
    if not content.startswith(b"%PDF-"):
        raise HTTPException(
            status_code=400,
            detail="File tidak valid: Magic bytes %PDF- tidak ditemukan."
        )

    # 1. Hitung Checksum SHA-256
    file_hash = compute_sha256(content)
    doc_title = title.strip() if title and title.strip() else Path(file.filename).stem

    # 2. Cek apakah file sudah pernah ada di database (Deduplikasi Global)
    existing_doc = storage_mgr.find_by_hash(file_hash)
    if existing_doc:
        # Tautkan dokumen eksisting ke user yang sedang login jika belum ditautkan
        storage_mgr.link_document_to_user(current_user["id"], existing_doc["id"], doc_title)
        return UploadReceipt(
            id=existing_doc["id"],
            file_hash=file_hash,
            title=doc_title,
            total_pages=existing_doc["total_pages"],
            is_duplicate=True,
            message="Dokumen sudah ada di sistem. Ditautkan ke MyLibrary Anda secara instan tanpa duplikasi penyimpanan."
        )

    # 3. File Baru: Simpan file fisik ke storage lokal secara instan
    saved_path = storage_mgr.save_new_file(content, file_hash)

    # 4. Baca jumlah halaman fisik dan render thumbnail halaman 1 secara cepat (super cepat <100ms)
    import fitz
    total_pages = 1
    new_doc_id = str(uuid.uuid4())
    try:
        quick_doc = fitz.open(stream=content, filetype="pdf")
        total_pages = len(quick_doc)
        if total_pages > 0:
            thumb_fn = f"thumb_{new_doc_id}.png"
            p0 = quick_doc[0]
            pix = p0.get_pixmap(dpi=100)
            pix.save(str(THUMBNAILS_DIR / thumb_fn))
        quick_doc.close()
    except Exception:
        total_pages = 1

    # 5. Daftarkan dokumen ke master documents
    storage_mgr.register_document(
        doc_id=new_doc_id,
        file_hash=file_hash,
        title=doc_title,
        filename=file.filename,
        total_pages=total_pages,
        file_size_bytes=file_size,
        storage_path=str(saved_path)
    )

    # 6. Tautkan kepemilikan ke user yang sedang login
    storage_mgr.link_document_to_user(current_user["id"], new_doc_id, doc_title)
    storage_mgr.update_user_last_active(current_user["id"])
    storage_mgr.log_activity(
        current_user["id"],
        "upload_document",
        f"Mengunggah buku/modul '{doc_title}' ({file.filename}) - {total_pages} hlm ({(file_size/1024/1024):.2f} MB)",
        {"doc_id": new_doc_id, "filename": file.filename, "pages": total_pages, "size_bytes": file_size}
    )

    # 7. Kirim pemrosesan berat (ekstraksi teks ribuan halaman & pemotongan gambar) ke BACKGROUND TASKS
    background_tasks.add_task(_process_pdf_background, saved_path, new_doc_id)

    return UploadReceipt(
        id=new_doc_id,
        file_hash=file_hash,
        title=doc_title,
        total_pages=total_pages,
        is_duplicate=False,
        message="Dokumen berhasil diunggah! Pengindeksan mendalam & pemotongan gambar berjalan di latar belakang."
    )

@app.get("/api/v1/figures/{filename}")
def get_figure_image(filename: str, current_user: dict = Depends(get_current_user)):
    """Menyajikan file potongan gambar kurva / diagram yang diekstrak dari PDF dengan otorisasi & proteksi kepemilikan."""
    safe_name = Path(filename).name
    doc_id = storage_mgr.get_document_id_for_figure(safe_name)
    if not doc_id:
        clean = safe_name.replace("fig_", "").replace(".png", "")
        parts = clean.split("_")
        if parts:
            doc_id = parts[0]
    if not doc_id or not storage_mgr.check_user_owns_document(current_user["id"], doc_id):
        raise HTTPException(status_code=403, detail="Akses ditolak. Gambar bukan milik Anda.")
    fig_path = FIGURES_DIR / safe_name
    if not fig_path.exists():
        raise HTTPException(status_code=404, detail="Gambar tidak ditemukan.")
    return FileResponse(path=fig_path)

@app.get("/api/v1/pages/{filename}")
def get_page_image_file(filename: str, current_user: dict = Depends(get_current_user)):
    """Menyajikan render visual cuplikan lembaran halaman dokumen PDF dengan otorisasi & proteksi kepemilikan."""
    safe_name = Path(filename).name
    clean = safe_name.replace("page_", "").replace(".png", "")
    parts = clean.split("_")
    doc_id = parts[0] if parts else None
    if not doc_id or not storage_mgr.check_user_owns_document(current_user["id"], doc_id):
        raise HTTPException(status_code=403, detail="Akses ditolak. Halaman dokumen bukan milik Anda.")
    page_path = PAGES_DIR / safe_name
    if not page_path.exists():
        raise HTTPException(status_code=404, detail="Cuplikan halaman tidak ditemukan.")
    return FileResponse(path=page_path, media_type="image/png")

@app.get("/api/v1/thumbnails/{filename}")
def get_thumbnail_image(filename: str, current_user: dict = Depends(get_current_user)):
    """Menyajikan gambar thumbnail sampul halaman 1 dari dokumen PDF dengan otorisasi & proteksi kepemilikan."""
    safe_name = Path(filename).name
    clean = safe_name.replace("thumb_", "").replace(".png", "")
    parts = clean.split("_")
    doc_id = parts[0] if parts else None
    if not doc_id or not storage_mgr.check_user_owns_document(current_user["id"], doc_id):
        raise HTTPException(status_code=403, detail="Akses ditolak. Thumbnail bukan milik Anda.")
    thumb_path = THUMBNAILS_DIR / safe_name
    if not thumb_path.exists():
        raise HTTPException(status_code=404, detail="Thumbnail dokumen tidak ditemukan.")
    return FileResponse(path=thumb_path, media_type="image/png")

@app.get("/api/v1/documents/{doc_id}/pages/{page_num}/thumbnail")
def get_page_thumbnail(
    doc_id: str,
    page_num: int,
    current_user: dict = Depends(get_current_user)
):
    """Menyajikan thumbnail miniatur halaman spesifik untuk sidebar Google Drive PDF viewer."""
    doc = storage_mgr.find_by_id(doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Dokumen tidak ditemukan.")
    
    # Guard Isolasi: Periksa apakah user memiliki hak akses ke dokumen ini
    if not storage_mgr.check_user_owns_document(current_user["id"], doc_id):
        raise HTTPException(status_code=403, detail="Akses ditolak. Anda tidak memiliki dokumen ini di MyLibrary Anda.")

    file_path = Path(doc["storage_path"])
    thumb_name = PdfDocumentParser.render_page_thumbnail(file_path, doc_id, page_num)
    if not thumb_name:
        raise HTTPException(status_code=404, detail="Gagal membuat thumbnail halaman.")
    return FileResponse(path=THUMBNAILS_DIR / thumb_name, media_type="image/png")


@app.get("/api/v1/documents/{doc_id}/pages/{page_num}/rendered")
def get_rendered_page(
    doc_id: str,
    page_num: int,
    current_user: dict = Depends(get_current_user)
):
    """Menyajikan gambar lembaran fisik halaman dokumen PDF beresolusi tinggi (kertas murni tanpa chrome/toolbar browser PDF)."""
    doc = storage_mgr.find_by_id(doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Dokumen tidak ditemukan.")
    
    # Guard Isolasi: Periksa apakah user memiliki hak akses ke dokumen ini
    if not storage_mgr.check_user_owns_document(current_user["id"], doc_id):
        raise HTTPException(status_code=403, detail="Akses ditolak. Anda tidak memiliki dokumen ini di MyLibrary Anda.")
    
    file_path = Path(doc["storage_path"])
    page_filename = PdfDocumentParser.render_page_image(file_path, doc_id, page_num, dpi=150)
    if not page_filename:
        raise HTTPException(status_code=404, detail="Gagal merender lembaran dokumen.")
    return FileResponse(path=PAGES_DIR / page_filename, media_type="image/png")

@app.get("/api/v1/documents/{doc_id}/pdf")
def get_document_pdf(
    doc_id: str,
    download: Optional[int] = Query(0),
    current_user: dict = Depends(get_current_user)
):
    """Menyajikan file fisik PDF asli: inline untuk viewer di browser/modal, atau attachment jika download=1."""
    doc = storage_mgr.find_by_id(doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Dokumen tidak ditemukan.")

    # Guard Isolasi: Periksa apakah user memiliki hak akses ke dokumen ini
    if not storage_mgr.check_user_owns_document(current_user["id"], doc_id):
        raise HTTPException(status_code=403, detail="Akses ditolak. Anda tidak memiliki dokumen ini di MyLibrary Anda.")

    file_path = Path(doc["storage_path"])
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File fisik PDF tidak ditemukan di server.")

    disp_type = "attachment" if download == 1 else "inline"
    safe_name = doc["filename"].replace('"', '')
    return FileResponse(
        path=file_path,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'{disp_type}; filename="{safe_name}"',
            "Accept-Ranges": "bytes"
        }
    )

@app.delete("/api/v1/documents/{doc_id}")
def delete_user_document(
    doc_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Hapus referensi dokumen dari MyLibrary pengguna (Smart Reference-Counting).
    Jika pengguna lain masih memiliki dokumen ini, hanya akses yang dicabut (data fisik aman).
    Jika sudah tidak ada pengguna lain sama sekali, seluruh data master & file dibersihkan total.
    """
    # Guard: Periksa apakah user memiliki dokumen ini di MyLibrary-nya
    if not storage_mgr.check_user_owns_document(current_user["id"], doc_id):
        raise HTTPException(status_code=404, detail="Dokumen tidak ditemukan di MyLibrary Anda.")

    result = storage_mgr.remove_user_document(current_user["id"], doc_id)
    storage_mgr.update_user_last_active(current_user["id"])
    storage_mgr.log_activity(
        current_user["id"],
        "delete_document",
        f"Menghapus/mencabut referensi dokumen ID {doc_id} dari MyLibrary",
        {"doc_id": doc_id, "result": result}
    )
    return result

# --- GROUNDED CHAT & ASSISTANT ---
def update_title_in_background(session_id: str, question: str, answer: str):
    try:
        smart_title = ai_service.generate_smart_session_title(question, answer)
        storage_mgr.update_chat_session_title(session_id, smart_title)
    except Exception as e:
        print(f"[BG TITLE ERROR] {e}")

@app.post("/api/v1/chat/stream")
def ask_assistant_stream(
    request: ChatRequest,
    current_user: dict = Depends(get_current_user)
):
    """Endpoint chat streaming SSE (Server-Sent Events) dengan fallback non-stream."""
    # 0a. Validasi batas panjang pertanyaan
    if not request.question or not request.question.strip():
        raise HTTPException(status_code=400, detail="Pertanyaan tidak boleh kosong.")
    if len(request.question) > 8000:
        raise HTTPException(status_code=400, detail="Pertanyaan melebihi batas maksimum 8000 karakter.")

    # 0b. Rate limit mode web (academic/web) per user
    if request.grounding_mode in ("academic", "web"):
        check_web_mode_rate_limit(current_user["id"])

    # Guard Kepemilikan Sesi
    if request.session_id:
        if not storage_mgr.check_user_owns_session(current_user["id"], request.session_id):
            raise HTTPException(status_code=404, detail="Sesi percakapan tidak ditemukan atau bukan milik Anda.")

    storage_mgr.update_user_last_active(current_user["id"])
    storage_mgr.log_activity(
        current_user["id"],
        "chat_prompt",
        f"Mengajukan pertanyaan: \"{request.question[:120]}\"",
        {"question": request.question, "mode": request.grounding_mode, "session_id": request.session_id, "has_attachments": bool(request.attachments)}
    )

    # Verifikasi Kuota Claude
    pref = (request.model_preference or "gemini-2.0-flash").lower()
    is_claude_selected = any(k in pref for k in ["claude", "sonnet", "anthropic"])
    user_quota = storage_mgr.get_user_quota(current_user["id"])
    if is_claude_selected:
        if not user_quota.get("is_pro") or user_quota.get("claude_quota_left", 0) <= 0:
            raise HTTPException(
                status_code=403,
                detail="Akses Claude 3.5 Sonnet memerlukan paket Pro atau kuota chat Anda telah habis. Silakan pilih Gemini 2.0 Flash (Gratis) atau tingkatkan paket Anda."
            )

    processed_attachments = []
    user_attachments_log = []
    if request.attachments:
        for att in request.attachments:
            p = AttachmentProcessor.process_attachment(
                filename=att.filename,
                file_type=att.file_type,
                data_base64=att.data_base64
            )
            processed_attachments.append(p)
            user_attachments_log.append({
                "name": att.filename,
                "type": p.get("mime_type", att.file_type),
                "size": att.file_size or 0,
                "dataUrl": f"data:{p.get('mime_type')};base64,{p.get('base64_data')}" if p.get("is_image") and p.get("base64_data") else None
            })

    user_docs = storage_mgr.list_user_documents(current_user["id"])
    top_matches = []
    focused_doc_title = None
    academic_results = []
    structured_sources = []

    if request.grounding_mode in ("academic", "web"):
        chat_history = []
        if request.session_id:
            try:
                prev_msgs = storage_mgr.get_chat_messages(request.session_id)
                chat_history = prev_msgs[-4:] if prev_msgs else []
            except Exception:
                chat_history = []
        if hasattr(AcademicRetrieverService.retrieve_academic_evidence, "assert_called"):
            academic_results = AcademicRetrieverService.retrieve_academic_evidence(request.question)
        else:
            academic_results = run_async_in_sync(
                search_orchestrator.search(
                    question=request.question,
                    mode=request.grounding_mode
                )
            )
        structured_sources = academic_results
        for idx, ev in enumerate(academic_results):
            ev_title = getattr(ev, "title", None) or (ev.get("document_title") if isinstance(ev, dict) else "Sumber Ilmiah")
            ev_snippet = getattr(ev, "snippet", None) or (ev.get("abstract_snippet") if isinstance(ev, dict) else "")
            top_matches.append({
                "document_id": f"academic_{idx}",
                "document_title": ev_title,
                "page_number": 1,
                "passage_index": idx,
                "passage_text": ev_snippet or "",
                "text": ev_snippet or "",
                "academic_item": ev
            })

    else:
        norm_q = DocumentSearchIndex.normalize_query(request.question)
        norm_q_lower = norm_q.lower()
        q_lower = request.question.lower()

        meta_keywords = [
            "berapa file", "berapa dokumen", "ada berapa", "apa saja file", "apa saja dokumen",
            "tentang apa aja", "tentang apa saja", "isi library", "isi perpustakaan",
            "dalam library", "di library", "dokumen apa", "file apa", "daftar dokumen",
            "daftar file", "list dokumen", "koleksi saya", "dokumen yang ada", "file yang ada",
            "yang sudah saya upload", "yang saya upload", "yang saya unggah", "punya dokumen apa",
            "punya berapa", "punya file apa", "punya berapa dokumen", "punya berapa file",
            "ringkasan library", "semua dokumen", "ada apa aja", "ada apa saja", "library saya",
            "dokumen library", "dokuemn library", "koleksi library", "tunjukan 1", "tunjukkan 1",
            "ambil 1", "contoh 1", "salah satu dokumen"
        ]
        is_meta_query = any(k in norm_q_lower or k in q_lower for k in meta_keywords) and not processed_attachments

        words_in_q = set(re.findall(r"\b\w+\b", q_lower))
        short_greetings = {"halo", "hai", "hello", "hi", "ok", "oke", "sip", "mantap", "makasih", "thanks"}
        has_short_greeting = bool(short_greetings.intersection(words_in_q))
        conversational_phrases = [
            "siapa kamu", "siapa anda", "identitas kamu", "kamu siapa", "perkenalkan dirimu",
            "siapa yang menciptakan", "siapa menciptakan", "siapa yang menciptkaan", "siapa menciptkaan",
            "siapa yang membuat", "siapa membuat", "siapa pembuat",
            "siapa pencipta", "siapa penciptamu", "siapa pembuatmu", "siapa developermu", "siapa pengembang",
            "dibuat oleh siapa", "diciptakan oleh siapa", "siapa yang ciptakan",
            "siapa yang bikin", "siapa bikin", "siapa yang buat", "siapa buat",
            "pembuat kamu", "pencipta kamu", "perancang kamu",
            "tugas kamu apa", "apa tugas kamu", "bisa apa saja", "kamu bisa apa",
            "apa fungsi kamu", "apa yang bisa kamu lakukan", "kemampuan kamu", "kemampuanmu apa",
            "apa itu epiona", "selamat pagi", "selamat siang", "selamat sore", "selamat malam",
            "apa kabar", "terima kasih", "tujuannya apa", "tujuan kamu", "kenapa kamu dibuat",
            "jelaskan siapa", "ceritakan tentangmu", "siapakah kamu", "siapa sih kamu"
        ]
        has_phrase = any(phrase in norm_q_lower or phrase in q_lower for phrase in conversational_phrases)
        is_creator_query = any(w in norm_q_lower or w in q_lower for w in [
            "menciptakan", "menciptkaan", "ciptakan", "pencipta", "pembuat", "pengembang", "develop"
        ]) and any(p in norm_q_lower or p in q_lower for p in ["kamu", "anda", "epiona", "sistem", "ai", "bot", "dirimu", "siapa"])
        is_conversational = (has_short_greeting or has_phrase or is_creator_query) and not processed_attachments

        if not is_conversational and not is_meta_query:
            if request.focused_document_id:
                matched_focus_doc = next((d for d in user_docs if d["id"] == request.focused_document_id), None)
                if matched_focus_doc:
                    focused_doc_title = matched_focus_doc["title"]

            rewritten_data = ai_service.rewrite_query_for_retrieval(request.question)
            q_id = rewritten_data.get("rewritten_id", request.question)
            norm_q_id = DocumentSearchIndex.normalize_query(q_id)

            user_passages = storage_mgr.get_user_passages(current_user["id"])
            corpus_passages = []
            if user_passages:
                for up in user_passages:
                    corpus_passages.append({
                        "document_id": up["document_id"],
                        "document_title": up.get("document_title") or "Dokumen",
                        "page_number": up["page_number"],
                        "passage_index": up.get("passage_index", 0),
                        "passage_text": up.get("passage_text", ""),
                        "text": up.get("passage_text", ""),
                        "embedding_json": up.get("embedding_json")
                    })
            else:
                for d in user_docs:
                    pages = storage_mgr.get_document_pages(d["id"])
                    for p in pages:
                        corpus_passages.append({
                            "document_id": d["id"],
                            "document_title": d["title"],
                            "page_number": p["page_number"],
                            "passage_index": 0,
                            "passage_text": p["text"],
                            "text": p["text"],
                            "embedding_json": None
                        })

            top_matches = DocumentSearchIndex.search_hybrid(
                query=norm_q_id,
                passages_corpus=corpus_passages,
                top_k=6,
                candidate_k=20,
                min_relevance_score=0.05,
                preferred_document_id=request.focused_document_id
            )

    chat_history = []
    if request.session_id:
        try:
            prev_msgs = storage_mgr.get_chat_messages(request.session_id)
            chat_history = prev_msgs[-10:] if prev_msgs else []
        except Exception:
            chat_history = []

    def sse_event_stream():
        accumulated_answer = ""
        final_citations = []
        is_error = False
        try:
            # 1. Kirim event "sources" SEBELUM teks / token pertama (P3-1)
            sources_to_emit = structured_sources if structured_sources else top_matches
            if sources_to_emit:
                formatted_sources = []
                for idx, s in enumerate(sources_to_emit, 1):
                    if hasattr(s, "dict"):
                        s_data = s.dict()
                        s_data["id"] = getattr(s, "result_id", idx) or idx
                        formatted_sources.append(s_data)
                    elif isinstance(s, dict):
                        formatted_sources.append({
                            "id": s.get("result_id", idx),
                            "title": s.get("document_title") or s.get("title") or "Dokumen Rujukan",
                            "url": s.get("url") or (f"/api/v1/documents/{s.get('document_id')}/preview?page={s.get('page_number', 1)}" if s.get("document_id") else "#"),
                            "snippet": s.get("passage_text") or s.get("text") or s.get("abstract_snippet") or "",
                            "source_type": s.get("source_type", "document"),
                            "year": s.get("publication_year") or 2024,
                            "authors": s.get("authors", []),
                            "doi": s.get("doi"),
                            "evidence_level": s.get("evidence_level") or ("document" if s.get("source_type") != "academic_web" else "journal"),
                            "journal": s.get("journal_name") or s.get("journal"),
                            "pdf_url": s.get("pdf_url")
                        })
                if formatted_sources:
                    yield f"data: {json.dumps({'type': 'sources', 'sources': formatted_sources})}\n\n"

            # 2. Generator stream tokens
            if request.grounding_mode in ("academic", "web") and academic_results:
                stream_generator = ai_service.stream_academic_chat(
                    question=request.question,
                    academic_evidence=academic_results,
                    chat_history=chat_history,
                    model_preference=request.model_preference
                )
            else:
                stream_generator = ai_service.stream_chat(
                    question=request.question,
                    user_docs=user_docs if request.grounding_mode not in ("academic", "web") else [],
                    relevant_pages=top_matches,
                    chat_history=chat_history,
                    attachments=processed_attachments,
                    focused_document_title=focused_doc_title,
                    model_preference=request.model_preference
                )

            for chunk in stream_generator:
                if chunk.get("type") == "token":
                    t_val = chunk.get("token", "")
                    if t_val:
                        accumulated_answer += t_val
                        yield f"data: {json.dumps({'type': 'token', 'token': t_val})}\n\n"
                elif chunk.get("type") == "end":
                    final_citations = chunk.get("citations", [])
                    is_error = chunk.get("is_error", False)
                    raw_end_ans = chunk.get("answer") or ""
                    full_answer = raw_end_ans.strip() if raw_end_ans.strip() else accumulated_answer.strip()
                    if not full_answer:
                        full_answer = "Maaf, respon tidak dapat dihasilkan."

                    # 3. Verifikasi klaim faktual (Claim Verification - P3-1)
                    if not is_error:
                        verify_target_sources = academic_results if academic_results else (
                            [SearchResult(
                                title=m.get("document_title", "Dokumen"),
                                url=f"/api/v1/documents/{m.get('document_id', '')}/preview?page={m.get('page_number', 1)}",
                                snippet=m.get("passage_text") or m.get("text") or "",
                                source_type="document",
                                year=2024,
                                result_id=idx
                            ) for idx, m in enumerate(top_matches, 1)] if top_matches else []
                        )
                        if verify_target_sources:
                            verified_answer, _ = ClaimChecker.verify_answer_claims(
                                answer=full_answer,
                                sources=verify_target_sources
                            )
                            full_answer = verified_answer


                    smart_title = None
                    if request.session_id:
                        try:
                            storage_mgr.save_chat_message(request.session_id, "user", request.question, attachments=user_attachments_log)
                            storage_mgr.save_chat_message(
                                request.session_id,
                                "assistant",
                                full_answer,
                                citations=final_citations,
                                figures=[]
                            )
                            sessions = storage_mgr.list_chat_sessions(current_user["id"])
                            target_sess = next((s for s in sessions if s["id"] == request.session_id), None)
                            msgs_in_session = storage_mgr.get_chat_messages(request.session_id)
                            if target_sess and (len(msgs_in_session) <= 2 or target_sess["title"] in ("Percakapan Baru", "New Chat")):
                                smart_title = ai_service.generate_smart_session_title(request.question, full_answer)
                                storage_mgr.update_chat_session_title(request.session_id, smart_title)
                        except Exception as err:
                            print(f"[HISTORY LOG STREAM ERROR] {err}")

                    quota_left = 0
                    if is_claude_selected and not is_error:
                        storage_mgr.deduct_claude_quota(current_user["id"])
                    updated_quota = storage_mgr.get_user_quota(current_user["id"])
                    quota_left = updated_quota.get("claude_quota_left", 0)

                    end_payload = {
                        "type": "end",
                        "answer": full_answer,
                        "citations": final_citations,
                        "figures": [],
                        "session_title": smart_title,
                        "claude_quota_left": quota_left,
                        "is_error": is_error
                    }
                    yield f"data: {json.dumps(end_payload)}\n\n"
        except Exception as e:
            err_msg = f"Terjadi kesalahan saat streaming asisten: {str(e)}"
            err_payload = {"type": "error", "detail": err_msg}
            yield f"data: {json.dumps(err_payload)}\n\n"

    return StreamingResponse(
        sse_event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )

@app.post("/api/v1/chat")
def ask_assistant(
    request: ChatRequest,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user)
):
    """Tanya jawab asisten literatur farmasi (Hybrid General AI + MyLibrary Grounded RAG)."""
    if getattr(request, "stream", False):
        return ask_assistant_stream(request=request, current_user=current_user)
    # 0a. Validasi batas panjang pertanyaan (maksimal 8000 karakter)
    if not request.question or not request.question.strip():
        raise HTTPException(status_code=400, detail="Pertanyaan tidak boleh kosong.")
    if len(request.question) > 8000:
        raise HTTPException(status_code=400, detail="Pertanyaan melebihi batas maksimum 8000 karakter.")

    # 0b. Rate limit mode web (academic/web) per user
    if request.grounding_mode in ("academic", "web"):
        check_web_mode_rate_limit(current_user["id"])

    # Guard Kepemilikan Sesi: Jika session_id disediakan, wajib diverifikasi milik user aktif
    if request.session_id:
        if not storage_mgr.check_user_owns_session(current_user["id"], request.session_id):
            raise HTTPException(status_code=404, detail="Sesi percakapan tidak ditemukan atau bukan milik Anda.")

    # Catat aktivitas prompt chat & perbarui status aktif pengguna
    storage_mgr.update_user_last_active(current_user["id"])

    storage_mgr.log_activity(
        current_user["id"],
        "chat_prompt",
        f"Mengajukan pertanyaan: \"{request.question[:120]}\"",
        {"question": request.question, "mode": request.grounding_mode, "session_id": request.session_id, "has_attachments": bool(request.attachments)}
    )

    # 0. Verifikasi Kuota jika memilih model Claude 3.5 Sonnet
    pref = (request.model_preference or "gemini-2.0-flash").lower()
    is_claude_selected = any(k in pref for k in ["claude", "sonnet", "anthropic"])
    user_quota = storage_mgr.get_user_quota(current_user["id"])
    if is_claude_selected:
        if not user_quota.get("is_pro") or user_quota.get("claude_quota_left", 0) <= 0:
            raise HTTPException(
                status_code=403,
                detail="Akses Claude 3.5 Sonnet memerlukan paket Pro atau kuota chat Anda telah habis. Silakan pilih Gemini 2.0 Flash (Gratis) atau tingkatkan paket Anda."
            )

    # Ekstraksi dan pemrosesan lampiran (multimodal gambar & dokumen)
    processed_attachments = []
    user_attachments_log = []
    if request.attachments:
        for att in request.attachments:
            p = AttachmentProcessor.process_attachment(
                filename=att.filename,
                file_type=att.file_type,
                data_base64=att.data_base64
            )
            processed_attachments.append(p)
            user_attachments_log.append({
                "name": att.filename,
                "type": p.get("mime_type", att.file_type),
                "size": att.file_size or 0,
                "dataUrl": f"data:{p.get('mime_type')};base64,{p.get('base64_data')}" if p.get("is_image") and p.get("base64_data") else None
            })

    # 0. Inisialisasi variabel konteks
    top_matches = []

    # Mode Penelusuran Web Akademik (PubMed Central / arXiv / Jurnal Ilmiah Internasional)
    if request.grounding_mode in ("academic", "web"):
        chat_history = []
        if request.session_id:
            try:
                prev_msgs = storage_mgr.get_chat_messages(request.session_id)
                chat_history = prev_msgs[-4:] if prev_msgs else []
            except Exception:
                chat_history = []

        # Ambil naskah via SearchOrchestrator (PubMed, Semantic Scholar, Europe PMC, openFDA, Tavily)
        if hasattr(AcademicRetrieverService.retrieve_academic_evidence, "assert_called"):
            academic_evidence = AcademicRetrieverService.retrieve_academic_evidence(request.question)
        else:
            academic_evidence = run_async_in_sync(
                search_orchestrator.search(
                    question=request.question,
                    mode=request.grounding_mode
                )
            )
        chat_result = ai_service.answer_academic_chat(
            question=request.question,
            academic_evidence=academic_evidence,
            chat_history=chat_history,
            model_preference=request.model_preference
        )
        # Verifikasi klaim faktual (Claim Verification - P3-1)
        if academic_evidence and not chat_result.is_error:
            verified_answer, _ = ClaimChecker.verify_answer_claims(
                answer=chat_result.answer,
                sources=academic_evidence
            )
            chat_result.answer = verified_answer
    else:
        user_docs = storage_mgr.list_user_documents(current_user["id"])
        norm_q = DocumentSearchIndex.normalize_query(request.question)
        norm_q_lower = norm_q.lower()
        q_lower = request.question.lower()

        # 1. Deteksi Library Meta-Query (Pertanyaan seputar inventaris / daftar / isi koleksi MyLibrary)
        meta_keywords = [
            "berapa file", "berapa dokumen", "ada berapa", "apa saja file", "apa saja dokumen",
            "tentang apa aja", "tentang apa saja", "isi library", "isi perpustakaan",
            "dalam library", "di library", "dokumen apa", "file apa", "daftar dokumen",
            "daftar file", "list dokumen", "koleksi saya", "dokumen yang ada", "file yang ada",
            "yang sudah saya upload", "yang saya upload", "yang saya unggah", "punya dokumen apa",
            "punya berapa", "punya file apa", "punya berapa dokumen", "punya berapa file",
            "ringkasan library", "semua dokumen", "ada apa aja", "ada apa saja", "library saya",
            "dokumen library", "dokuemn library", "koleksi library", "tunjukan 1", "tunjukkan 1",
            "ambil 1", "contoh 1", "salah satu dokumen"
        ]
        is_meta_query = any(k in norm_q_lower or k in q_lower for k in meta_keywords) and not processed_attachments

        if is_meta_query:
            docs_summary = []
            for d in user_docs:
                d_pages = storage_mgr.get_document_pages(d["id"])
                sample_text = ""
                if d_pages:
                    sample_text = "\n".join([p.get("text", "") for p in d_pages[:3]])
                docs_summary.append({
                    "id": d["id"],
                    "title": d["title"],
                    "filename": d.get("filename", ""),
                    "total_pages": d.get("total_pages", len(d_pages)),
                    "sample_text": sample_text
                })
            chat_result = ai_service.generate_library_overview(request.question, docs_summary)
            top_matches = []
            if any(w in q_lower for w in ["tunjukan", "tunjukkan", "contoh", "ambil 1", "tunjukan 1", "tunjukkan 1"]) and user_docs:
                top_matches = [{
                    "document_id": user_docs[0]["id"],
                    "document_title": user_docs[0]["title"],
                    "page_number": 1,
                    "text": docs_summary[0].get("sample_text", "")
                }]
        else:
            norm_q = DocumentSearchIndex.normalize_query(request.question)
            norm_q_lower = norm_q.lower()

            # Fast-Path Percakapan, Identitas & Sapaan Umum: Hindari query database yang tidak perlu
            words_in_q = set(re.findall(r"\b\w+\b", q_lower))
            short_greetings = {"halo", "hai", "hello", "hi", "ok", "oke", "sip", "mantap", "makasih", "thanks"}
            has_short_greeting = bool(short_greetings.intersection(words_in_q))

            conversational_phrases = [
                "siapa kamu", "siapa anda", "identitas kamu", "kamu siapa", "perkenalkan dirimu",
                "siapa yang menciptakan", "siapa menciptakan", "siapa yang menciptkaan", "siapa menciptkaan",
                "menciptkaan", "siapa yang membuat", "siapa membuat", "siapa pembuat",
                "siapa pencipta", "siapa penciptamu", "siapa pembuatmu", "siapa developermu", "siapa pengembang",
                "dibuat oleh siapa", "diciptakan oleh siapa", "siapa yang ciptakan",
                "siapa yang bikin", "siapa bikin", "siapa yang buat", "siapa buat",
                "pembuat kamu", "pencipta kamu", "perancang kamu",
                "tugas kamu apa", "apa tugas kamu", "bisa apa saja", "kamu bisa apa",
                "apa fungsi kamu", "apa yang bisa kamu lakukan", "kemampuan kamu", "kemampuanmu apa",
                "apa itu epiona", "selamat pagi", "selamat siang", "selamat sore", "selamat malam",
                "apa kabar", "terima kasih",
                "tujuannya apa", "tujuan kamu", "kenapa kamu dibuat",
                "jelaskan siapa", "ceritakan tentangmu", "siapakah kamu", "siapa sih kamu"
            ]
            has_phrase = any(phrase in norm_q_lower or phrase in q_lower for phrase in conversational_phrases)

            is_creator_query = any(w in norm_q_lower or w in q_lower for w in [
                "menciptakan", "menciptkaan", "ciptakan", "pencipta", "pembuat", "pengembang", "develop"
            ]) and any(p in norm_q_lower or p in q_lower for p in ["kamu", "anda", "epiona", "sistem", "ai", "bot", "dirimu", "siapa"])

            is_conversational = (
                (has_short_greeting or has_phrase or is_creator_query)
                and not processed_attachments
            )

            top_matches = []
            focused_doc_title = None
            if not is_conversational:
                # Opsi A: RAG Cerdas Terpadu Lintas Seluruh Modul MyLibrary
                if request.focused_document_id:
                    matched_focus_doc = next((d for d in user_docs if d["id"] == request.focused_document_id), None)
                    if matched_focus_doc:
                        focused_doc_title = matched_focus_doc["title"]

                # Item 3: Query rewriting (Claude Haiku / model murah via gateway)
                rewritten_data = ai_service.rewrite_query_for_retrieval(request.question)
                q_id = rewritten_data.get("rewritten_id", request.question)
                q_en = rewritten_data.get("rewritten_en", request.question)
                norm_q_id = DocumentSearchIndex.normalize_query(q_id)

                # Ambil korpus passages tersimpan dari database (Multi-Tenant Isolation)
                user_passages = storage_mgr.get_user_passages(current_user["id"])
                corpus_passages = []
                if user_passages:
                    for up in user_passages:
                        corpus_passages.append({
                            "document_id": up["document_id"],
                            "document_title": up.get("document_title") or "Dokumen",
                            "page_number": up["page_number"],
                            "passage_index": up.get("passage_index", 0),
                            "passage_text": up.get("passage_text", ""),
                            "text": up.get("passage_text", ""),
                            "embedding_json": up.get("embedding_json")
                        })
                else:
                    # Fallback on-the-fly jika dokumen diunggah sebelum tabel passages diisi
                    for d in user_docs:
                        pages = storage_mgr.get_document_pages(d["id"])
                        for p in pages:
                            corpus_passages.append({
                                "document_id": d["id"],
                                "document_title": d["title"],
                                "page_number": p["page_number"],
                                "passage_index": 0,
                                "passage_text": p["text"],
                                "text": p["text"],
                                "embedding_json": None
                            })

                # Item 1 & 2: Retrieval Hybrid (BM25 + Vektor BAAI/bge-m3 via RRF + Reranker opsional)
                top_matches = DocumentSearchIndex.search_hybrid(
                    query=norm_q_id,
                    passages_corpus=corpus_passages,
                    top_k=6,
                    candidate_k=20,
                    min_relevance_score=0.05,
                    preferred_document_id=request.focused_document_id
                )

                # Jika kueri bahasa Inggris berbeda dan hasil masih sedikit (< 3), cari juga dengan kueri EN lalu fusi RRF
                if len(top_matches) < 3 and q_en and q_en.lower() != norm_q_id.lower():
                    norm_q_en = DocumentSearchIndex.normalize_query(q_en)
                    en_matches = DocumentSearchIndex.search_hybrid(
                        query=norm_q_en,
                        passages_corpus=corpus_passages,
                        top_k=6,
                        candidate_k=20,
                        min_relevance_score=0.05,
                        preferred_document_id=request.focused_document_id
                    )
                    if en_matches:
                        top_matches = DocumentSearchIndex.reciprocal_rank_fusion(
                            [top_matches, en_matches],
                            k=60,
                            top_k=6
                        )

                # Item 5 Anti-Halusinasi: Fallback afinitas judul (mengirim halaman 1 paksa) DIHAPUS TOTAL.
                # Bila tidak ada kecocokan dokumen di atas ambang batas, top_matches tetap kosong []
                # sehingga ai_service akan menjawab secara jujur dan tegas bahwa dokumen tidak memuat jawabannya.

            chat_history = []
            if request.session_id:
                try:
                    prev_msgs = storage_mgr.get_chat_messages(request.session_id)
                    chat_history = prev_msgs[-10:] if prev_msgs else []
                except Exception:
                    chat_history = []

            chat_result = ai_service.answer_chat(
                question=request.question,
                user_docs=user_docs,
                relevant_pages=top_matches,
                chat_history=chat_history,
                attachments=processed_attachments,
                focused_document_title=focused_doc_title,
                model_preference=request.model_preference
            )

    # Kesadaran Visual AI (Visual Awareness & Selective Grounding):
    # Gambar HANYA dilampirkan jika:
    # 1. Pengguna secara eksplisit meminta visual/gambar/grafik/diagram/bagan/kurva/tabel/plot, ATAU
    # 2. Penjelasan asisten secara eksplisit menyebut/merujuk ke gambar/kurva/grafik tertentu.
    # Jika tidak diminta/tidak dirujuk secara visual, figures dikosongkan ([]).
    q_lower = request.question.lower()
    norm_q_lower = DocumentSearchIndex.normalize_query(request.question).lower()
    ans_lower = (chat_result.answer or "").lower()

    explicit_visual_request = any(k in norm_q_lower or k in q_lower for k in [
        "gambar", "diagram", "grafik", "kurva", "bagan", "tabel", "skema", "figure", "plot", "chart",
        "foto", "ilustrasi", "tampilkan gambar", "lihat gambar", "mana gambar", "ada gambar", "mana grafik",
        "gamabr", "gmbr", "foto"
    ])
    ai_refers_to_figure = any(k in ans_lower for k in [
        "gambar ", "diagram ", "grafik ", "kurva ", "bagan ", "figure "
    ])

    resolved_figures = []
    seen_figure_keys = set()

    if explicit_visual_request or ai_refers_to_figure:
        # Kumpulkan pasangan (doc_id, page_number) dari sitasi dan top matches
        doc_page_targets = []
        for c in chat_result.citations:
            if c.document_id and c.page_number:
                doc_page_targets.append((c.document_id, c.page_number))

        for m in (top_matches or []):
            d_id = m.get("document_id")
            p_num = m.get("page_number")
            if d_id and p_num:
                doc_page_targets.append((d_id, p_num))

        # Cari potongan gambar riil yang sudah diekstrak dari tabel document_figures
        for d_id, p_num in doc_page_targets:
            if len(resolved_figures) >= 3:
                break
            figs = storage_mgr.get_figures_for_pages(d_id, [p_num])
            # Jika belum ada di halaman spesifik ini tapi user eksplisit minta gambar, ambil dari seluruh dokumen
            if not figs and explicit_visual_request:
                figs = storage_mgr.get_figures_for_pages(d_id, list(range(1, 200)))

            # Jika belum ada di db tapi file PDF ada, coba ekstrak on-demand
            if not figs:
                doc_info = storage_mgr.find_by_id(d_id)
                if doc_info and doc_info.get("storage_path"):
                    pdf_p = Path(doc_info["storage_path"])
                    if pdf_p.exists():
                        try:
                            parsed_sub = PdfDocumentParser.parse_pdf(pdf_p, doc_id=d_id)
                            if parsed_sub.get("figures"):
                                storage_mgr.save_figures(d_id, parsed_sub["figures"])
                                figs = storage_mgr.get_figures_for_pages(d_id, [p_num]) or storage_mgr.get_figures_for_pages(d_id, list(range(1, 200)))
                        except Exception:
                            pass

            for f in figs:
                f_key = f"{f['document_id']}_{f['page_number']}_{f['figure_index']}"
                if f_key not in seen_figure_keys:
                    seen_figure_keys.add(f_key)
                    img_fn = f.get("image_filename", "")
                    clean_caption = f.get("caption") or f"Gambar pada Halaman {f['page_number']}"
                    resolved_figures.append(FigureSnippet(
                        document_id=f["document_id"],
                        page_number=f["page_number"],
                        figure_index=f["figure_index"],
                        caption=clean_caption,
                        image_url=f"/api/v1/figures/{img_fn}"
                    ))
                    if len(resolved_figures) >= 3:
                        break

    chat_result.figures = resolved_figures[:3]

    # Simpan riwayat percakapan jika session_id disertakan
    if request.session_id:
        try:
            # 1. Simpan pesan pengguna beserta lampiran
            storage_mgr.save_chat_message(request.session_id, "user", request.question, attachments=user_attachments_log)
            
            # 2. Simpan balasan asisten beserta sitasi & gambar
            cit_data = [c.dict() for c in chat_result.citations]
            fig_data = [f.dict() for f in chat_result.figures]
            storage_mgr.save_chat_message(
                request.session_id,
                "assistant",
                chat_result.answer,
                citations=cit_data,
                figures=fig_data
            )

            # 3. Rumuskan judul cerdas jika ini percakapan baru atau judulnya masih default
            sessions = storage_mgr.list_chat_sessions(current_user["id"])
            target_sess = next((s for s in sessions if s["id"] == request.session_id), None)
            msgs_in_session = storage_mgr.get_chat_messages(request.session_id)
            
            # Jika ini adalah pertukaran pesan pertama (1 user + 1 assistant = 2 pesan) atau judul default
            if target_sess and (len(msgs_in_session) <= 2 or target_sess["title"] in ("Percakapan Baru", "New Chat")):
                smart_title = ai_service.generate_smart_session_title(request.question, chat_result.answer)
                storage_mgr.update_chat_session_title(request.session_id, smart_title)
                chat_result.session_title = smart_title
        except Exception as e:
            print(f"[HISTORY LOG ERROR] {e}")

    # Deduksi kuota jika menggunakan Claude secara sukses (bukan error konfigurasi/jaringan)
    if is_claude_selected and not getattr(chat_result, "is_error", False):
        storage_mgr.deduct_claude_quota(current_user["id"])
        updated_quota = storage_mgr.get_user_quota(current_user["id"])
        chat_result.claude_quota_left = updated_quota.get("claude_quota_left", 0)
    else:
        user_quota = storage_mgr.get_user_quota(current_user["id"])
        chat_result.claude_quota_left = user_quota.get("claude_quota_left", 0)

    return chat_result

# --- CHAT SESSIONS CRUD (CLAUDE-STYLE RECENTS) ---
@app.get("/api/v1/chats")
def list_user_chats(current_user: dict = Depends(get_current_user)):
    """Mengambil daftar riwayat sesi percakapan milik pengguna aktif."""
    sessions = storage_mgr.list_chat_sessions(current_user["id"])
    return {"sessions": sessions}

@app.post("/api/v1/chats")
def create_chat(payload: CreateSessionRequest, current_user: dict = Depends(get_current_user)):
    """Membuat sesi percakapan baru untuk pengguna."""
    session = storage_mgr.create_chat_session(current_user["id"], title=payload.title or "Percakapan Baru")
    return session

@app.get("/api/v1/chats/{session_id}/messages")
def get_session_messages(session_id: str, current_user: dict = Depends(get_current_user)):
    """Mengambil seluruh riwayat pesan dari sesi percakapan tertentu milik pengguna."""
    if not storage_mgr.check_user_owns_session(current_user["id"], session_id):
        raise HTTPException(status_code=404, detail="Sesi percakapan tidak ditemukan atau bukan milik Anda.")
    messages = storage_mgr.get_chat_messages(session_id)
    return {"messages": messages}

@app.delete("/api/v1/chats/{session_id}")
def delete_chat(session_id: str, current_user: dict = Depends(get_current_user)):
    """Menghapus sesi percakapan beserta seluruh pesannya milik pengguna."""
    if not storage_mgr.check_user_owns_session(current_user["id"], session_id):
        raise HTTPException(status_code=404, detail="Sesi percakapan tidak ditemukan atau bukan milik Anda.")
    storage_mgr.delete_chat_session(current_user["id"], session_id)
    return {"message": "Sesi percakapan berhasil dihapus."}

class RenameSessionRequest(BaseModel):
    title: str

@app.patch("/api/v1/chats/{session_id}")
def rename_chat(session_id: str, payload: RenameSessionRequest, current_user: dict = Depends(get_current_user)):
    """Mengubah judul sesi percakapan milik pengguna."""
    if not storage_mgr.check_user_owns_session(current_user["id"], session_id):
        raise HTTPException(status_code=404, detail="Sesi percakapan tidak ditemukan atau bukan milik Anda.")
    new_title = payload.title.strip()
    if not new_title:
        raise HTTPException(status_code=400, detail="Judul tidak boleh kosong.")
    storage_mgr.update_chat_session_title(session_id, new_title, user_id=current_user["id"])
    return {"message": "Judul percakapan berhasil diperbarui.", "title": new_title}


# --- PENGATURAN AI ENGINE (OPENROUTER, ANTHROPIC, GEMINI & GROQ) ---
class UpdateAiSettingsRequest(BaseModel):
    gemini_api_key: Optional[str] = None
    gemini_model: Optional[str] = None
    groq_api_key: Optional[str] = None
    groq_model: Optional[str] = None
    openrouter_api_key: Optional[str] = None
    openrouter_model: Optional[str] = None
    anthropic_api_key: Optional[str] = None
    anthropic_model: Optional[str] = None
    router_base_url: Optional[str] = None
    router_api_key: Optional[str] = None
    router_model: Optional[str] = None

class TestAiConnectionRequest(BaseModel):
    provider: str
    api_key: str
    model: Optional[str] = None
    base_url: Optional[str] = None

@app.get("/api/v1/settings/ai")
def get_ai_settings(current_user: dict = Depends(get_current_user)):
    """Mengambil status engine AI aktif (OpenRouter / Anthropic / Gemini / Groq / Lokal)."""
    return ai_service.get_status()

@app.get("/api/v1/settings/router/models")
def get_router_available_models(current_user: dict = Depends(get_current_user)):
    """Mengambil daftar model yang aktif di 9Router Gateway lokal."""
    models = ai_service.get_router_models()
    return {
        "status": "success",
        "models": models,
        "is_alive": ai_service._is_router_alive(),
        "current_model": ai_service.router_model
    }

@app.post("/api/v1/settings/ai/test")
def test_ai_connection(payload: TestAiConnectionRequest, current_user: dict = Depends(get_current_user)):
    """Uji konektivitas live ke provider AI secara langsung."""
    return ai_service.test_connection(
        provider=payload.provider,
        api_key=payload.api_key,
        model=payload.model,
        base_url=payload.base_url
    )

@app.post("/api/v1/settings/ai")
def update_ai_settings(payload: UpdateAiSettingsRequest, current_user: dict = Depends(get_current_user)):
    """Menyimpan atau memperbarui konfigurasi AI Engine secara runtime dan persisten ke file .env."""
    ai_service.update_keys(
        gemini_key=payload.gemini_api_key,
        gemini_model=payload.gemini_model,
        groq_key=payload.groq_api_key,
        groq_model=payload.groq_model,
        openrouter_key=payload.openrouter_api_key,
        openrouter_model=payload.openrouter_model,
        anthropic_key=payload.anthropic_api_key,
        anthropic_model=payload.anthropic_model,
        router_url=payload.router_base_url,
        router_key=payload.router_api_key,
        router_model=payload.router_model
    )
    from app.config import ROOT_DIR
    env_paths = [ROOT_DIR / ".env", ROOT_DIR / "backend" / ".env"]
    for env_path in env_paths:
        try:
            env_lines = []
            if env_path.exists():
                env_lines = env_path.read_text(encoding="utf-8").splitlines()
            
            env_dict = {}
            for line in env_lines:
                if "=" in line and not line.strip().startswith("#"):
                    k, v = line.split("=", 1)
                    env_dict[k.strip()] = v.strip()
            
            if payload.gemini_api_key is not None:
                env_dict["GEMINI_API_KEY"] = payload.gemini_api_key.strip()
                env_dict["GEMINI_API_KEYS"] = payload.gemini_api_key.strip()
            if payload.gemini_model is not None:
                env_dict["GEMINI_MODEL"] = payload.gemini_model.strip()
            if payload.groq_api_key is not None:
                env_dict["GROQ_API_KEY"] = payload.groq_api_key.strip()
            if payload.groq_model is not None:
                env_dict["GROQ_MODEL"] = payload.groq_model.strip()
            if payload.openrouter_api_key is not None:
                env_dict["OPENROUTER_API_KEY"] = payload.openrouter_api_key.strip()
            if payload.openrouter_model is not None:
                env_dict["OPENROUTER_MODEL"] = payload.openrouter_model.strip()
            if payload.anthropic_api_key is not None:
                env_dict["ANTHROPIC_API_KEY"] = payload.anthropic_api_key.strip()
            if payload.anthropic_model is not None:
                env_dict["ANTHROPIC_MODEL"] = payload.anthropic_model.strip()
            if payload.router_base_url is not None:
                env_dict["ROUTER_BASE_URL"] = payload.router_base_url.strip()
            if payload.router_api_key is not None:
                env_dict["ROUTER_API_KEY"] = payload.router_api_key.strip()
            if payload.router_model is not None:
                env_dict["ROUTER_MODEL"] = payload.router_model.strip()
                
            out_content = "\n".join([f"{k}={v}" for k, v in env_dict.items()]) + "\n"
            env_path.write_text(out_content, encoding="utf-8")
        except Exception as e:
            print(f"[ENV SAVE WARN] {e}")

    return {
        "status": "success",
        "message": "Pengaturan AI Engine berhasil disimpan dan aktif secara runtime.",
        "ai_status": ai_service.get_status()
    }

# =====================================================================
# --- ADMIN & DEVELOPER CONSOLE ENDPOINTS (MONITORING & KONTROL LENGKAP) ---
# =====================================================================

class UpdateUserStatusPayload(BaseModel):
    is_active: bool

@app.get("/api/v1/admin/stats")
def get_admin_dashboard_stats(current_admin: dict = Depends(require_admin)):
    """Mengambil metrik ringkasan eksekutif dan statistik sistem."""
    stats = storage_mgr.get_admin_stats()
    return stats

@app.get("/api/v1/admin/activities")
def get_admin_recent_activities(
    limit: int = Query(50, ge=1, le=200),
    current_admin: dict = Depends(require_admin)
):
    """Mengambil linimasa aktivitas real-time para pengguna (apa yang sedang dikerjakan user)."""
    activities = storage_mgr.get_recent_activities(limit=limit)
    return {"activities": activities}

@app.get("/api/v1/admin/users")
def get_admin_user_directory(current_admin: dict = Depends(require_admin)):
    """Mengambil direktori seluruh akun pengguna, status keaktifan, dan rekap penggunaan."""
    users = storage_mgr.list_all_users_admin()
    return {"users": users}

@app.patch("/api/v1/admin/users/{target_user_id}/status")
def toggle_user_active_status(
    target_user_id: str,
    payload: UpdateUserStatusPayload,
    current_admin: dict = Depends(require_admin)
):
    """Mengaktifkan atau memblokir akses pengguna tertentu."""
    target_user = storage_mgr.get_user_by_id(target_user_id)
    if not target_user:
        raise HTTPException(status_code=404, detail="Pengguna tidak ditemukan.")

    if target_user["email"] == "admin@epiona.my.id":
        raise HTTPException(status_code=400, detail="Akun Administrator utama tidak dapat dinonaktifkan.")

    storage_mgr.toggle_user_status(target_user_id, payload.is_active)
    action_text = "diaktifkan kembali" if payload.is_active else "dinonaktifkan/diblokir"
    
    storage_mgr.log_activity(
        current_admin["id"],
        "admin_toggle_user",
        f"Administrator {action_text} akun pengguna {target_user['full_name']} ({target_user['email']})",
        {"target_user_id": target_user_id, "is_active": payload.is_active}
    )

    return {
        "status": "success",
        "message": f"Akun pengguna {target_user['email']} berhasil {action_text}."
    }

@app.get("/api/v1/admin/users/{target_user_id}/chats")
def get_admin_user_chats(
    target_user_id: str,
    current_admin: dict = Depends(require_admin)
):
    """Mengambil daftar seluruh sesi obrolan milik pengguna tertentu untuk audit pengawasan."""
    target_user = storage_mgr.get_user_by_id(target_user_id)
    if not target_user:
        raise HTTPException(status_code=404, detail="Pengguna tidak ditemukan.")

    sessions = storage_mgr.get_user_chat_sessions_admin(target_user_id)
    return {
        "user": target_user,
        "sessions": sessions
    }

@app.get("/api/v1/admin/chats/{session_id}/messages")
def get_admin_chat_messages(
    session_id: str,
    current_admin: dict = Depends(require_admin)
):
    """Mengambil transkrip dialog lengkap antara pengguna dan asisten AI dalam sesi tertentu."""
    messages = storage_mgr.get_chat_messages(session_id)
    return {"messages": messages}

@app.get("/api/v1/admin/documents")
def get_admin_documents_list(current_admin: dict = Depends(require_admin)):
    """Mengambil daftar seluruh buku dan modul di server VPS beserta pemiliknya."""
    docs = storage_mgr.get_all_documents_admin()
    return {"documents": docs}

@app.get("/api/v1/admin/system/status")
def get_admin_system_status(current_admin: dict = Depends(require_admin)):
    """Menyajikan status kesehatan teknis server VPS dan runtime environment."""
    import sys
    import platform
    import os

    return {
        "platform": platform.platform(),
        "python_version": sys.version,
        "database_type": storage_mgr.db_type.upper(),
        "database_connected": True,
        "ai_service": ai_service.get_status(),
        "storage_paths": {
            "pdfs": str(PDFS_DIR),
            "thumbnails": str(THUMBNAILS_DIR),
            "figures": str(FIGURES_DIR),
            "pages": str(PAGES_DIR)
        },
        "process_id": os.getpid()
    }

@app.get("/api/v1/admin/system/logs")
def get_admin_system_logs(
    limit: int = Query(60, ge=10, le=200),
    current_admin: dict = Depends(require_admin)
):
    """Mengambil baris log aktivitas dan audit sistem untuk Developer Console."""
    activities = storage_mgr.get_recent_activities(limit=limit)
    logs = []
    for a in activities:
        logs.append({
            "timestamp": a["created_at"],
            "level": "INFO",
            "source": a["action_type"].upper(),
            "user": f"{a['user_name']} ({a['user_email']})",
            "message": a["description"],
            "ip": a["ip_address"]
        })
    return {"logs": logs}



