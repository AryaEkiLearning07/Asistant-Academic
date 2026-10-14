import re
from typing import List, Dict, Optional
from urllib.parse import urlparse
from app.search.models import SearchResult

# Bobot Hirarki Bukti Ilmiah Evidence-Based Medicine (EBM)
EVIDENCE_WEIGHTS: Dict[str, float] = {
    "meta_analysis": 0.40,
    "systematic_review": 0.40,
    "rct": 0.30,
    "drug_label": 0.30,
    "guideline": 0.25,
    "document": 0.25,
    "observational": 0.20,
    "review": 0.15,
    "journal": 0.10,
    "web": 0.05,
}

def normalize_doi(doi: Optional[str]) -> Optional[str]:
    if not doi:
        return None
    d = doi.strip().lower()
    # Hapus prefix https://doi.org/ jika ada
    d = re.sub(r"^https?://(?:dx\.)?doi\.org/", "", d)
    return d.strip() or None

def normalize_url(url: Optional[str]) -> Optional[str]:
    if not url:
        return None
    try:
        parsed = urlparse(url.strip().lower())
        netloc = parsed.netloc.replace("www.", "")
        path = parsed.path.rstrip("/")
        return f"{netloc}{path}"
    except Exception:
        return url.strip().lower()

def normalize_title(title: str) -> str:
    if not title:
        return ""
    return re.sub(r"[^\w\s]", "", title.lower()).strip()

def calculate_relevance_score(
    query: str,
    title: str,
    snippet: str,
    full_text: Optional[str] = None,
    key_entities: Optional[List[str]] = None
) -> float:
    """
    Menghitung skor relevansi berbasis:
    1. Kecocokan entitas kunci (key drug entities) pada judul dan cuplikan/abstrak.
       - Jika query memuat entitas obat dan naskah TIDAK memuat entitas tersebut, diberi penalti keras (0.01).
       - Jika naskah memuat multi-entitas (misal warfarin DAN aspirin), diberi bonus ko-okurensi tinggi.
    2. Kecocokan istilah kueri (termasuk padanan ilmiah) terhadap judul (bobot 3.0x) dan cuplikan (1.5x).
    """
    if not query:
        return 0.5

    t_text = (title or "").lower()
    s_text = f"{(snippet or '')} {(full_text or '')}".lower()
    combined_doc = f"{t_text} {s_text}"

    # Ambil entitas kunci obat jika ada
    active_entities = key_entities
    if active_entities is None:
        try:
            from app.search.router import SearchRouter
            active_entities = SearchRouter.extract_drug_entities(query)
        except Exception:
            active_entities = []

    # 1. Evaluasi Entitas Kunci
    entity_score = 0.0
    if active_entities:
        matched_in_title = [e for e in active_entities if re.search(rf"\b{re.escape(e)}\b", t_text)]
        matched_in_doc = [e for e in active_entities if re.search(rf"\b{re.escape(e)}\b", combined_doc)]

        num_matched = len(matched_in_doc)
        if num_matched == 0:
            # Tidak memuat satupun entitas obat yang dicari -> Penalti drastis!
            return 0.01

        # Jika query interaksi / multi-obat (>= 2 entitas):
        if len(active_entities) >= 2:
            if num_matched >= 2:
                # Memuat seluruh entitas kunci (misal warfarin dan aspirin)
                entity_score = 0.45 + (0.20 if len(matched_in_title) >= 1 else 0.0)
            else:
                # Hanya memuat 1 dari 2 entitas obat
                entity_score = 0.15
        else:
            # Single entity query
            entity_score = 0.35 + (0.15 if len(matched_in_title) >= 1 else 0.0)

    # 2. Token Matching (Query Terms + Translated Equivalents)
    try:
        from app.search.router import SearchRouter
        en_query = SearchRouter.translate_to_english_fallback(query)
    except Exception:
        en_query = query

    terms = set(re.findall(r"\b[a-zA-Z0-9-]{3,}\b", f"{query} {en_query}".lower()))
    stop = {"what", "is", "are", "the", "for", "with", "and", "dari", "pada", "yang", "dalam", "dengan"}
    terms = {t for t in terms if t not in stop}

    if not terms:
        return max(0.05, entity_score)

    t_words = set(re.findall(r"\b[a-zA-Z0-9-]{3,}\b", t_text))
    s_words = set(re.findall(r"\b[a-zA-Z0-9-]{3,}\b", s_text))

    title_matches = len(terms.intersection(t_words))
    snippet_matches = len(terms.intersection(s_words))

    term_ratio = (title_matches * 3.0 + snippet_matches * 1.5) / (len(terms) * 4.0)

    final_score = entity_score + term_ratio
    return min(1.0, max(0.02, final_score))

def calculate_recency_bonus(year: Optional[int]) -> float:
    """Bonus kebaruan publikasi untuk mendukung riset mutakhir."""
    if not year:
        return 0.0
    if year >= 2024:
        return 0.10
    elif year >= 2020:
        return 0.06
    elif year >= 2015:
        return 0.03
    return 0.0

def deduplicate_results(results: List[SearchResult]) -> List[SearchResult]:
    """
    Menggabungkan dan menduplikasi naskah berdasarkan DOI, URL, atau kesamaan judul.
    Ketika duplikat ditemukan, metadata terlengkap dipertahankan.
    """
    seen_doi: Dict[str, SearchResult] = {}
    seen_url: Dict[str, SearchResult] = {}
    seen_title: Dict[str, SearchResult] = {}
    deduped: List[SearchResult] = []

    for item in results:
        norm_d = normalize_doi(item.doi)
        norm_u = normalize_url(item.url)
        norm_t = normalize_title(item.title)

        existing: Optional[SearchResult] = None
        if norm_d and norm_d in seen_doi:
            existing = seen_doi[norm_d]
        elif norm_u and norm_u in seen_url:
            existing = seen_url[norm_u]
        elif norm_t and len(norm_t) > 15 and norm_t in seen_title:
            existing = seen_title[norm_t]

        if existing:
            # Gabungkan metadata: pilih snippet lebih panjang & lengkapi PDF/DOI
            if len(item.snippet or "") > len(existing.snippet or ""):
                existing.snippet = item.snippet
            if not existing.pdf_url and item.pdf_url:
                existing.pdf_url = item.pdf_url
            if not existing.doi and item.doi:
                existing.doi = item.doi
            if item.authors and not existing.authors:
                existing.authors = item.authors
            # Tingkatkan level bukti jika item baru memiliki derajat lebih tinggi
            current_weight = EVIDENCE_WEIGHTS.get(existing.evidence_level or "journal", 0.1)
            new_weight = EVIDENCE_WEIGHTS.get(item.evidence_level or "journal", 0.1)
            if new_weight > current_weight:
                existing.evidence_level = item.evidence_level
            continue

        # Simpan jejak deduplikasi
        if norm_d:
            seen_doi[norm_d] = item
        if norm_u:
            seen_url[norm_u] = item
        if norm_t and len(norm_t) > 15:
            seen_title[norm_t] = item

        deduped.append(item)

    return deduped

def rank_and_select(
    query: str,
    results: List[SearchResult],
    min_count: int = 6,
    max_count: int = 10,
    key_entities: Optional[List[str]] = None
) -> List[SearchResult]:
    """
    Perankingan komprehensif:
    1. Deduplikasi naskah berbasis DOI, URL, dan Judul.
    2. Deteksi entitas kunci: Filter/turunkan hasil yang tidak memuat entitas obat kunci.
    3. Reranker relevansi atas judul + abstrak terhadap pertanyaan asli.
    4. Perhitungan skor total:
       Skor = (Relevansi * 0.55) + (Effective EBM Weight * 0.30) + (Recency Bonus * 0.15).
       EBM Weight hanya diberikan secara penuh jika artikel relevan (rel >= 0.20).
    5. Pemotongan top min_count..max_count dan penetapan result_id [1..N].
    """
    if not results:
        return []

    unique_results = deduplicate_results(results)

    # Deteksi entitas kunci jika belum diberikan
    active_entities = key_entities
    if active_entities is None:
        try:
            from app.search.router import SearchRouter
            active_entities = SearchRouter.extract_drug_entities(query)
        except Exception:
            active_entities = []

    # 1. Hitung skor relevansi & entitas untuk seluruh kandidat
    scored_items = []
    for item in unique_results:
        rel = calculate_relevance_score(
            query=query,
            title=item.title,
            snippet=item.snippet,
            full_text=item.full_text,
            key_entities=active_entities
        )
        ev_weight = EVIDENCE_WEIGHTS.get(item.evidence_level or "journal", 0.10)
        rec_bonus = calculate_recency_bonus(item.year)

        # Invarian EBM: Derajat bukti ilmiah (meta-analysis/rct) HANYA berlaku
        # jika artikel terbukti relevan secara faktual terhadap pertanyaan!
        # Artikel yang tidak relevan (rel < 0.20) tidak berhak mendapat bobot bukti penuh.
        effective_ev_weight = ev_weight if rel >= 0.20 else (ev_weight * rel * 2.0)

        item.score = round((rel * 0.55) + (effective_ev_weight * 0.30) + (rec_bonus * 0.15), 4)
        scored_items.append((rel, item))

    # 2. Filter entitas kunci:
    # Jika query memuat entitas obat dan terdapat naskah yang cocok dengan entitas tersebut,
    # singkirkan naskah yang sama sekali tidak memuat entitas obat (rel <= 0.05).
    if active_entities:
        has_entity_matches = any(
            any(re.search(rf"\b{re.escape(e)}\b", f"{it.title} {it.snippet} {it.full_text or ''}".lower())
                for e in active_entities)
            for it in unique_results
        )
        if has_entity_matches:
            filtered = [
                it for (rel, it) in scored_items
                if rel > 0.05 or any(
                    re.search(rf"\b{re.escape(e)}\b", f"{it.title} {it.snippet} {it.full_text or ''}".lower())
                    for e in active_entities
                )
            ]
            if filtered:
                unique_results = filtered
            else:
                unique_results = [it for (_, it) in scored_items]
        else:
            unique_results = [it for (_, it) in scored_items]
    else:
        unique_results = [it for (_, it) in scored_items]

    # 3. Urutkan berdasarkan skor total tertinggi
    unique_results.sort(key=lambda x: x.score, reverse=True)

    # 4. Ambil top kandidat
    top_limit = min(max_count, max(min_count, len(unique_results)))
    final_selected = unique_results[:top_limit]

    # Beri indeks sitasi 1-based yang stabil
    for idx, item in enumerate(final_selected, 1):
        item.result_id = idx

    return final_selected
