import logging
import os
from typing import List, Dict, Any, Optional

logger = logging.getLogger("epiona.reranker_service")

class RerankerService:
    """Layanan reranking opsional berbasis Cross-Encoder (misal BAAI/bge-reranker-v2-m3).
    
    Digunakan untuk meranking ulang top-20 kandidat hasil hybrid retrieval menjadi top-6.
    Jika RERANKER_MODEL tidak disetel atau pustaka tidak tersedia, lewati reranking secara transparan.
    """
    _model_instance = None
    _model_name: Optional[str] = None
    _load_failed: bool = False

    @classmethod
    def get_model_name(cls) -> Optional[str]:
        model_name = os.getenv("RERANKER_MODEL", "").strip()
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
            from sentence_transformers import CrossEncoder
            logger.info(f"Memuat model reranker lokal: {model_name}...")
            cls._model_instance = CrossEncoder(model_name)
            cls._model_name = model_name
            return cls._model_instance
        except Exception as e:
            logger.warning(f"Gagal memuat CrossEncoder {model_name}: {e}. Reranking dilewati.")
            cls._load_failed = True
            cls._model_instance = None
            return None

    @classmethod
    def rerank(
        cls,
        query: str,
        candidates: List[Dict[str, Any]],
        top_k: int = 6
    ) -> List[Dict[str, Any]]:
        """Meringkas dan memeringkat ulang kandidat (misal top-20 menjadi top-6).
        
        Jika reranker aktif, hitung skor pair (query, passage_text).
        Jika tidak aktif, kembalikan top_k kandidat pertama dari input.
        """
        if not candidates:
            return []
        if len(candidates) <= top_k and not cls.is_available():
            return candidates[:top_k]

        model = cls.get_model()
        if model is None:
            return candidates[:top_k]

        try:
            pairs = []
            for item in candidates:
                txt = item.get("passage_text") or item.get("text") or ""
                pairs.append([query, txt])

            scores = model.predict(pairs, show_progress_bar=False)
            scored_candidates = []
            for idx, item in enumerate(candidates):
                item_copy = dict(item)
                item_copy["rerank_score"] = float(scores[idx])
                scored_candidates.append(item_copy)

            scored_candidates.sort(key=lambda x: x.get("rerank_score", 0.0), reverse=True)
            return scored_candidates[:top_k]
        except Exception as e:
            logger.warning(f"Error saat komputasi reranking: {e}. Fallback ke urutan asli.")
            return candidates[:top_k]

    @classmethod
    def reset_instance_for_testing(cls):
        """Khusus untuk mock dan pengujian unit."""
        cls._model_instance = None
        cls._model_name = None
        cls._load_failed = False
