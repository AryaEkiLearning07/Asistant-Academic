import re
import math
import logging
from typing import List, Dict, Any, Optional

from app.embedding_service import EmbeddingService
from app.reranker_service import RerankerService

logger = logging.getLogger("epiona.indexer")


class SafeStemmer:
    """Stemmer aman untuk Bahasa Indonesia dan peristilahan farmasi / medis / sains.
    
    Menyelesaikan cacat stemming leksikal naif:
    1. Melindungi kata dasar agar tidak terpotong keliru (contoh: masalah -> masa, proses -> pros).
    2. Menyelaraskan istilah serapan farmasi / sains berakhiran -ika dan -ik menjadi bentuk kanonikal
       yang sama (contoh: farmakokinetika vs farmakokinetik -> farmakokinetik).
    3. Mendukung PySastrawi secara dinamis jika terpasang di environment dengan filter proteksi.
    """
    
    # Kata dasar yang dilindungi dari pemotongan akhiran / partikel sembarangan
    PROTECTED_ROOT_WORDS = {
        "masalah", "masa", "proses", "sukses", "akses", "stres", "protes",
        "diabetes", "spesies", "analisis", "diagnosis", "prognosis", "dosis",
        "sintesis", "hipotesis", "metastasis", "osmosis", "basis", "krisis",
        "paralisis", "tesis", "katalisis", "hidrolisis", "glikolisis",
        "trombosis", "nekrosis", "sklerosis", "aplasia", "displasia",
        "plasma", "asma", "trauma", "koma", "stoma", "glaukoma",
        "formula", "selula", "kapsula", "ampula", "vaksin", "toksin"
    }

    # Istilah farmasi/sains yang variasi akhiran -ika / -ik diselaraskan ke bentuk kanonikal
    PHARMA_CANONICAL_MAP = {
        "farmakokinetika": "farmakokinetik",
        "farmakokinetik": "farmakokinetik",
        "farmakodinamika": "farmakodinamik",
        "farmakodinamik": "farmakodinamik",
        "biofarmasetika": "biofarmasetik",
        "biofarmasetik": "biofarmasetik",
        "farmasetika": "farmasetik",
        "farmasetik": "farmasetik",
        "terapeutika": "terapeutik",
        "terapeutik": "terapeutik",
        "karakteristika": "karakteristik",
        "karakteristik": "karakteristik",
        "analitika": "analitik",
        "analitik": "analitik",
        "matematika": "matematik",
        "matematik": "matematik",
        "informatika": "informatik",
        "informatik": "informatik",
        "genetika": "genetik",
        "genetik": "genetik",
        "diagnostika": "diagnostik",
        "diagnostik": "diagnostik",
        "antibiotika": "antibiotik",
        "antibiotik": "antibiotik",
        "sitotoksika": "sitotoksik",
        "sitotoksik": "sitotoksik",
        "statistika": "statistik",
        "statistik": "statistik"
    }

    _sastrawi_stemmer = None
    _sastrawi_checked = False

    @classmethod
    def _get_sastrawi(cls):
        if not cls._sastrawi_checked:
            cls._sastrawi_checked = True
            try:
                from Sastrawi.Stemmer.StemmerFactory import StemmerFactory
                factory = StemmerFactory()
                cls._sastrawi_stemmer = factory.create_stemmer()
            except ImportError:
                cls._sastrawi_stemmer = None
        return cls._sastrawi_stemmer

    @classmethod
    def stem_word(cls, word: str) -> str:
        w = word.strip().lower()
        if not w or len(w) <= 2:
            return w

        # 1. Cek penyelarasan istilah farmasi/sains kanonikal
        if w in cls.PHARMA_CANONICAL_MAP:
            return cls.PHARMA_CANONICAL_MAP[w]

        # 2. Cek apakah kata termasuk dalam daftar kata dasar yang dilindungi
        if w in cls.PROTECTED_ROOT_WORDS:
            return w

        # 3. Jika PySastrawi tersedia, gunakan dengan perlindungan kata farmasi/dasar
        sastrawi = cls._get_sastrawi()
        if sastrawi is not None:
            stemmed = sastrawi.stem(w)
            # Hindari over-stemming Sastrawi jika hasil merusak istilah
            if stemmed in cls.PROTECTED_ROOT_WORDS or len(stemmed) >= 3:
                return stemmed

        # 4. Fallback Rule-based Stemmer yang aman (non-destructive)
        # Tangani partikel penegas: -kah, -lah, -tah, -pun (hanya jika kata bukan dilindungi dan sisa >= 4)
        for part in ["kah", "lah", "tah", "pun"]:
            if w.endswith(part) and len(w) - len(part) >= 4 and w not in cls.PROTECTED_ROOT_WORDS:
                candidate = w[:-len(part)]
                if candidate in cls.PROTECTED_ROOT_WORDS or candidate in cls.PHARMA_CANONICAL_MAP:
                    return cls.PHARMA_CANONICAL_MAP.get(candidate, candidate)
                w = candidate
                break

        # Tangani kata ganti milik: -ku, -mu, -nya (hanya jika sisa >= 4)
        for pron in ["nya", "ku", "mu"]:
            if w.endswith(pron) and len(w) - len(pron) >= 4 and w not in cls.PROTECTED_ROOT_WORDS:
                candidate = w[:-len(pron)]
                if candidate in cls.PROTECTED_ROOT_WORDS or candidate in cls.PHARMA_CANONICAL_MAP:
                    return cls.PHARMA_CANONICAL_MAP.get(candidate, candidate)
                w = candidate
                break

        # Tangani akhiran serapan umum sains/farmasi: -ika -> -ik
        if w.endswith("ika") and len(w) >= 6:
            candidate = w[:-1]  # ubah -ika jadi -ik
            return candidate

        return w


def chunk_text_to_passages(text: str, chunk_size: int = 800, overlap: int = 150) -> List[str]:
    """Memecah teks satu halaman menjadi potongan passage terstruktur dengan overlap kalimat."""
    clean = text.strip()
    if not clean:
        return []
    if len(clean) <= chunk_size:
        return [clean]

    # Pecah per paragraf atau baris
    paragraphs = re.split(r"\n\s*\n", clean)
    passages = []
    current_chunk = []
    current_len = 0

    for para in paragraphs:
        p_clean = para.strip()
        if not p_clean:
            continue
        p_len = len(p_clean)

        if current_len + p_len <= chunk_size:
            current_chunk.append(p_clean)
            current_len += p_len + 2
        else:
            if current_chunk:
                passages.append("\n\n".join(current_chunk))
            # Buat chunk baru dengan carry-over overlap kalimat jika memungkinkan
            if p_len <= chunk_size:
                current_chunk = [p_clean]
                current_len = p_len
            else:
                # Paragraf tunggal yang sangat panjang: potong per batas kalimat
                sentences = re.split(r"(?<=[.!?])\s+", p_clean)
                sub_chunk = []
                sub_len = 0
                for s in sentences:
                    s_clean = s.strip()
                    if not s_clean:
                        continue
                    if sub_len + len(s_clean) <= chunk_size:
                        sub_chunk.append(s_clean)
                        sub_len += len(s_clean) + 1
                    else:
                        if sub_chunk:
                            passages.append(" ".join(sub_chunk))
                        sub_chunk = [s_clean]
                        sub_len = len(s_clean)
                if sub_chunk:
                    passages.append(" ".join(sub_chunk))
                current_chunk = []
                current_len = 0

    if current_chunk:
        passages.append("\n\n".join(current_chunk))

    return passages if passages else [clean]


class DocumentSearchIndex:
    """Mesin penelusuran leksikal & hybrid term-weighting untuk naskah akademik farmasi."""

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
        "tujuanya": "tujuannya",
        "menciptkaan": "menciptakan",
        "mencipatakan": "menciptakan",
        "menciptkn": "menciptakan",
        "ciptakan": "menciptakan",
        "pembaaut": "membuat",
        "mmbuat": "membuat",
        "bikiin": "bikin"
    }

    @classmethod
    def _stem(cls, word: str) -> str:
        return SafeStemmer.stem_word(word)

    @classmethod
    def _tokenize(cls, text: str, stem: bool = True) -> List[str]:
        words = [w.lower() for w in re.findall(r"\b\w{3,}\b", text)]
        if stem:
            return [cls._stem(w) for w in words]
        return words

    @classmethod
    def normalize_query(cls, query: str) -> str:
        words = query.strip().split()
        return " ".join([cls.TYPO_CORRECTIONS.get(w.lower(), w) for w in words])

    @classmethod
    def _extract_content_terms(cls, text: str, stem: bool = True) -> List[str]:
        raw_words = [w.lower() for w in re.findall(r"\b\w{3,}\b", text)]
        filtered = [w for w in raw_words if w not in cls.INDONESIAN_ENGLISH_STOPWORDS]
        if stem:
            return [cls._stem(w) for w in filtered]
        return filtered

    @classmethod
    def search_pages(
        cls,
        query: str,
        pages_corpus: List[Dict[str, Any]],
        top_k: int = 5,
        min_relevance_score: float = 0.05,
        preferred_document_id: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Mencari halaman paling relevan dari korpus menggunakan BM25-lite dengan stemming aman."""
        content_query_terms = cls._extract_content_terms(query, stem=True)
        query_terms = content_query_terms if content_query_terms else cls._tokenize(query, stem=True)
        if not query_terms or not pages_corpus:
            return []

        clean_query = query.strip().lower()
        scored_results = []

        for item in pages_corpus:
            text = item.get("text") or item.get("passage_text") or ""
            if not text:
                continue

            page_tokens = cls._tokenize(text, stem=True)
            if not page_tokens:
                continue

            token_count = len(page_tokens)
            score = 0.0
            matched_terms = 0

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

            # STRICT ISOLATION FILTER (Anti-Halusinasi):
            # Tolak jika tidak ada kecocokan istilah atau skor di bawah ambang batas
            if matched_terms == 0 or score < min_relevance_score:
                continue

            # Untuk kueri jamak (>= 3 kata kunci), minimal harus cocok 2 istilah ATAU memiliki frasa eksak
            if len(query_terms) >= 3 and matched_terms < 2 and clean_query not in text.lower():
                continue

            # Soft boost jika modul sedang dibuka pengguna
            if preferred_document_id and item.get("document_id") == preferred_document_id:
                score += 0.35

            res_entry = dict(item)
            res_entry["score"] = score
            scored_results.append(res_entry)

        scored_results.sort(key=lambda x: x["score"], reverse=True)
        return scored_results[:top_k]

    @staticmethod
    def reciprocal_rank_fusion(
        ranked_lists: List[List[Dict[str, Any]]],
        k: int = 60,
        top_k: int = 20
    ) -> List[Dict[str, Any]]:
        """Menggabungkan peringkat beberapa sistem penelusuran menggunakan Reciprocal Rank Fusion (RRF).
        
        Formula RRF: RRF_score(d) = sum(1 / (k + rank_i(d)))
        """
        if not ranked_lists:
            return []
        if len(ranked_lists) == 1:
            return ranked_lists[0][:top_k]

        fused_scores: Dict[str, float] = {}
        item_map: Dict[str, Dict[str, Any]] = {}

        for rank_list in ranked_lists:
            for rank_idx, item in enumerate(rank_list, start=1):
                # Buat identifier unik per passage atau halaman
                doc_id = item.get("document_id", "")
                page_num = item.get("page_number", 1)
                passage_idx = item.get("passage_index", 0)
                item_key = f"{doc_id}:p{page_num}:s{passage_idx}"

                if item_key not in item_map:
                    item_map[item_key] = dict(item)

                fused_scores[item_key] = fused_scores.get(item_key, 0.0) + (1.0 / (k + rank_idx))

        sorted_keys = sorted(fused_scores.keys(), key=lambda x: fused_scores[x], reverse=True)
        results = []
        for key in sorted_keys[:top_k]:
            entry = dict(item_map[key])
            entry["rrf_score"] = fused_scores[key]
            results.append(entry)

        return results

    @classmethod
    def search_hybrid(
        cls,
        query: str,
        passages_corpus: List[Dict[str, Any]],
        top_k: int = 6,
        candidate_k: int = 20,
        min_relevance_score: float = 0.05,
        preferred_document_id: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Pencarian Hybrid: BM25 leksikal + Vektor Semantik (RRF) + Reranker Opsional.
        
        Jika embedding tidak tersedia atau passages belum ber-embedding,
        fungsi ini otomatis fallback ke BM25 leksikal secara transparan.
        """
        if not passages_corpus or not query.strip():
            return []

        # 1. Penelusuran Leksikal BM25 (mengambil candidate_k peringkat teratas)
        bm25_candidates = cls.search_pages(
            query=query,
            pages_corpus=passages_corpus,
            top_k=candidate_k,
            min_relevance_score=min_relevance_score,
            preferred_document_id=preferred_document_id
        )

        # 2. Penelusuran Vektor Semantik (hanya jika EmbeddingService aktif dan corpus memiliki embedding)
        vector_candidates = []
        if EmbeddingService.is_available():
            q_emb = EmbeddingService.encode_text(query)
            if q_emb:
                vector_scored = []
                import json
                for item in passages_corpus:
                    emb_raw = item.get("embedding_json")
                    if not emb_raw:
                        continue
                    try:
                        p_emb = json.loads(emb_raw) if isinstance(emb_raw, str) else emb_raw
                        sim = EmbeddingService.cosine_similarity(q_emb, p_emb)
                        if sim > 0.20:  # Threshold kecocokan semantik minimum
                            item_copy = dict(item)
                            item_copy["vector_score"] = sim
                            vector_scored.append(item_copy)
                    except Exception:
                        continue

                vector_scored.sort(key=lambda x: x["vector_score"], reverse=True)
                vector_candidates = vector_scored[:candidate_k]

        # 3. Fusi Hasil Peringkat (Reciprocal Rank Fusion)
        if vector_candidates:
            fused_candidates = cls.reciprocal_rank_fusion(
                [bm25_candidates, vector_candidates],
                k=60,
                top_k=candidate_k
            )
        else:
            # Fallback jika model vektor tidak disetel / tidak terpasang
            fused_candidates = bm25_candidates

        if not fused_candidates:
            return []

        # 4. Reranking Opsional (BAAI/bge-reranker-v2-m3 jika disetel di env)
        if RerankerService.is_available():
            final_results = RerankerService.rerank(
                query=query,
                candidates=fused_candidates[:candidate_k],
                top_k=top_k
            )
        else:
            final_results = fused_candidates[:top_k]

        return final_results
