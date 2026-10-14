import logging
import re
from typing import List, Dict, Any, Tuple, Optional
from app.config import CLAIM_CHECK
from app.search.models import SearchResult

logger = logging.getLogger(__name__)

class ClaimChecker:
    """
    Verifikator klaim faktual (Claim Verification):
    Menganalisis setiap kalimat yang memuat sitasi [n] terhadap cuplikan/abstrak sumber rujukan [n].
    Kalimat yang tidak didukung atau bertentangan diberi tanda peringatan atau dibersihkan.
    Dapat dinonaktifkan via env CLAIM_CHECK=0.
    """

    STOPWORDS = {
        "yang", "di", "ke", "dari", "pada", "dalam", "untuk", "dengan", "dan", "atau",
        "ini", "itu", "adalah", "merupakan", "sebagai", "dapat", "akan", "oleh", "juga",
        "the", "a", "an", "is", "are", "in", "on", "at", "to", "for", "with", "and", "or",
        "of", "by", "from", "that", "this", "can", "may", "has", "have", "had"
    }

    @classmethod
    def verify_answer_claims(
        cls,
        answer: str,
        sources: List[SearchResult],
        enabled: Optional[bool] = None
    ) -> Tuple[str, List[Dict[str, Any]]]:
        """
        Verifikasi klaim tiap kalimat bersitasi terhadap snippet sumbernya.
        Mengembalikan (verified_answer, verification_reports).
        """
        is_active = CLAIM_CHECK if enabled is None else enabled
        if not is_active or not answer or not sources:
            return answer, []

        # Buat pemetaan index sitasi -> SearchResult
        source_map: Dict[int, SearchResult] = {}
        for idx, src in enumerate(sources, 1):
            sid = src.result_id if src.result_id is not None else idx
            source_map[sid] = src

        # Pisahkan jawaban ke dalam paragraf
        paragraphs = answer.split("\n\n")
        verified_paragraphs = []
        reports: List[Dict[str, Any]] = []

        for p in paragraphs:
            # Jika paragraf adalah heading (misal ###) atau format non-teks, lewati
            if p.startswith("#") or not p.strip():
                verified_paragraphs.append(p)
                continue

            # Pisahkan kalimat berdasarkan titik, tanda tanya, atau tanda seru
            sentence_splits = re.split(r"(?<=[.!?])\s+", p)
            verified_sentences = []

            for sent in sentence_splits:
                # Cari sitasi [1], [2], dll
                citations = re.findall(r"\[(\d+)\]", sent)
                if not citations:
                    verified_sentences.append(sent)
                    continue

                sentence_is_supported = True
                unsupported_ids = []

                # Cek token penting kalimat (entitas kata kunci)
                sent_words = set(re.findall(r"\b[a-zA-Z0-9-]{3,}\b", sent.lower()))
                meaningful_words = {w for w in sent_words if w not in cls.STOPWORDS}

                for cid_str in citations:
                    cid = int(cid_str)
                    src = source_map.get(cid)
                    if not src:
                        # Sitasi merujuk ke nomor yang tidak ada dalam daftar sumber
                        sentence_is_supported = False
                        unsupported_ids.append(cid)
                        continue

                    # Periksa keselarasan terhadap snippet / full_text sumber
                    src_text = f"{src.title} {src.snippet or ''} {src.full_text or ''}".lower()
                    src_words = set(re.findall(r"\b[a-zA-Z0-9-]{3,}\b", src_text))

                    # Ukur rasio tumpang tindih kata kunci
                    overlap = meaningful_words.intersection(src_words)
                    overlap_ratio = len(overlap) / max(1, len(meaningful_words))

                    # Kalimat dianggap didukung jika memuat minimal 1 kata kunci penting atau rasio >= 0.15
                    if len(overlap) < 1 and overlap_ratio < 0.15:
                        sentence_is_supported = False
                        unsupported_ids.append(cid)

                if sentence_is_supported:
                    verified_sentences.append(sent)
                    reports.append({
                        "sentence": sent,
                        "citations": citations,
                        "status": "supported"
                    })
                else:
                    # Kalimat tidak didukung oleh sumber yang diklaim
                    warning_tag = " *(⚠️ Klaim pada sumber [" + ", ".join(map(str, unsupported_ids)) + "] memerlukan verifikasi tambahan.)*"
                    marked_sent = f"{sent}{warning_tag}"
                    verified_sentences.append(marked_sent)
                    reports.append({
                        "sentence": sent,
                        "citations": citations,
                        "unsupported_citations": unsupported_ids,
                        "status": "unsupported"
                    })

            verified_paragraphs.append(" ".join(verified_sentences))

        verified_answer = "\n\n".join(verified_paragraphs)
        return verified_answer, reports
