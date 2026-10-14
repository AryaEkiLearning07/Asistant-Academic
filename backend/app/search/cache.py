import json
import logging
import re
import sqlite3
import time
from pathlib import Path
from typing import List, Optional
from app.config import SEARCH_CACHE_DB, SEARCH_CACHE_TTL
from app.search.models import SearchResult

logger = logging.getLogger(__name__)

class SearchCache:
    """
    Cache hasil pencarian persisten berbasis SQLite dengan dukungan TTL (Time-To-Live).
    Kueri dinormalisasi sebelum lookup/penyimpanan untuk memaksimalkan cache hit.
    """

    def __init__(self, db_path: Optional[Path] = None, default_ttl: int = SEARCH_CACHE_TTL):
        self.db_path = Path(db_path) if db_path else SEARCH_CACHE_DB
        self.default_ttl = default_ttl
        self._init_db()

    def _get_connection(self) -> sqlite3.Connection:
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        conn = sqlite3.connect(str(self.db_path), timeout=10)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_db(self):
        try:
            with self._get_connection() as conn:
                conn.execute("""
                    CREATE TABLE IF NOT EXISTS search_cache (
                        query_normalized TEXT PRIMARY KEY,
                        results_json TEXT NOT NULL,
                        created_at REAL NOT NULL,
                        expires_at REAL NOT NULL
                    )
                """)
                conn.execute("""
                    CREATE INDEX IF NOT EXISTS idx_search_cache_expires 
                    ON search_cache (expires_at)
                """)
                conn.commit()
        except Exception as e:
            logger.error(f"[SearchCache] Init error: {e}")

    @staticmethod
    def normalize_query(query: str) -> str:
        """Menghilangkan tanda baca berlebih dan menormalisasi spasi kueri."""
        if not query:
            return ""
        q = query.lower().strip()
        q = re.sub(r"[^\w\s-]", " ", q)
        q = re.sub(r"\s+", " ", q).strip()
        return q

    def get(self, query: str) -> Optional[List[SearchResult]]:
        norm_q = self.normalize_query(query)
        if not norm_q:
            return None

        now = time.time()
        try:
            with self._get_connection() as conn:
                cursor = conn.execute(
                    "SELECT results_json, expires_at FROM search_cache WHERE query_normalized = ?",
                    (norm_q,)
                )
                row = cursor.fetchone()
                if not row:
                    return None

                if row["expires_at"] < now:
                    # Sudah kadaluarsa, hapus dari database
                    conn.execute("DELETE FROM search_cache WHERE query_normalized = ?", (norm_q,))
                    conn.commit()
                    return None

                data = json.loads(row["results_json"])
                return [SearchResult(**item) for item in data]
        except Exception as e:
            logger.warning(f"[SearchCache] Get error: {e}")
            return None

    def set(self, query: str, results: List[SearchResult], ttl_seconds: Optional[int] = None) -> None:
        norm_q = self.normalize_query(query)
        if not norm_q or not results:
            return

        ttl = ttl_seconds if ttl_seconds is not None else self.default_ttl
        now = time.time()
        expires_at = now + ttl

        try:
            payload = json.dumps([r.model_dump() if hasattr(r, "model_dump") else r.dict() for r in results])
            with self._get_connection() as conn:
                conn.execute("""
                    INSERT OR REPLACE INTO search_cache (query_normalized, results_json, created_at, expires_at)
                    VALUES (?, ?, ?, ?)
                """, (norm_q, payload, now, expires_at))
                conn.commit()
        except Exception as e:
            logger.warning(f"[SearchCache] Set error: {e}")

    def clear_expired(self) -> int:
        now = time.time()
        try:
            with self._get_connection() as conn:
                cursor = conn.execute("DELETE FROM search_cache WHERE expires_at < ?", (now,))
                deleted = cursor.rowcount
                conn.commit()
                return deleted
        except Exception as e:
            logger.warning(f"[SearchCache] Clear expired error: {e}")
            return 0
