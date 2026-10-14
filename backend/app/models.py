from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional

class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6, description="Kata sandi minimal 6 karakter")
    full_name: str = Field(min_length=2, description="Nama lengkap pengguna")

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class AuthResponse(BaseModel):
    user_id: str
    email: str
    full_name: str
    token: str
    role: str = "user"
    tier: str = "free"
    claude_quota_left: int = 0
    tier_expires_at: Optional[str] = None

class UserQuotaResponse(BaseModel):
    user_id: str
    tier: str
    claude_quota_left: int
    tier_expires_at: Optional[str] = None
    is_pro: bool = False

class SubscriptionPlanRequest(BaseModel):
    plan_type: str = Field(description="Jenis paket langganan: 'pro_weekly' atau 'pro_monthly'")
    target_user_id: Optional[str] = Field(default=None, description="ID pengguna target (opsional, khusus admin)")


class UserStatusUpdateRequest(BaseModel):
    is_active: bool

class CitationItem(BaseModel):
    document_id: Optional[str] = Field(default="", description="ID unik dokumen rujukan (jika mode library)")
    document_title: str = Field(description="Judul dokumen / nama e-book / judul naskah jurnal")
    page_number: Optional[int] = Field(default=1, description="Nomor halaman fisik tempat ditemukannya bukti (1-indexed)")
    exact_quote: str = Field(description="Kutipan persis dari dokumen asli yang membuktikan jawaban")
    is_verbatim: Optional[bool] = Field(default=True, description="Status verifikasi verbatim kutipan pada dokumen sumber")
    # Metadata Tambahan Khusus Mode Web Akademik (PubMed / arXiv / CrossRef)

    source_type: Optional[str] = Field(default="local_pdf", description="Tipe sumber: 'local_pdf' atau 'academic_web'")
    journal_name: Optional[str] = Field(default=None, description="Nama jurnal ilmiah (contoh: PLOS ONE, Lancet, Nature)")
    publication_year: Optional[str] = Field(default=None, description="Tahun publikasi jurnal")
    authors: Optional[List[str]] = Field(default_factory=list, description="Daftar nama penulis")
    doi: Optional[str] = Field(default=None, description="DOI unik naskah ilmiah")
    url: Optional[str] = Field(default=None, description="Tautan publikasi resmi jurnal")
    pdf_url: Optional[str] = Field(default=None, description="Tautan naskah lengkap / PDF open access")
    abstract_snippet: Optional[str] = Field(default=None, description="Abstrak lengkap atau cuplikan metodologi studi")
    evidence_level: Optional[str] = Field(default=None, description="Tingkat bukti ilmiah (meta_analysis, rct, drug_label, dll)")

class FigureSnippet(BaseModel):
    document_id: str
    page_number: int
    figure_index: int
    caption: str
    image_url: str

class ChatResponse(BaseModel):
    answer: str = Field(description="Uraian jawaban terstruktur dalam bahasa Indonesia")
    citations: List[CitationItem] = Field(default_factory=list, description="Daftar sitasi rujukan presisi halaman")
    figures: List[FigureSnippet] = Field(default_factory=list, description="Daftar gambar/kurva/diagram relevan")
    session_title: Optional[str] = Field(default=None, description="Judul sesi cerdas yang dirumuskan secara otomatis")
    claude_quota_left: Optional[int] = Field(default=None, description="Sisa kuota chat Claude 3.5 Sonnet pengguna")
    is_error: Optional[bool] = Field(default=False, description="Penanda jika respon merupakan pesan kendala sistem atau konfigurasi")

class ChatAttachment(BaseModel):
    id: Optional[str] = None
    filename: str
    file_type: str = Field(default="application/octet-stream", description="MIME type atau ekstensi file")
    file_size: Optional[int] = 0
    data_base64: Optional[str] = Field(default=None, description="Data base64 dari file lampiran")

class ChatRequest(BaseModel):
    question: str = Field(min_length=1, max_length=8000, description="Pertanyaan pengguna (maksimal 8000 karakter)")
    grounding_mode: Optional[str] = Field(default="library", description="Mode penelusuran: 'library' (lokal) atau 'academic' (PubMed/arXiv)")
    model_preference: Optional[str] = Field(default="gemini-2.0-flash", description="Model AI yang dipilih: 'gemini-2.0-flash' atau 'claude-3-5-sonnet'")
    focused_document_id: Optional[str] = None
    session_id: Optional[str] = None
    attachments: Optional[List[ChatAttachment]] = Field(default_factory=list, description="Daftar file atau gambar yang dilampirkan pengguna")
    stream: Optional[bool] = Field(default=False, description="Flag streaming response Server-Sent Events (SSE)")

class CreateSessionRequest(BaseModel):
    title: Optional[str] = "Percakapan Baru"

class DocumentListItem(BaseModel):
    id: str
    file_hash: str
    title: str
    filename: str
    total_pages: int
    file_size_bytes: int
    created_at: str
    preview_snippet: Optional[str] = None
    thumbnail_url: Optional[str] = None
    pdf_url: str

class UploadReceipt(BaseModel):
    id: str
    file_hash: str
    title: str
    total_pages: int
    is_duplicate: bool
    message: str
