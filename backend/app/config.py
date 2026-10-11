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

# Muat variabel dari .env jika ada
try:
    from dotenv import load_dotenv
    load_dotenv(ROOT_DIR / ".env")
    load_dotenv(ROOT_DIR / "backend" / ".env")
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

# 9Router & OpenRouter AI Gateway Configuration (OpenAI-compatible)
ROUTER_BASE_URL = os.getenv("ROUTER_BASE_URL", "http://localhost:20128/v1")
ROUTER_API_KEY = os.getenv("ROUTER_API_KEY", "")
ROUTER_MODEL = os.getenv("ROUTER_MODEL", "gemini-1.5-flash")

# OpenRouter Specific Gateway
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "")
OPENROUTER_BASE_URL = os.getenv("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1")
OPENROUTER_MODEL = os.getenv("OPENROUTER_MODEL", "google/gemma-4-31b-it:free")

# Anthropic Direct API / Proxy
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
ANTHROPIC_BASE_URL = os.getenv("ANTHROPIC_BASE_URL", "https://api.anthropic.com")
ANTHROPIC_MODEL = os.getenv("ANTHROPIC_MODEL", "claude-3-5-haiku-20241022")

# AI Configuration (Direct Google Gemini Multi-Key & Groq Fallback)
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_API_KEYS = os.getenv("GEMINI_API_KEYS", "")  # Kunci ganda dipisah koma (key1,key2,key3)
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
FALLBACK_MODEL = os.getenv("FALLBACK_MODEL", "llama-3.1-8b-instant")

