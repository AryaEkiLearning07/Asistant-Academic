import json
import logging
import math
from typing import List, Dict, Any, Optional

from app.config import ROOT_DIR

logger = logging.getLogger("epiona.embedding_service")

class EmbeddingService:
    """Layanan embedding vektor multibahasa lokal (sentence-transformers / BAAI/bge-m3).
    
    Bersifat opsional dan non-blocking:
    - Jika EMBEDDING_MODEL tidak disetel atau sentence-transformers tidak terpasang,
      is_available() bernilai False dan sistem fallback ke BM25 leksikal murni.
    - Model di-cache secara singleton lazy-loaded untuk menghemat waktu inisialisasi.
    """
    _model_instance = None
    _model_name: Optional[str] = None
    _load_failed: bool = False

    @classmethod
    def get_model_name(cls) -> Optional[str]:
        import os
        from app.config import ROOT_DIR
        model_name = os.getenv("EMBEDDING_MODEL", "").strip()
        return model_name if model_name else None

    @classmethod
    def is_available(cls) -> bool:
        model_name = cls.get_model_name()
        if not model_name or cls._load_failed:
            return False
        try:
            import sentence_transformers
            return True
        except ImportError:
            return False

    @classmethod
    def get_model(cls):
        if not cls.is_available():
            return None
        model_name = cls.get_model_name()
        if cls._model_instance is not None and cls._model_name == model_name:
            return cls._model_instance

        try:
            from sentence_transformers import SentenceTransformer
            logger.info(f"Memuat model embedding lokal: {model_name}...")
            cls._model_instance = SentenceTransformer(model_name)
            cls._model_name = model_name
            return cls._model_instance
        except Exception as e:
            logger.warning(f"Gagal memuat model embedding {model_name}: {e}. Fallback ke BM25.")
            cls._load_failed = True
            cls._model_instance = None
            return None

    @classmethod
    def encode_text(cls, text: str) -> Optional[List[float]]:
        if not text or not text.strip():
            return None
        model = cls.get_model()
        if model is None:
            return None
        try:
            vec = model.encode(text.strip(), normalize_embeddings=True)
            return [float(x) for x in vec]
        except Exception as e:
            logger.warning(f"Gagal melakukan embedding teks: {e}")
            return None

    @classmethod
    def encode_batch(cls, texts: List[str]) -> Optional[List[List[float]]]:
        if not texts:
            return []
        model = cls.get_model()
        if model is None:
            return None
        try:
            vecs = model.encode(texts, normalize_embeddings=True, show_progress_bar=False)
            return [[float(x) for x in v] for v in vecs]
        except Exception as e:
            logger.warning(f"Gagal melakukan batch embedding: {e}")
            return None

    @staticmethod
    def cosine_similarity(vec_a: List[float], vec_b: List[float]) -> float:
        """Menghitung cosine similarity antara dua vektor float (dengan fallback pure python)."""
        if not vec_a or not vec_b or len(vec_a) != len(vec_b):
            return 0.0
        try:
            dot = sum(a * b for a, b in zip(vec_a, vec_b))
            norm_a = math.sqrt(sum(a * a for a in vec_a))
            norm_b = math.sqrt(sum(b * b for b in vec_b))
            if norm_a == 0.0 or norm_b == 0.0:
                return 0.0
            return float(dot / (norm_a * norm_b))
        except Exception:
            return 0.0

    @classmethod
    def reset_instance_for_testing(cls):
        """Khusus untuk mock dan pengujian unit."""
        cls._model_instance = None
        cls._model_name = None
        cls._load_failed = False
