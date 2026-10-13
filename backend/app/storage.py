import bcrypt
import hashlib
import hmac
import logging
import os
import sqlite3
import uuid
from datetime import datetime
from pathlib import Path
from typing import Optional, Dict, Any, List

import pymysql
import pymysql.cursors

from app.config import (
    DB_PATH,
    PDFS_DIR,
    MYSQL_HOST,
    MYSQL_PORT,
    MYSQL_USER,
    MYSQL_PASSWORD,
    MYSQL_DATABASE,
    USE_MYSQL,
    ADMIN_EMAIL,
    ADMIN_PASSWORD,
    ADMIN_PASSWORD_HASH,
)

logger = logging.getLogger("epiona_storage")

def hash_password(password: str) -> str:
    """Hash password menggunakan bcrypt dengan salt otomatis."""
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")

def verify_password(password: str, stored_hash: str) -> bool:
    """Verifikasi kecocokan password dengan hash bcrypt atau legacy salted SHA-256."""
    if not stored_hash or not password:
        return False
    try:
        # Cek format bcrypt ($2a$ atau $2b$)
        if stored_hash.startswith("$2a$") or stored_hash.startswith("$2b$"):
            return bcrypt.checkpw(password.encode("utf-8"), stored_hash.encode("utf-8"))

        # Fallback migrasi: legacy salted SHA-256 (format salt:hash)
        if ":" in stored_hash:
            salt, hashed = stored_hash.split(":", 1)
            expected = hashlib.sha256((salt + password).encode("utf-8")).hexdigest()
            return hmac.compare_digest(hashed, expected)

        return False
    except Exception:
        return False

def needs_password_rehash(stored_hash: str) -> bool:
    """Cek apakah hash masih menggunakan format lama dan perlu dimigrasikan ke bcrypt."""
    if not stored_hash:
        return True
    return not (stored_hash.startswith("$2a$") or stored_hash.startswith("$2b$"))


def compute_sha256(content: bytes) -> str:
    """Hitung SHA-256 checksum dari byte file."""
    hasher = hashlib.sha256()
    hasher.update(content)
    return hasher.hexdigest()

class LocalStorageManager:
    """
    Manajer Penyimpanan & Database EPIONA.
    Mendukung MySQL XAMPP (Port 3307/3306) sebagai engine utama,
    dengan otomatisasi fallback cerdas ke SQLite jika MySQL XAMPP offline.
    """
    def __init__(self, db_path: Path = DB_PATH, pdfs_dir: Path = PDFS_DIR):
        self.db_path = db_path
        self.pdfs_dir = pdfs_dir
        self.pdfs_dir.mkdir(parents=True, exist_ok=True)
        self.db_type = "sqlite"

        # Coba inisialisasi koneksi MySQL XAMPP terlebih dahulu jika diaktifkan
        if USE_MYSQL:
            try:
                # 1. Pastikan database MySQL epiona_db ada
                conn_init = pymysql.connect(
                    host=MYSQL_HOST,
                    port=MYSQL_PORT,
                    user=MYSQL_USER,
                    password=MYSQL_PASSWORD,
                    autocommit=True
                )
                with conn_init.cursor() as cur:
                    cur.execute(f"CREATE DATABASE IF NOT EXISTS `{MYSQL_DATABASE}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;")
                conn_init.close()

                # 2. Coba koneksi ke database target
                conn_test = pymysql.connect(
                    host=MYSQL_HOST,
                    port=MYSQL_PORT,
                    user=MYSQL_USER,
                    password=MYSQL_PASSWORD,
                    database=MYSQL_DATABASE,
                    cursorclass=pymysql.cursors.DictCursor
                )
                conn_test.close()
                self.db_type = "mysql"
                print(f"[DB ENGINE] Aktif menggunakan MySQL XAMPP ({MYSQL_HOST}:{MYSQL_PORT}/{MYSQL_DATABASE})")
            except Exception as e:
                print(f"[DB ENGINE] MySQL XAMPP tidak dapat diakses ({e}). Beralih otomatis ke SQLite.")
                self.db_type = "sqlite"

        # Inisialisasi skema tabel pada engine aktif
        self._init_schema()

    def _get_connection(self):
        """Membuat koneksi ke database aktif (MySQL atau SQLite)."""
        if self.db_type == "mysql":
            return pymysql.connect(
                host=MYSQL_HOST,
                port=MYSQL_PORT,
                user=MYSQL_USER,
                password=MYSQL_PASSWORD,
                database=MYSQL_DATABASE,
                cursorclass=pymysql.cursors.DictCursor,
                autocommit=False
            )
        else:
            conn = sqlite3.connect(self.db_path)
            conn.row_factory = sqlite3.Row
            return conn

    def _execute(self, sql: str, params: tuple = ()) -> None:
        """Helper eksekusi query DML dengan penyesuaian placeholder (%s vs ?)."""
        conn = self._get_connection()
        try:
            cursor = conn.cursor()
            if self.db_type == "sqlite":
                adapted_sql = sql.replace("%s", "?").replace("INSERT IGNORE", "INSERT OR IGNORE")
                cursor.execute(adapted_sql, params)
            else:
                cursor.execute(sql, params)
            conn.commit()
        finally:
            conn.close()

    def _executemany(self, sql: str, records: list) -> None:
        """Helper eksekusi bulk insert."""
        if not records:
            return
        conn = self._get_connection()
        try:
            cursor = conn.cursor()
            if self.db_type == "sqlite":
                adapted_sql = sql.replace("%s", "?").replace("INSERT IGNORE", "INSERT OR IGNORE")
                cursor.executemany(adapted_sql, records)
            else:
                cursor.executemany(sql, records)
            conn.commit()
        finally:
            conn.close()

    def _fetchone(self, sql: str, params: tuple = ()) -> Optional[Dict[str, Any]]:
        """Helper fetch satu baris."""
        conn = self._get_connection()
        try:
            cursor = conn.cursor()
            if self.db_type == "sqlite":
                adapted_sql = sql.replace("%s", "?")
                cursor.execute(adapted_sql, params)
                row = cursor.fetchone()
                return dict(row) if row else None
            else:
                cursor.execute(sql, params)
                row = cursor.fetchone()
                return dict(row) if row else None
        finally:
            conn.close()

    def _fetchall(self, sql: str, params: tuple = ()) -> List[Dict[str, Any]]:
        """Helper fetch seluruh baris."""
        conn = self._get_connection()
        try:
            cursor = conn.cursor()
            if self.db_type == "sqlite":
                adapted_sql = sql.replace("%s", "?")
                cursor.execute(adapted_sql, params)
                rows = cursor.fetchall()
                return [dict(r) for r in rows]
            else:
                cursor.execute(sql, params)
                rows = cursor.fetchall()
                return [dict(r) for r in rows]
        finally:
            conn.close()

    def _init_schema(self) -> None:
        """Inisialisasi tabel sesuai engine aktif."""
        conn = self._get_connection()
        try:
            cursor = conn.cursor()
            if self.db_type == "mysql":
                cursor.execute("""
                CREATE TABLE IF NOT EXISTS users (
                    id VARCHAR(64) PRIMARY KEY,
                    email VARCHAR(191) UNIQUE NOT NULL,
                    password_hash VARCHAR(255) NOT NULL,
                    full_name VARCHAR(255) NOT NULL,
                    created_at VARCHAR(64) NOT NULL
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
                """)
                cursor.execute("""
                CREATE TABLE IF NOT EXISTS documents (
                    id VARCHAR(64) PRIMARY KEY,
                    file_hash VARCHAR(64) UNIQUE NOT NULL,
                    title VARCHAR(255) NOT NULL,
                    filename VARCHAR(255) NOT NULL,
                    total_pages INT NOT NULL,
                    file_size_bytes BIGINT NOT NULL,
                    storage_path TEXT NOT NULL,
                    created_at VARCHAR(64) NOT NULL
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
                """)
                cursor.execute("""
                CREATE TABLE IF NOT EXISTS user_documents (
                    id VARCHAR(64) PRIMARY KEY,
                    user_id VARCHAR(64) NOT NULL,
                    document_id VARCHAR(64) NOT NULL,
                    title_alias VARCHAR(255) NOT NULL,
                    created_at VARCHAR(64) NOT NULL,
                    UNIQUE KEY uniq_user_doc (user_id, document_id)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
                """)
                cursor.execute("""
                CREATE TABLE IF NOT EXISTS document_pages (
                    id VARCHAR(64) PRIMARY KEY,
                    document_id VARCHAR(64) NOT NULL,
                    page_number INT NOT NULL,
                    text_content MEDIUMTEXT NOT NULL
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
                """)
                cursor.execute("""
                CREATE TABLE IF NOT EXISTS document_passages (
                    id VARCHAR(64) PRIMARY KEY,
                    document_id VARCHAR(64) NOT NULL,
                    page_number INT NOT NULL,
                    passage_index INT NOT NULL,
                    passage_text MEDIUMTEXT NOT NULL,
                    embedding_json MEDIUMTEXT,
                    created_at VARCHAR(64) NOT NULL
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
                """)
                cursor.execute("""
                CREATE TABLE IF NOT EXISTS document_figures (
                    id VARCHAR(64) PRIMARY KEY,
                    document_id VARCHAR(64) NOT NULL,
                    page_number INT NOT NULL,
                    figure_index INT NOT NULL,
                    image_filename VARCHAR(255) NOT NULL,
                    caption TEXT
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
                """)
                cursor.execute("""
                CREATE TABLE IF NOT EXISTS chat_sessions (
                    id VARCHAR(64) PRIMARY KEY,
                    user_id VARCHAR(64) NOT NULL,
                    title VARCHAR(255) NOT NULL,
                    created_at VARCHAR(64) NOT NULL,
                    updated_at VARCHAR(64) NOT NULL
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
                """)
                cursor.execute("""
                CREATE TABLE IF NOT EXISTS chat_messages (
                    id VARCHAR(64) PRIMARY KEY,
                    session_id VARCHAR(64) NOT NULL,
                    sender VARCHAR(32) NOT NULL,
                    text MEDIUMTEXT NOT NULL,
                    citations_json MEDIUMTEXT,
                    figures_json MEDIUMTEXT,
                    attachments_json MEDIUMTEXT,
                    created_at VARCHAR(64) NOT NULL
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
                """)
            else:
                cursor.execute("""
                CREATE TABLE IF NOT EXISTS users (
                    id TEXT PRIMARY KEY,
                    email TEXT UNIQUE NOT NULL,
                    password_hash TEXT NOT NULL,
                    full_name TEXT NOT NULL,
                    created_at TEXT NOT NULL
                );
                """)
                cursor.execute("""
                CREATE TABLE IF NOT EXISTS documents (
                    id TEXT PRIMARY KEY,
                    file_hash TEXT UNIQUE NOT NULL,
                    title TEXT NOT NULL,
                    filename TEXT NOT NULL,
                    total_pages INTEGER NOT NULL,
                    file_size_bytes INTEGER NOT NULL,
                    storage_path TEXT NOT NULL,
                    created_at TEXT NOT NULL
                );
                """)
                cursor.execute("""
                CREATE TABLE IF NOT EXISTS user_documents (
                    id TEXT PRIMARY KEY,
                    user_id TEXT NOT NULL,
                    document_id TEXT NOT NULL,
                    title_alias TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    UNIQUE(user_id, document_id)
                );
                """)
                cursor.execute("""
                CREATE TABLE IF NOT EXISTS document_pages (
                    id TEXT PRIMARY KEY,
                    document_id TEXT NOT NULL,
                    page_number INTEGER NOT NULL,
                    text_content TEXT NOT NULL
                );
                """)
                cursor.execute("""
                CREATE TABLE IF NOT EXISTS document_passages (
                    id TEXT PRIMARY KEY,
                    document_id TEXT NOT NULL,
                    page_number INTEGER NOT NULL,
                    passage_index INTEGER NOT NULL,
                    passage_text TEXT NOT NULL,
                    embedding_json TEXT,
                    created_at TEXT NOT NULL
                );
                """)
                cursor.execute("""
                CREATE TABLE IF NOT EXISTS document_figures (
                    id TEXT PRIMARY KEY,
                    document_id TEXT NOT NULL,
                    page_number INTEGER NOT NULL,
                    figure_index INTEGER NOT NULL,
                    image_filename TEXT NOT NULL,
                    caption TEXT
                );
                """)
                cursor.execute("""
                CREATE TABLE IF NOT EXISTS chat_sessions (
                    id TEXT PRIMARY KEY,
                    user_id TEXT NOT NULL,
                    title TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );
                """)
                cursor.execute("""
                CREATE TABLE IF NOT EXISTS chat_messages (
                    id TEXT PRIMARY KEY,
                    session_id TEXT NOT NULL,
                    sender TEXT NOT NULL,
                    text TEXT NOT NULL,
                    citations_json TEXT,
                    figures_json TEXT,
                    attachments_json TEXT,
                    created_at TEXT NOT NULL
                );
                """)
                cursor.execute("CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);")
                cursor.execute("CREATE INDEX IF NOT EXISTS idx_doc_hash ON documents(file_hash);")
                cursor.execute("CREATE INDEX IF NOT EXISTS idx_user_docs ON user_documents(user_id);")
                cursor.execute("CREATE INDEX IF NOT EXISTS idx_pages_doc ON document_pages(document_id, page_number);")
                cursor.execute("CREATE INDEX IF NOT EXISTS idx_passages_doc ON document_passages(document_id, page_number);")
                cursor.execute("CREATE INDEX IF NOT EXISTS idx_doc_figures ON document_figures(document_id, page_number);")
                cursor.execute("CREATE INDEX IF NOT EXISTS idx_chat_sess_user ON chat_sessions(user_id);")
                cursor.execute("CREATE INDEX IF NOT EXISTS idx_chat_msg_sess ON chat_messages(session_id);")

            # Migrasi aman: pastikan kolom attachments_json tersedia di database lama
            try:
                if self.db_type == "mysql":
                    cursor.execute("ALTER TABLE chat_messages ADD COLUMN attachments_json MEDIUMTEXT")
                else:
                    cursor.execute("ALTER TABLE chat_messages ADD COLUMN attachments_json TEXT")
            except Exception:
                pass

            # Migrasi aman: tambahkan role, is_active, last_active_at pada users
            for col_def_mysql, col_def_sqlite in [
                ("role VARCHAR(20) DEFAULT 'user'", "role TEXT DEFAULT 'user'"),
                ("is_active TINYINT DEFAULT 1", "is_active INTEGER DEFAULT 1"),
                ("last_active_at VARCHAR(64)", "last_active_at TEXT"),
                ("tier VARCHAR(20) DEFAULT 'free'", "tier TEXT DEFAULT 'free'"),
                ("claude_quota_left INT DEFAULT 0", "claude_quota_left INTEGER DEFAULT 0"),
                ("tier_expires_at VARCHAR(64)", "tier_expires_at TEXT")
            ]:
                try:
                    if self.db_type == "mysql":
                        cursor.execute(f"ALTER TABLE users ADD COLUMN {col_def_mysql}")
                    else:
                        cursor.execute(f"ALTER TABLE users ADD COLUMN {col_def_sqlite}")
                except Exception:
                    pass

            # Buat tabel subscriptions untuk mencatat riwayat transaksi langganan
            if self.db_type == "mysql":
                cursor.execute("""
                CREATE TABLE IF NOT EXISTS subscriptions (
                    id VARCHAR(64) PRIMARY KEY,
                    user_id VARCHAR(64) NOT NULL,
                    plan_type VARCHAR(32) NOT NULL,
                    amount DECIMAL(12, 2) NOT NULL,
                    status VARCHAR(32) DEFAULT 'active',
                    created_at VARCHAR(64) NOT NULL,
                    expires_at VARCHAR(64) NOT NULL
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
                """)
            else:
                cursor.execute("""
                CREATE TABLE IF NOT EXISTS subscriptions (
                    id TEXT PRIMARY KEY,
                    user_id TEXT NOT NULL,
                    plan_type TEXT NOT NULL,
                    amount REAL NOT NULL,
                    status TEXT DEFAULT 'active',
                    created_at TEXT NOT NULL,
                    expires_at TEXT NOT NULL
                );
                """)
                cursor.execute("CREATE INDEX IF NOT EXISTS idx_sub_user ON subscriptions(user_id);")

            # Buat tabel activity_logs untuk memantau aktivitas user secara real-time
            if self.db_type == "mysql":
                cursor.execute("""
                CREATE TABLE IF NOT EXISTS activity_logs (
                    id VARCHAR(64) PRIMARY KEY,
                    user_id VARCHAR(64) NOT NULL,
                    action_type VARCHAR(64) NOT NULL,
                    description TEXT NOT NULL,
                    details_json MEDIUMTEXT,
                    ip_address VARCHAR(64),
                    created_at VARCHAR(64) NOT NULL
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
                """)
            else:
                cursor.execute("""
                CREATE TABLE IF NOT EXISTS activity_logs (
                    id TEXT PRIMARY KEY,
                    user_id TEXT NOT NULL,
                    action_type TEXT NOT NULL,
                    description TEXT NOT NULL,
                    details_json TEXT,
                    ip_address TEXT,
                    created_at TEXT NOT NULL
                );
                """)
                cursor.execute("CREATE INDEX IF NOT EXISTS idx_act_user ON activity_logs(user_id);")
                cursor.execute("CREATE INDEX IF NOT EXISTS idx_act_created ON activity_logs(created_at);")

            conn.commit()
        finally:
            conn.close()

        # Otomatis pastikan akun Administrator tersedia
        try:
            self.ensure_admin_user()
        except Exception as e:
            logger.warning(f"Gagal memastikan akun admin saat inisialisasi: {e}")

    # --- USER AUTHENTICATION & MANAGEMENT ---
    def create_user(self, email: str, password: str, full_name: str, role: str = "user") -> Dict[str, Any]:
        """Daftarkan pengguna baru dengan email dan password ber-salt."""
        user_id = str(uuid.uuid4())
        pwd_hash = hash_password(password)
        now_iso = datetime.now().isoformat()
        
        try:
            self._execute("""
            INSERT INTO users (id, email, password_hash, full_name, role, is_active, last_active_at, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            """, (user_id, email.lower().strip(), pwd_hash, full_name.strip(), role, 1, now_iso, now_iso))
        except Exception:
            # Fallback jika kolom role belum terdeteksi
            self._execute("""
            INSERT INTO users (id, email, password_hash, full_name, created_at)
            VALUES (%s, %s, %s, %s, %s)
            """, (user_id, email.lower().strip(), pwd_hash, full_name.strip(), now_iso))

        return {
            "id": user_id,
            "email": email.lower().strip(),
            "full_name": full_name.strip(),
            "role": role,
            "is_active": 1,
            "last_active_at": now_iso,
            "created_at": now_iso
        }

    def ensure_admin_user(self) -> None:
        """Membuat atau memastikan akun default admin siap digunakan dari konfigurasi environment."""
        admin_email = ADMIN_EMAIL or "admin@epiona.my.id"
        admin_name = "Epiona Administrator"
        now_iso = datetime.now().isoformat()

        pwd_hash = None
        if ADMIN_PASSWORD_HASH:
            pwd_hash = ADMIN_PASSWORD_HASH
        elif ADMIN_PASSWORD:
            pwd_hash = hash_password(ADMIN_PASSWORD)

        user = self.get_user_by_email(admin_email)
        if not user:
            if not pwd_hash:
                logger.warning("ADMIN_PASSWORD tidak disetel di environment. Akun admin belum di-bootstrap.")
                return
            user_id = str(uuid.uuid4())
            try:
                self._execute("""
                INSERT INTO users (id, email, password_hash, full_name, role, is_active, last_active_at, created_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                """, (user_id, admin_email, pwd_hash, admin_name, "admin", 1, now_iso, now_iso))
            except Exception:
                self._execute("""
                INSERT INTO users (id, email, password_hash, full_name, created_at)
                VALUES (%s, %s, %s, %s, %s)
                """, (user_id, admin_email, pwd_hash, admin_name, now_iso))
            logger.info(f"Akun default Administrator '{admin_email}' berhasil dibuat dari environment.")
        else:
            # Pastikan role admin tetap 'admin' tanpa mereset password pengguna
            try:
                self._execute("""
                UPDATE users 
                SET role = 'admin', is_active = 1
                WHERE email = %s
                """, (admin_email,))
            except Exception:
                pass
            logger.info(f"Role Administrator '{admin_email}' diverifikasi (password tidak di-reset).")

    def get_user_by_email(self, email: str) -> Optional[Dict[str, Any]]:
        row = self._fetchone("SELECT * FROM users WHERE email = %s", (email.lower().strip(),))
        if row and "role" not in row:
            row["role"] = "admin" if row.get("email") == "admin@epiona.my.id" else "user"
        if row and "is_active" not in row:
            row["is_active"] = 1
        return row

    def get_user_by_id(self, user_id: str) -> Optional[Dict[str, Any]]:
        row = self._fetchone("SELECT * FROM users WHERE id = %s", (user_id,))
        if row:
            if "role" not in row:
                row["role"] = "admin" if row.get("email") == "admin@epiona.my.id" else "user"
            if "is_active" not in row:
                row["is_active"] = 1
            # Hapus password_hash untuk keamanan
            row.pop("password_hash", None)
        return row

    def update_user_last_active(self, user_id: str) -> None:
        """Memperbarui waktu terakhir user aktif di platform."""
        try:
            self._execute("UPDATE users SET last_active_at = %s WHERE id = %s", (datetime.now().isoformat(), user_id))
        except Exception:
            pass

    def update_user_password(self, user_id: str, new_password_hash: str) -> None:
        """Memperbarui password_hash pengguna (misal saat migrasi hash ke bcrypt)."""
        self._execute("UPDATE users SET password_hash = %s WHERE id = %s", (new_password_hash, user_id))


    def get_user_quota(self, user_id: str) -> Dict[str, Any]:
        """Mengambil data kuota pengguna dan mengevaluasi masa aktif langganan."""
        row = self._fetchone("SELECT id, email, role, tier, claude_quota_left, tier_expires_at FROM users WHERE id = %s", (user_id,))
        if not row:
            return {"user_id": user_id, "tier": "free", "claude_quota_left": 0, "tier_expires_at": None, "is_pro": False}
        
        role = row.get("role", "user")
        if role == "admin" or row.get("email") == "admin@epiona.my.id":
            return {
                "user_id": user_id,
                "tier": "admin_pro",
                "claude_quota_left": 999999,
                "tier_expires_at": None,
                "is_pro": True
            }

        tier = row.get("tier") or "free"
        quota = row.get("claude_quota_left") or 0
        expires_at = row.get("tier_expires_at")

        # Cek apakah langganan sudah kedaluwarsa
        if expires_at and tier != "free":
            try:
                exp_dt = datetime.fromisoformat(expires_at)
                if datetime.now() > exp_dt:
                    # Downgrade ke free
                    self._execute("UPDATE users SET tier = 'free', claude_quota_left = 0 WHERE id = %s", (user_id,))
                    tier = "free"
                    quota = 0
            except Exception:
                pass

        is_pro = tier in ("pro_weekly", "pro_monthly", "admin_pro") and quota > 0
        return {
            "user_id": user_id,
            "tier": tier,
            "claude_quota_left": quota,
            "tier_expires_at": expires_at,
            "is_pro": is_pro
        }

    def deduct_claude_quota(self, user_id: str) -> bool:
        """Mengurangi kuota chat Claude 3.5 Sonnet sebanyak 1."""
        user = self._fetchone("SELECT role, email, tier, claude_quota_left FROM users WHERE id = %s", (user_id,))
        if not user:
            return False
        
        # Admin tidak memotong kuota
        if user.get("role") == "admin" or user.get("email") == "admin@epiona.my.id":
            return True
            
        current_quota = user.get("claude_quota_left") or 0
        if current_quota <= 0:
            return False

        try:
            self._execute("UPDATE users SET claude_quota_left = GREATEST(0, claude_quota_left - 1) WHERE id = %s", (user_id,))
            return True
        except Exception:
            return False

    def grant_subscription(self, user_id: str, plan_type: str) -> Dict[str, Any]:
        """Mengaktifkan atau memperpanjang paket langganan pengguna."""
        from datetime import timedelta

        now_dt = datetime.now()
        now_iso = now_dt.isoformat()
        
        if plan_type == "pro_weekly":
            bonus_quota = 150
            days = 7
            amount = 19000.00
        elif plan_type == "pro_monthly":
            bonus_quota = 700
            days = 30
            amount = 49000.00
        else:
            raise ValueError(f"Tipe paket tidak valid: {plan_type}")

        # Cek apakah user saat ini sudah punya masa aktif
        current = self.get_user_quota(user_id)
        current_exp = current.get("tier_expires_at")
        base_dt = now_dt
        if current_exp and current.get("is_pro"):
            try:
                parsed_exp = datetime.fromisoformat(current_exp)
                if parsed_exp > now_dt:
                    base_dt = parsed_exp
            except Exception:
                pass

        new_expires_dt = base_dt + timedelta(days=days)
        new_expires_iso = new_expires_dt.isoformat()

        # Update users
        try:
            self._execute("""
            UPDATE users 
            SET tier = %s, claude_quota_left = claude_quota_left + %s, tier_expires_at = %s
            WHERE id = %s
            """, (plan_type, bonus_quota, new_expires_iso, user_id))
        except Exception:
            self._execute("""
            UPDATE users 
            SET tier = %s, claude_quota_left = %s, tier_expires_at = %s
            WHERE id = %s
            """, (plan_type, bonus_quota, new_expires_iso, user_id))

        # Catat ke subscriptions
        sub_id = str(uuid.uuid4())
        try:
            self._execute("""
            INSERT INTO subscriptions (id, user_id, plan_type, amount, status, created_at, expires_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            """, (sub_id, user_id, plan_type, amount, "active", now_iso, new_expires_iso))
        except Exception as e:
            logger.warning(f"Gagal mencatat subscriptions record: {e}")

        self.log_activity(
            user_id,
            "subscription_activated",
            f"Paket {plan_type.upper()} aktif (+{bonus_quota} chat Claude, s.d. {new_expires_dt.strftime('%d %b %Y')})",
            {"plan": plan_type, "quota_added": bonus_quota, "expires_at": new_expires_iso}
        )

        return {
            "status": "success",
            "plan_type": plan_type,
            "added_quota": bonus_quota,
            "expires_at": new_expires_iso,
            "message": f"Paket {plan_type} berhasil diaktifkan."
        }

    def log_activity(self, user_id: str, action_type: str, description: str, details: dict = None, ip_address: str = None) -> None:
        """Mencatat aktivitas live user ke dalam feed monitoring admin."""
        import json
        log_id = str(uuid.uuid4())
        now_iso = datetime.now().isoformat()
        det_json = json.dumps(details or {}, ensure_ascii=False)
        try:
            self._execute("""
            INSERT INTO activity_logs (id, user_id, action_type, description, details_json, ip_address, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            """, (log_id, user_id, action_type, description, det_json, ip_address or "127.0.0.1", now_iso))
        except Exception as e:
            logger.debug(f"Gagal mencatat activity_log: {e}")

    # --- ADMIN MONITORING & AUDIT METHODS ---
    def get_admin_stats(self) -> Dict[str, Any]:
        """Menghitung metrik menyeluruh sistem untuk dashboard admin."""
        u_count = self._fetchone("SELECT COUNT(*) as count FROM users") or {}
        d_count = self._fetchone("SELECT COUNT(*) as count, COALESCE(SUM(total_pages), 0) as pages, COALESCE(SUM(file_size_bytes), 0) as total_bytes FROM documents") or {}
        s_count = self._fetchone("SELECT COUNT(*) as count FROM chat_sessions") or {}
        m_count = self._fetchone("SELECT COUNT(*) as count FROM chat_messages") or {}
        act_count = self._fetchone("SELECT COUNT(*) as count FROM activity_logs") or {}

        total_users = u_count.get("count", 0)
        total_docs = d_count.get("count", 0)
        total_pages = d_count.get("pages", 0)
        storage_bytes = d_count.get("total_bytes", 0)
        total_sessions = s_count.get("count", 0)
        total_messages = m_count.get("count", 0)
        total_activities = act_count.get("count", 0)

        return {
            "total_users": total_users,
            "total_documents": total_docs,
            "total_pages": int(total_pages),
            "storage_bytes": int(storage_bytes),
            "storage_mb": round(int(storage_bytes) / (1024 * 1024), 2),
            "total_sessions": total_sessions,
            "total_messages": total_messages,
            "total_activities": total_activities
        }

    def list_all_users_admin(self) -> List[Dict[str, Any]]:
        """Mengambil seluruh daftar pengguna beserta statistik penggunaan mereka."""
        users = self._fetchall("SELECT id, email, full_name, created_at FROM users ORDER BY created_at DESC")
        result = []
        for u in users:
            uid = u["id"]
            # Ambil role, is_active, last_active_at jika ada
            full_u = self._fetchone("SELECT * FROM users WHERE id = %s", (uid,)) or {}
            role = full_u.get("role", "admin" if u["email"] == "admin@epiona.my.id" else "user")
            is_active = full_u.get("is_active", 1)
            last_active = full_u.get("last_active_at", u.get("created_at"))

            # Hitung jumlah dokumen milik user
            doc_c = self._fetchone("SELECT COUNT(*) as count FROM user_documents WHERE user_id = %s", (uid,)) or {}
            # Hitung jumlah sesi chat
            sess_c = self._fetchone("SELECT COUNT(*) as count FROM chat_sessions WHERE user_id = %s", (uid,)) or {}
            # Hitung total pesan yang dikirim
            msg_c = self._fetchone("""
            SELECT COUNT(*) as count FROM chat_messages m 
            JOIN chat_sessions s ON m.session_id = s.id 
            WHERE s.user_id = %s AND m.sender = 'user'
            """, (uid,)) or {}

            result.append({
                "id": uid,
                "email": u["email"],
                "full_name": u["full_name"],
                "role": role,
                "is_active": bool(is_active),
                "last_active_at": last_active,
                "created_at": u["created_at"],
                "total_documents": doc_c.get("count", 0),
                "total_sessions": sess_c.get("count", 0),
                "total_messages": msg_c.get("count", 0)
            })
        return result

    def get_recent_activities(self, limit: int = 50) -> List[Dict[str, Any]]:
        """Mengambil linimasa aktivitas real-time terkini dari seluruh pengguna."""
        import json
        sql = """
        SELECT a.id, a.user_id, a.action_type, a.description, a.details_json, a.ip_address, a.created_at,
               u.email as user_email, u.full_name as user_name
        FROM activity_logs a
        LEFT JOIN users u ON a.user_id = u.id
        ORDER BY a.created_at DESC
        LIMIT %s
        """
        rows = self._fetchall(sql, (limit,))
        activities = []
        for r in rows:
            det = {}
            if r.get("details_json"):
                try:
                    det = json.loads(r["details_json"])
                except Exception:
                    pass
            activities.append({
                "id": r["id"],
                "user_id": r["user_id"],
                "user_email": r.get("user_email") or "Tamu / Guest",
                "user_name": r.get("user_name") or "Pengguna Anonim",
                "action_type": r["action_type"],
                "description": r["description"],
                "details": det,
                "ip_address": r.get("ip_address") or "127.0.0.1",
                "created_at": r["created_at"]
            })
        return activities

    def get_user_chat_sessions_admin(self, user_id: str) -> List[Dict[str, Any]]:
        """Mengambil sesi percakapan milik pengguna tertentu untuk audit pengawasan admin."""
        return self._fetchall("""
        SELECT id, user_id, title, created_at, updated_at 
        FROM chat_sessions 
        WHERE user_id = %s 
        ORDER BY updated_at DESC
        """, (user_id,))

    def get_all_documents_admin(self) -> List[Dict[str, Any]]:
        """Mengambil seluruh file dokumen di sistem beserta pemilik dan penggunaan kapasitas."""
        docs = self._fetchall("SELECT * FROM documents ORDER BY created_at DESC")
        res = []
        for d in docs:
            # Cari siapa saja pemiliknya
            owners = self._fetchall("""
            SELECT u.id, u.email, u.full_name 
            FROM user_documents ud 
            JOIN users u ON ud.user_id = u.id 
            WHERE ud.document_id = %s
            """, (d["id"],))
            res.append({
                "id": d["id"],
                "file_hash": d["file_hash"],
                "title": d["title"],
                "filename": d["filename"],
                "total_pages": d["total_pages"],
                "file_size_bytes": d["file_size_bytes"],
                "file_size_mb": round(d["file_size_bytes"] / (1024 * 1024), 2),
                "created_at": d["created_at"],
                "owners": owners
            })
        return res

    def toggle_user_status(self, user_id: str, is_active: bool) -> bool:
        """Mengaktifkan atau menonaktifkan (memblokir) akun pengguna."""
        val = 1 if is_active else 0
        self._execute("UPDATE users SET is_active = %s WHERE id = %s", (val, user_id))
        return True

    # --- DOCUMENT & MULTI-TENANT ISOLATION ---
    def find_by_hash(self, file_hash: str) -> Optional[Dict[str, Any]]:
        """Cek apakah file dengan hash identik sudah pernah diunggah secara global."""
        return self._fetchone("SELECT * FROM documents WHERE file_hash = %s", (file_hash,))

    def find_by_id(self, doc_id: str) -> Optional[Dict[str, Any]]:
        return self._fetchone("SELECT * FROM documents WHERE id = %s", (doc_id,))

    def check_user_owns_document(self, user_id: str, document_id: str) -> bool:
        """Cek apakah pengguna memiliki hak akses ke dokumen tersebut."""
        row = self._fetchone("""
        SELECT id FROM user_documents WHERE user_id = %s AND document_id = %s
        """, (user_id, document_id))
        return row is not None

    def list_user_documents(self, user_id: str) -> List[Dict[str, Any]]:
        """Ambil hanya dokumen yang dimiliki oleh user tertentu (Isolasi Penuh)."""
        return self._fetchall("""
        SELECT d.id, d.file_hash, ud.title_alias AS title, d.filename, 
               d.total_pages, d.file_size_bytes, d.storage_path, ud.created_at
        FROM documents d
        JOIN user_documents ud ON d.id = ud.document_id
        WHERE ud.user_id = %s
        ORDER BY ud.created_at DESC
        """, (user_id,))

    def link_document_to_user(self, user_id: str, document_id: str, title_alias: str) -> None:
        """Tautkan dokumen yang sudah ada ke akun pengguna (Deduplikasi)."""
        now_iso = datetime.now().isoformat()
        rel_id = str(uuid.uuid4())
        self._execute("""
        INSERT IGNORE INTO user_documents (id, user_id, document_id, title_alias, created_at)
        VALUES (%s, %s, %s, %s, %s)
        """, (rel_id, user_id, document_id, title_alias, now_iso))

    def remove_user_document(self, user_id: str, document_id: str) -> Dict[str, Any]:
        """
        Hapus akses dokumen dari pengguna (Smart Reference-Counting).
        Jika dokumen masih dimiliki pengguna lain: HANYA cabut akses relasi.
        Jika SUDAH TIDAK ADA pengguna lain: Lakukan pembersihan total (Cascade Hard Delete).
        """
        # 1. Hapus relasi kepemilikan user
        self._execute("""
        DELETE FROM user_documents WHERE user_id = %s AND document_id = %s
        """, (user_id, document_id))

        # 2. Cek apakah masih ada user lain yang memiliki dokumen ini
        count_row = self._fetchone("""
        SELECT COUNT(*) as total_refs FROM user_documents WHERE document_id = %s
        """, (document_id,))
        remaining = count_row.get("total_refs", 0) if count_row else 0

        if remaining > 0:
            return {
                "deleted_from_library": True,
                "completely_purged": False,
                "remaining_references": remaining,
                "message": f"Akses dokumen dicabut dari MyLibrary Anda. Dokumen tetap tersimpan aman karena masih digunakan oleh {remaining} pengguna lain."
            }

        # 3. Reference count == 0: Tidak ada lagi pengguna yang memiliki -> Hard Delete Total
        doc = self.find_by_id(document_id)
        if doc:
            try:
                pdf_file = Path(doc["storage_path"])
                if pdf_file.exists():
                    pdf_file.unlink()
            except Exception:
                pass

            try:
                from app.config import THUMBNAILS_DIR
                thumb_file = THUMBNAILS_DIR / f"thumb_{doc['id']}.png"
                if thumb_file.exists():
                    thumb_file.unlink()
            except Exception:
                pass

            try:
                figs = self._fetchall("SELECT image_filename FROM document_figures WHERE document_id = %s", (document_id,))
                from app.config import FIGURES_DIR
                for f in figs:
                    f_path = FIGURES_DIR / f["image_filename"]
                    if f_path.exists():
                        f_path.unlink()
            except Exception:
                pass

            self._execute("DELETE FROM document_figures WHERE document_id = %s", (document_id,))
            self._execute("DELETE FROM document_passages WHERE document_id = %s", (document_id,))
            self._execute("DELETE FROM document_pages WHERE document_id = %s", (document_id,))
            self._execute("DELETE FROM documents WHERE id = %s", (document_id,))

        return {
            "deleted_from_library": True,
            "completely_purged": True,
            "remaining_references": 0,
            "message": "Dokumen berhasil dihapus total dari sistem karena tidak ada pengguna lain yang menggunakannya."
        }

    def save_new_file(self, content: bytes, file_hash: str) -> Path:
        """Simpan file fisik PDF ke folder lokal dengan nama <file_hash>.pdf."""
        target_path = self.pdfs_dir / f"{file_hash}.pdf"
        target_path.write_bytes(content)
        return target_path

    def register_document(
        self,
        doc_id: str,
        file_hash: str,
        title: str,
        filename: str,
        total_pages: int,
        file_size_bytes: int,
        storage_path: str
    ) -> Dict[str, Any]:
        """Daftarkan dokumen baru ke master documents."""
        now_iso = datetime.now().isoformat()
        self._execute("""
        INSERT INTO documents (id, file_hash, title, filename, total_pages, file_size_bytes, storage_path, created_at)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        """, (doc_id, file_hash, title, filename, total_pages, file_size_bytes, storage_path, now_iso))

        return {
            "id": doc_id,
            "file_hash": file_hash,
            "title": title,
            "filename": filename,
            "total_pages": total_pages,
            "file_size_bytes": file_size_bytes,
            "storage_path": storage_path,
            "created_at": now_iso
        }

    def save_pages(self, document_id: str, pages_data: List[Dict[str, Any]]) -> None:
        """Simpan teks per halaman fisik dokumen."""
        records = [
            (str(uuid.uuid4()), document_id, p["page_number"], p["text"])
            for p in pages_data
        ]
        self._executemany("""
        INSERT INTO document_pages (id, document_id, page_number, text_content)
        VALUES (%s, %s, %s, %s)
        """, records)

    def get_document_pages(self, document_id: str) -> List[Dict[str, Any]]:
        """Ambil seluruh halaman teks dokumen tertentu."""
        rows = self._fetchall("""
        SELECT page_number, text_content FROM document_pages
        WHERE document_id = %s ORDER BY page_number ASC
        """, (document_id,))
        return [{"page_number": r["page_number"], "text": r["text_content"]} for r in rows]

    def save_passages(self, document_id: str, passages_data: List[Dict[str, Any]]) -> None:
        """Simpan teks per passage / potongan terstruktur dokumen beserta embedding vektor opsional."""
        if not passages_data:
            return
        import json
        now_iso = datetime.now().isoformat()
        records = []
        for p in passages_data:
            pid = p.get("id") or str(uuid.uuid4())
            emb = p.get("embedding_json")
            if isinstance(emb, (list, dict)):
                emb = json.dumps(emb)
            records.append((
                pid,
                document_id,
                int(p["page_number"]),
                int(p.get("passage_index", 0)),
                p.get("passage_text", ""),
                emb,
                now_iso
            ))
        self._executemany("""
        INSERT INTO document_passages (id, document_id, page_number, passage_index, passage_text, embedding_json, created_at)
        VALUES (%s, %s, %s, %s, %s, %s, %s)
        """, records)

    def get_document_passages(self, document_id: str) -> List[Dict[str, Any]]:
        """Ambil seluruh passage dari satu dokumen."""
        return self._fetchall("""
        SELECT id, document_id, page_number, passage_index, passage_text, embedding_json, created_at
        FROM document_passages
        WHERE document_id = %s
        ORDER BY page_number ASC, passage_index ASC
        """, (document_id,))

    def get_user_passages(self, user_id: str) -> List[Dict[str, Any]]:
        """Ambil seluruh passage dari semua dokumen milik pengguna (Multi-Tenant Isolation)."""
        return self._fetchall("""
        SELECT p.id, p.document_id, ud.title_alias AS document_title, p.page_number, 
               p.passage_index, p.passage_text, p.embedding_json, p.created_at
        FROM document_passages p
        JOIN user_documents ud ON p.document_id = ud.document_id
        WHERE ud.user_id = %s
        ORDER BY ud.created_at DESC, p.page_number ASC, p.passage_index ASC
        """, (user_id,))

    def save_figures(self, document_id: str, figures_data: List[Dict[str, Any]]) -> None:
        """Simpan metadata gambar/kurva/diagram yang dipotong dari PDF."""
        if not figures_data:
            return
        records = [
            (str(uuid.uuid4()), document_id, f["page_number"], f["figure_index"], f["image_filename"], f.get("caption", ""))
            for f in figures_data
        ]
        self._executemany("""
        INSERT INTO document_figures (id, document_id, page_number, figure_index, image_filename, caption)
        VALUES (%s, %s, %s, %s, %s, %s)
        """, records)

    def get_figures_for_pages(self, document_id: str, page_numbers: List[int]) -> List[Dict[str, Any]]:
        """Ambil gambar yang berada pada halaman-halaman yang direferensikan."""
        if not page_numbers:
            return []
        placeholders = ",".join(["%s"] * len(page_numbers))
        query = f"""
        SELECT document_id, page_number, figure_index, image_filename, caption
        FROM document_figures
        WHERE document_id = %s AND page_number IN ({placeholders})
        ORDER BY page_number ASC, figure_index ASC
        """
        rows = self._fetchall(query, tuple([document_id] + page_numbers))
        return [dict(r) for r in rows]

    def get_figures_for_document(self, document_id: str, limit: int = 4) -> List[Dict[str, Any]]:
        """Ambil cuplikan gambar dari dokumen tertentu saat diminta secara eksplisit."""
        query = """
        SELECT document_id, page_number, figure_index, image_filename, caption
        FROM document_figures
        WHERE document_id = %s
        ORDER BY page_number ASC, figure_index ASC
        LIMIT %s
        """
        rows = self._fetchall(query, (document_id, limit))
        return [dict(r) for r in rows]

    def get_document_id_for_figure(self, filename: str) -> Optional[str]:
        """Dapatkan document_id pemilik dari nama file gambar potongan figure."""
        row = self._fetchone("SELECT document_id FROM document_figures WHERE image_filename = %s", (filename,))
        if row:
            return row.get("document_id")
        return None

    # --- CHAT SESSIONS & CONVERSATION HISTORY ---
    def check_user_owns_session(self, user_id: str, session_id: str) -> bool:
        """Periksa apakah user memiliki hak akses atas sesi percakapan tertentu."""
        row = self._fetchone("SELECT id FROM chat_sessions WHERE id = %s AND user_id = %s", (session_id, user_id))
        return bool(row)

    def create_chat_session(self, user_id: str, title: str = "Percakapan Baru") -> Dict[str, Any]:
        """Buat sesi percakapan baru untuk user."""
        session_id = str(uuid.uuid4())
        now_iso = datetime.now().isoformat()
        sql = "INSERT INTO chat_sessions (id, user_id, title, created_at, updated_at) VALUES (%s, %s, %s, %s, %s)"
        self._execute(sql, (session_id, user_id, title, now_iso, now_iso))
        return {
            "id": session_id,
            "user_id": user_id,
            "title": title,
            "created_at": now_iso,
            "updated_at": now_iso
        }

    def list_chat_sessions(self, user_id: str) -> List[Dict[str, Any]]:
        """Daftar riwayat sesi percakapan milik pengguna, diurutkan dari yang terbaru."""
        sql = "SELECT id, user_id, title, created_at, updated_at FROM chat_sessions WHERE user_id = %s ORDER BY updated_at DESC"
        return self._fetchall(sql, (user_id,))

    def delete_chat_session(self, user_id: str, session_id: str) -> bool:
        """Hapus sesi percakapan beserta seluruh pesannya HANYA jika sesi adalah milik pengguna."""
        if not self.check_user_owns_session(user_id, session_id):
            return False
        self._execute("DELETE FROM chat_messages WHERE session_id = %s", (session_id,))
        self._execute("DELETE FROM chat_sessions WHERE id = %s AND user_id = %s", (session_id, user_id))
        return True


    def save_chat_message(self, session_id: str, sender: str, text: str, citations: list = None, figures: list = None, attachments: list = None) -> Dict[str, Any]:
        """Simpan satu pesan ke dalam sesi percakapan, termasuk sitasi, figur, dan lampiran."""
        import json
        msg_id = str(uuid.uuid4())
        now_iso = datetime.now().isoformat()
        cit_json = json.dumps(citations or [])
        fig_json = json.dumps(figures or [])
        att_json = json.dumps(attachments or [])
        try:
            sql = """
            INSERT INTO chat_messages (id, session_id, sender, text, citations_json, figures_json, attachments_json, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            """
            self._execute(sql, (msg_id, session_id, sender, text, cit_json, fig_json, att_json, now_iso))
        except Exception:
            # Fallback jika kolom attachments_json belum terindeks
            fallback_sql = """
            INSERT INTO chat_messages (id, session_id, sender, text, citations_json, figures_json, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            """
            self._execute(fallback_sql, (msg_id, session_id, sender, text, cit_json, fig_json, now_iso))

        self._execute("UPDATE chat_sessions SET updated_at = %s WHERE id = %s", (now_iso, session_id))
        return {
            "id": msg_id,
            "session_id": session_id,
            "sender": sender,
            "text": text,
            "citations": citations or [],
            "figures": figures or [],
            "attachments": attachments or [],
            "created_at": now_iso
        }

    def get_chat_messages(self, session_id: str) -> List[Dict[str, Any]]:
        """Ambil seluruh urutan pesan dalam sesi percakapan beserta lampiran dan sitasi."""
        import json
        try:
            sql = "SELECT id, session_id, sender, text, citations_json, figures_json, attachments_json, created_at FROM chat_messages WHERE session_id = %s ORDER BY created_at ASC"
            rows = self._fetchall(sql, (session_id,))
        except Exception:
            sql = "SELECT id, session_id, sender, text, citations_json, figures_json, created_at FROM chat_messages WHERE session_id = %s ORDER BY created_at ASC"
            rows = self._fetchall(sql, (session_id,))

        messages = []
        for r in rows:
            cit = []
            fig = []
            att = []
            try:
                if r.get("citations_json"):
                    cit = json.loads(r["citations_json"])
            except Exception:
                pass
            try:
                if r.get("figures_json"):
                    fig = json.loads(r["figures_json"])
            except Exception:
                pass
            try:
                if r.get("attachments_json"):
                    att = json.loads(r["attachments_json"])
            except Exception:
                pass

            messages.append({
                "id": r["id"],
                "session_id": r["session_id"],
                "sender": r["sender"],
                "text": r["text"],
                "citations": cit,
                "figures": fig,
                "attachments": att,
                "timestamp": r["created_at"]
            })
        return messages

    def update_chat_session_title(self, session_id: str, title: str, user_id: Optional[str] = None) -> bool:
        """Perbarui judul sesi percakapan sesuai konteks pertanyaan pertama."""
        if user_id:
            if not self.check_user_owns_session(user_id, session_id):
                return False
            self._execute("UPDATE chat_sessions SET title = %s, updated_at = %s WHERE id = %s AND user_id = %s", (title, datetime.now().isoformat(), session_id, user_id))
        else:
            self._execute("UPDATE chat_sessions SET title = %s, updated_at = %s WHERE id = %s", (title, datetime.now().isoformat(), session_id))
        return True

