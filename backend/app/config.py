import os
from pathlib import Path

# Paths
ROOT_DIR = Path(__file__).resolve().parent.parent.parent
STORAGE_DIR = ROOT_DIR / "storage"
PDFS_DIR = STORAGE_DIR / "pdfs"
FIGURES_DIR = STORAGE_DIR / "figures"
THUMBNAILS_DIR = STORAGE_DIR / "thumbnails"
PAGES_DIR = STORAGE_DIR / "pages"
DATA_DIR = STORAGE_DIR / "data"

# Pastikan folder penyimpanan tersedia
PDFS_DIR.mkdir(parents=True, exist_ok=True)
FIGURES_DIR.mkdir(parents=True, exist_ok=True)
THUMBNAILS_DIR.mkdir(parents=True, exist_ok=True)
PAGES_DIR.mkdir(parents=True, exist_ok=True)
DATA_DIR.mkdir(parents=True, exist_ok=True)

# Muat variabel dari .env dengan override=True agar file lokal backend menjadi sumber kebenaran
try:
    from dotenv import load_dotenv
    backend_env = ROOT_DIR / "backend" / ".env"
    root_env = ROOT_DIR / ".env"
    if backend_env.exists():
        load_dotenv(backend_env, override=True)
    if root_env.exists():
        load_dotenv(root_env, override=True)
except Exception:
    pass

DB_PATH = DATA_DIR / "epiona_library.db"

# Database Configuration (XAMPP MySQL dengan SQLite Fallback)
MYSQL_HOST = os.getenv("MYSQL_HOST", "127.0.0.1")
MYSQL_PORT = int(os.getenv("MYSQL_PORT", "3307"))  # Port 3307 XAMPP aktif user
MYSQL_USER = os.getenv("MYSQL_USER", "root")
MYSQL_PASSWORD = os.getenv("MYSQL_PASSWORD", "")
MYSQL_DATABASE = os.getenv("MYSQL_DATABASE", "epiona_db")
USE_MYSQL = os.getenv("USE_MYSQL", "true").lower() in ("true", "1", "yes")

# Admin Bootstrap Configuration (diambil dari env, tanpa hardcode password)
ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "admin@epiona.my.id").strip().lower()
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "").strip()
ADMIN_PASSWORD_HASH = os.getenv("ADMIN_PASSWORD_HASH", "").strip()

# JWT Authentication Configuration
JWT_SECRET = os.getenv("JWT_SECRET", "epiona-production-jwt-secret-key-32chars-min-change-this").strip()
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256").strip()
JWT_EXPIRATION_HOURS = int(os.getenv("JWT_EXPIRATION_HOURS", "24"))
# Batasan & Pengamanan Upload & Rate Limit
MAX_UPLOAD_MB = int(os.getenv("MAX_UPLOAD_MB", "25"))
WEB_MODE_RATE_LIMIT_PER_MINUTE = int(os.getenv("WEB_MODE_RATE_LIMIT_PER_MINUTE", "10"))
MAX_WEB_QUOTA_PER_DAY = int(os.getenv("MAX_WEB_QUOTA_PER_DAY", "50"))



# 9Router & OpenRouter AI Gateway Configuration (OpenAI-compatible)
ROUTER_BASE_URL = os.getenv("ROUTER_BASE_URL", "http://localhost:20128/v1")
ROUTER_API_KEY = os.getenv("ROUTER_API_KEY", "")
ROUTER_MODEL = os.getenv("ROUTER_MODEL", "gemini-1.5-flash")

# OpenRouter Specific Gateway
raw_openrouter_key = os.getenv("OPENROUTER_API_KEY", "").strip()
# Kunci OpenRouter resmi diawali sk-or-
OPENROUTER_API_KEY = raw_openrouter_key if raw_openrouter_key.startswith("sk-or-") else ""
OPENROUTER_BASE_URL = os.getenv("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1")
OPENROUTER_MODEL = os.getenv("OPENROUTER_MODEL", "anthropic/claude-3.5-sonnet")

# Anthropic Direct API / Proxy
raw_anthropic_key = os.getenv("ANTHROPIC_API_KEY", "").strip()
# Kunci Anthropic resmi diawali sk-ant- (hindari key asing seperti ink-live-...)
ANTHROPIC_API_KEY = raw_anthropic_key if raw_anthropic_key.startswith("sk-ant-") else ""
ANTHROPIC_BASE_URL = os.getenv("ANTHROPIC_BASE_URL", "https://api.anthropic.com")
ANTHROPIC_MODEL = os.getenv("ANTHROPIC_MODEL", "claude-3-5-sonnet-20241022")

# AI Configuration (Direct Google Gemini Multi-Key & Groq Fallback)
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_API_KEYS = os.getenv("GEMINI_API_KEYS", "")  # Kunci ganda dipisah koma (key1,key2,key3)
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
FALLBACK_MODEL = os.getenv("FALLBACK_MODEL", "llama-3.1-8b-instant")

# Embedding & Reranker Multilingual Model (Hybrid Retrieval & RRF)
EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "").strip()
RERANKER_MODEL = os.getenv("RERANKER_MODEL", "").strip()

