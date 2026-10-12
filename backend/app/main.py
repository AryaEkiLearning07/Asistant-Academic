import uuid
import re
from pathlib import Path
from typing import Optional
from pydantic import BaseModel
from fastapi import FastAPI, UploadFile, File, Form, Header, Query, HTTPException, Depends, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse

from app.config import PDFS_DIR, FIGURES_DIR, THUMBNAILS_DIR, PAGES_DIR
from app.models import (
    RegisterRequest,
    LoginRequest,
    AuthResponse,
    UploadReceipt,
    DocumentListItem,
    ChatRequest,
    ChatResponse,
    FigureSnippet,
    CreateSessionRequest
)
from app.storage import LocalStorageManager, compute_sha256, verify_password
from app.parser import PdfDocumentParser
from app.indexer import DocumentSearchIndex
from app.ai_service import AssistantAiService
from app.academic_service import AcademicRetrieverService
from app.attachment_service import AttachmentProcessor

app = FastAPI(
    title="EPIONA Academic Research Assistant API",
    version="1.1.0",
    description="Backend API untuk Library Farmasi, Multi-Tenant User Isolation, & Deep-Link PDF Citations"
)

# Izinkan CORS untuk Next.js frontend (port 3000 s/d 3005)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

storage_mgr = LocalStorageManager()
ai_service = AssistantAiService()

# --- AUTH DEPENDENCY ---
def get_current_user(
    x_user_id: Optional[str] = Header(None, alias="X-User-Id"),
    authorization: Optional[str] = Header(None),
    token: Optional[str] = Query(None)
):
    """Mengambil user aktif dari header X-User-Id, Bearer token, atau Query parameter token."""
    user_id = x_user_id or token
    if not user_id and authorization and authorization.startswith("Bearer "):
        user_id = authorization.replace("Bearer ", "").strip()

    if not user_id:
        # Fallback guest untuk pengujian tanpa login
        default_guest = storage_mgr.get_user_by_email("guest@epiona.ac.id")
        if not default_guest:
            default_guest = storage_mgr.create_user("guest@epiona.ac.id", "guest123", "Tamu Mahasiswa Farmasi")
        return default_guest

    user = storage_mgr.get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=401, detail="Sesi pengguna tidak valid atau telah berakhir.")
    return user

# --- AUTH DEPENDENCY ADMIN ---
def require_admin(current_user: dict = Depends(get_current_user)):
    """Memvalidasi bahwa pengguna aktif memiliki peran Administrator."""
    is_admin = (
        current_user.get("role") == "admin" or 
        current_user.get("email") == "admin@epiona.my.id"
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
    return AuthResponse(
        user_id=created["id"],
        email=created["email"],
        full_name=created["full_name"],
        token=created["id"],
        role=created.get("role", "user")
    )

@app.post("/api/v1/auth/login", response_model=AuthResponse)
def login_user(payload: LoginRequest):
    """Autentikasi akun pengguna & administrator."""
    # Pastikan akun admin terjamin
    if payload.email.lower().strip() == "admin@epiona.my.id":
        storage_mgr.ensure_admin_user()

    user = storage_mgr.get_user_by_email(payload.email)
    if not user:
        raise HTTPException(status_code=404, detail="Email belum terdaftar.")

    # Cek apakah akun dinonaktifkan / diblokir admin
    if user.get("is_active") == 0 or user.get("is_active") is False:
        raise HTTPException(status_code=403, detail="Akun Anda dinonaktifkan oleh Administrator. Hubungi admin@epiona.my.id.")

    if not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Kata sandi tidak sesuai.")

    role = "admin" if user["email"] == "admin@epiona.my.id" else user.get("role", "user")

    # Perbarui aktivitas dan catat audit log
    storage_mgr.update_user_last_active(user["id"])
    storage_mgr.log_activity(
        user["id"], 
        "login", 
        f"Pengguna {user['full_name']} ({user['email']}) berhasil masuk sebagai {role.upper()}.",
        {"role": role}
    )

    return AuthResponse(
        user_id=user["id"],
        email=user["email"],
        full_name=user["full_name"],
        token=user["id"],
        role=role
    )

@app.get("/api/v1/auth/me")
def get_profile(current_user: dict = Depends(get_current_user)):
    """Ambil informasi profil pengguna aktif."""
    role = "admin" if current_user["email"] == "admin@epiona.my.id" else current_user.get("role", "user")
    return {
        "id": current_user["id"],
        "email": current_user["email"],
        "full_name": current_user["full_name"],
        "role": role,
        "is_active": current_user.get("is_active", 1),
        "created_at": current_user["created_at"]
    }

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
    """Proses ekstraksi teks per halaman fisik dan pemotongan gambar grafik di latar belakang (non-blocking)."""
    try:
        parsed_data = PdfDocumentParser.parse_pdf(saved_path, doc_id=new_doc_id)
        # Update total pages riil jika berbeda
        if parsed_data.get("pages"):
            storage_mgr.save_pages(new_doc_id, parsed_data["pages"])
        if parsed_data.get("figures"):
            storage_mgr.save_figures(new_doc_id, parsed_data["figures"])
        print(f"[BACKGROUND INDEXER] Sukses mengindeks {len(parsed_data.get('pages', []))} halaman dan {len(parsed_data.get('figures', []))} gambar untuk doc {new_doc_id}")
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
def get_figure_image(filename: str):
    """Menyajikan file potongan gambar kurva / diagram yang diekstrak dari PDF dengan proteksi traversal."""
    safe_name = Path(filename).name
    fig_path = FIGURES_DIR / safe_name
    if not fig_path.exists():
        raise HTTPException(status_code=404, detail="Gambar tidak ditemukan.")
    return FileResponse(path=fig_path)

@app.get("/api/v1/pages/{filename}")
def get_page_image_file(filename: str):
    """Menyajikan render visual cuplikan lembaran halaman dokumen PDF dengan proteksi traversal."""
    safe_name = Path(filename).name
    page_path = PAGES_DIR / safe_name
    if not page_path.exists():
        raise HTTPException(status_code=404, detail="Cuplikan halaman tidak ditemukan.")
    return FileResponse(path=page_path, media_type="image/png")

@app.get("/api/v1/thumbnails/{filename}")
def get_thumbnail_image(filename: str):
    """Menyajikan gambar thumbnail sampul halaman 1 dari dokumen PDF dengan proteksi traversal."""
    safe_name = Path(filename).name
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

@app.post("/api/v1/chat", response_model=ChatResponse)
def ask_assistant(
    request: ChatRequest,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user)
):
    """Tanya jawab asisten literatur farmasi (Hybrid General AI + MyLibrary Grounded RAG)."""
    # Catat aktivitas prompt chat & perbarui status aktif pengguna
    storage_mgr.update_user_last_active(current_user["id"])
    storage_mgr.log_activity(
        current_user["id"],
        "chat_prompt",
        f"Mengajukan pertanyaan: \"{request.question[:120]}\"",
        {"question": request.question, "mode": request.grounding_mode, "session_id": request.session_id, "has_attachments": bool(request.attachments)}
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
    if request.grounding_mode == "academic":
        chat_history = []
        if request.session_id:
            try:
                prev_msgs = storage_mgr.get_chat_messages(request.session_id)
                chat_history = prev_msgs[-4:] if prev_msgs else []
            except Exception:
                chat_history = []

        # Ambil naskah & abstrak jurnal real-time dari repositori akademik
        academic_evidence = AcademicRetrieverService.retrieve_academic_evidence(request.question)
        chat_result = ai_service.answer_academic_chat(
            question=request.question,
            academic_evidence=academic_evidence,
            chat_history=chat_history
        )
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
            conversational_triggers = [
                "siapa kamu", "siapa anda", "identitas kamu", "kamu siapa", "perkenalkan dirimu",
                "siapa yang menciptakan", "siapa menciptakan", "siapa yang menciptkaan", "siapa menciptkaan",
                "menciptkaan", "siapa yang membuat", "siapa membuat", "siapa pembuat",
                "siapa pencipta", "siapa penciptamu", "siapa pembuatmu", "siapa developermu", "siapa pengembang",
                "dibuat oleh siapa", "diciptakan oleh siapa", "siapa yang ciptakan",
                "siapa yang bikin", "siapa bikin", "siapa yang buat", "siapa buat",
                "pembuat kamu", "pencipta kamu", "perancang kamu",
                "tugas kamu apa", "apa tugas kamu", "bisa apa saja", "kamu bisa apa",
                "apa fungsi kamu", "apa yang bisa kamu lakukan", "kemampuan kamu", "kemampuanmu apa",
                "apa itu epiona", "halo", "hai", "selamat pagi", "selamat siang", "selamat malam",
                "apa kabar", "terima kasih", "makasih", "thanks", "ok", "oke", "sip", "mantap",
                "tujuannya apa", "tujuan kamu", "kenapa kamu dibuat",
                "jelaskan siapa", "ceritakan tentangmu", "siapakah kamu", "siapa sih kamu"
            ]
            is_creator_query = any(w in norm_q_lower or w in q_lower for w in [
                "menciptakan", "menciptkaan", "ciptakan", "pencipta", "pembuat", "pengembang", "develop"
            ]) and any(p in norm_q_lower or p in q_lower for p in ["kamu", "anda", "epiona", "sistem", "ai", "bot", "dirimu", "siapa"])

            is_conversational = (
                any(trigger in norm_q_lower or trigger in q_lower for trigger in conversational_triggers)
                or is_creator_query
            ) and not processed_attachments

            top_matches = []
            focused_doc_title = None
            if not is_conversational:
                target_docs = user_docs
                if request.focused_document_id:
                    target_docs = [d for d in user_docs if d["id"] == request.focused_document_id]
                    if target_docs:
                        focused_doc_title = target_docs[0]["title"]

                corpus_pages = []
                for d in target_docs:
                    pages = storage_mgr.get_document_pages(d["id"])
                    for p in pages:
                        corpus_pages.append({
                            "document_id": d["id"],
                            "document_title": d["title"],
                            "page_number": p["page_number"],
                            "text": p["text"]
                        })

                # Cari dengan kueri normalisasi (menangani salah ketik / typo)
                top_matches = DocumentSearchIndex.search_pages(
                    query=norm_q,
                    pages_corpus=corpus_pages,
                    top_k=6
                )

                # Jika pencarian leksikal halaman belum menemukan hasil tapi kueri menyebut nama/kata kunci judul dokumen
                # HANYA lakukan afinitas global jika pengguna TIDAK sedang mengunci fokus ke satu dokumen tertentu
                if not top_matches and not request.focused_document_id and user_docs:
                    def calculate_doc_title_affinity(doc_title: str, query_text: str) -> int:
                        t_clean = doc_title.lower().replace("-", " ").replace("_", " ")
                        affinity = 0
                        if t_clean in query_text or query_text in t_clean:
                            affinity += 10
                        if ("week 1" in query_text or "w1" in query_text) and ("w1" in t_clean or "week 1" in t_clean):
                            affinity += 8
                        for num in range(1, 15):
                            if f"week {num}" in query_text and f"week {num}" in t_clean:
                                affinity += 8
                            if f"w{num}" in query_text and f"w{num}" in t_clean:
                                affinity += 8
                        words = [w for w in re.findall(r"\b\w+\b", t_clean) if len(w) >= 3 and w not in ["week", "doc", "pdf"]]
                        for w in words:
                            if w in query_text:
                                affinity += 2
                        return affinity

                    scored_title_docs = []
                    for d in user_docs:
                        aff_score = calculate_doc_title_affinity(d["title"], norm_q_lower)
                        if aff_score > 0:
                            scored_title_docs.append((aff_score, d))

                    scored_title_docs.sort(key=lambda x: x[0], reverse=True)

                    if scored_title_docs:
                        chosen_doc = scored_title_docs[0][1]
                        p_pages = storage_mgr.get_document_pages(chosen_doc["id"])
                        if p_pages:
                            # Prioritaskan halaman yang memiliki gambar jika ini permintaan visual
                            is_vis_req = any(w in norm_q_lower for w in ["gambar", "diagram", "grafik", "kurva", "tabel"])
                            best_p = p_pages[0]
                            if is_vis_req:
                                doc_figs = storage_mgr.get_figures_for_pages(chosen_doc["id"], [p["page_number"] for p in p_pages])
                                if doc_figs:
                                    # Ambil halaman gambar pertama yang ada
                                    fig_page_num = doc_figs[0]["page_number"]
                                    for p in p_pages:
                                        if p["page_number"] == fig_page_num:
                                            best_p = p
                                            break
                            top_matches = [{
                                "document_id": chosen_doc["id"],
                                "document_title": chosen_doc["title"],
                                "page_number": best_p["page_number"],
                                "text": best_p.get("text", "")
                            }]

            chat_history = []
            if request.session_id:
                try:
                    prev_msgs = storage_mgr.get_chat_messages(request.session_id)
                    chat_history = prev_msgs[-4:] if prev_msgs else []
                except Exception:
                    chat_history = []

            chat_result = ai_service.answer_chat(
                question=request.question,
                user_docs=user_docs,
                relevant_pages=top_matches,
                chat_history=chat_history,
                attachments=processed_attachments,
                focused_document_title=focused_doc_title
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
    """Mengambil seluruh riwayat pesan dari sesi percakapan tertentu."""
    messages = storage_mgr.get_chat_messages(session_id)
    return {"messages": messages}

@app.delete("/api/v1/chats/{session_id}")
def delete_chat(session_id: str, current_user: dict = Depends(get_current_user)):
    """Menghapus sesi percakapan beserta seluruh pesannya."""
    storage_mgr.delete_chat_session(current_user["id"], session_id)
    return {"message": "Sesi percakapan berhasil dihapus."}

class RenameSessionRequest(BaseModel):
    title: str

@app.patch("/api/v1/chats/{session_id}")
def rename_chat(session_id: str, payload: RenameSessionRequest, current_user: dict = Depends(get_current_user)):
    """Mengubah judul sesi percakapan."""
    new_title = payload.title.strip()
    if not new_title:
        raise HTTPException(status_code=400, detail="Judul tidak boleh kosong.")
    storage_mgr.update_chat_session_title(session_id, new_title)
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



