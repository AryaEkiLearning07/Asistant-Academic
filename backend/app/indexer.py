import re
import math
from typing import List, Dict, Any, Optional

class DocumentSearchIndex:
    """Mesin penelusuran leksikal & term-weighting cepat untuk potongan teks halaman farmasi."""

    @staticmethod
    def _tokenize(text: str) -> List[str]:
        return [w.lower() for w in re.findall(r"\b\w{3,}\b", text)]

    INDONESIAN_ENGLISH_STOPWORDS = {
        "yang", "untuk", "pada", "adalah", "dengan", "dan", "dari", "dalam", "ini", "itu",
        "atau", "oleh", "juga", "akan", "bisa", "dapat", "saya", "kamu", "anda", "kami",
        "kita", "mereka", "apakah", "bagaimana", "kenapa", "mengapa", "dimana", "kapan",
        "siapa", "ada", "tidak", "bukan", "hanya", "sudah", "belum", "lagi", "secara",
        "serta", "karena", "seperti", "sebagai", "tentang", "tersebut", "jelaskan", "sebutkan",
        "the", "and", "for", "with", "from", "that", "this", "which", "are", "was",
        "were", "what", "how", "why", "where", "when", "can", "could", "will", "would"
    }

    TYPO_CORRECTIONS = {
        "aambilkan": "ambilkan",
        "ambillkan": "ambilkan",
        "ambilkann": "ambilkan",
        "gamabr": "gambar",
        "gambarr": "gambar",
        "gmbr": "gambar",
        "kmau": "kamu",
        "kmauu": "kamu",
        "siaapa": "siapa",
        "papper": "paper",
        "dengn": "dengan",
        "berpa": "berapa",
        "tujuanya": "tujuannya"
    }

    @classmethod
    def normalize_query(cls, query: str) -> str:
        words = query.strip().split()
        return " ".join([cls.TYPO_CORRECTIONS.get(w.lower(), w) for w in words])

    @classmethod
    def _extract_content_terms(cls, text: str) -> List[str]:
        tokens = [w.lower() for w in re.findall(r"\b\w{3,}\b", text)]
        return [t for t in tokens if t not in cls.INDONESIAN_ENGLISH_STOPWORDS]

    @classmethod
    def search_pages(
        cls,
        query: str,
        pages_corpus: List[Dict[str, Any]],
        top_k: int = 5,
        min_relevance_score: float = 0.05
    ) -> List[Dict[str, Any]]:
        """Mencari halaman paling relevan dari korpus berdasarkan bobot istilah BM25-lite.
        
        Menerapkan STRICT OUT-OF-CONTEXT ISOLATION:
        1. Mengabaikan stopwords umum agar tidak mencocokkan kata kebetulan.
        2. Mewajibkan kecocokan istilah esensial atau pencocokan frasa eksak.
        3. Menolak halaman dengan skor di bawah ambang batas (min_relevance_score).
        """
        content_query_terms = cls._extract_content_terms(query)
        # Jika semua kata tergolong stopwords, gunakan tokenisasi standar
        query_terms = content_query_terms if content_query_terms else cls._tokenize(query)
        if not query_terms or not pages_corpus:
            return []

        clean_query = query.strip().lower()
        has_multi_word_query = len(query_terms) >= 2

        scored_results = []
        for item in pages_corpus:
            text = item.get("text", "")
            if not text:
                continue

            page_tokens = cls._tokenize(text)
            if not page_tokens:
                continue

            token_count = len(page_tokens)
            score = 0.0
            matched_terms = 0

            # Hitung skor pencocokan istilah
            for term in query_terms:
                term_occurrences = page_tokens.count(term)
                if term_occurrences > 0:
                    matched_terms += 1
                    tf = term_occurrences / token_count
                    score += tf * (1.0 + math.log(1 + term_occurrences))

            # Bonus pencocokan frasa eksak jika kueri cukup spesifik
            if len(clean_query) >= 5 and clean_query in text.lower():
                score += 2.5
                matched_terms = max(matched_terms, len(query_terms))

            # STRICT ISOLATION FILTER:
            # - Jika kueri terdiri dari 2+ kata esensial, tolak halaman jika hanya 0 istilah cocok
            # - Tolak jika skor di bawah ambang batas minimum
            if matched_terms == 0 or score < min_relevance_score:
                continue

            # Untuk kueri jamak (>= 3 kata kunci), minimal harus cocok 2 istilah ATAU memiliki frasa eksak
            if len(query_terms) >= 3 and matched_terms < 2 and clean_query not in text.lower():
                continue

            scored_results.append({
                "score": score,
                "document_id": item.get("document_id"),
                "document_title": item.get("document_title"),
                "page_number": item.get("page_number"),
                "text": text
            })

        # Urutkan berdasarkan skor tertinggi
        scored_results.sort(key=lambda x: x["score"], reverse=True)
        return scored_results[:top_k]
