import re
from typing import List, Dict, Optional
from urllib.parse import urlparse, urlunparse
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
        # Bersihkan trailing slash dan skema
        netloc = parsed.netloc.replace("www.", "")
        path = parsed.path.rstrip("/")
        # Bersihkan parameter pelacak
        return f"{netloc}{path}"
    except Exception:
        return url.strip().lower()

def normalize_title(title: str) -> str:
    if not title:
        return ""
    return re.sub(r"[^\w\s]", "", title.lower()).strip()

def calculate_relevance_score(query: str, title: str, snippet: str) -> float:
    """
    Menghitung skor relevansi berbasis kecocokan istilah kueri terhadap judul dan snippet.
    Judul diberi bobot 2.5x lebih tinggi dibandingkan cuplikan teks.
    """
    if not query:
        return 0.5

    terms = set(re.findall(r"\b[a-zA-Z0-9-]{3,}\b", query.lower()))
    if not terms:
        return 0.5

    t_words = set(re.findall(r"\b[a-zA-Z0-9-]{3,}\b", (title or "").lower()))
    s_words = set(re.findall(r"\b[a-zA-Z0-9-]{3,}\b", (snippet or "").lower()))

    title_matches = len(terms.intersection(t_words))
    snippet_matches = len(terms.intersection(s_words))

    # Rasio pencocokan terhadap total term kueri
    raw_score = (title_matches * 2.5 + snippet_matches * 1.0) / (len(terms) * 3.5)
    return min(1.0, max(0.05, raw_score))

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
    max_count: int = 10
) -> List[SearchResult]:
    """
    Perankingan komprehensif:
    1. Deduplikasi berbasis DOI/URL/Judul
    2. Perhitungan skor total = (Relevansi * 0.5) + Bobot Evidence EBM + Bonus Kebaruan
    3. Pengurutan descending dan pemotongan top 6 - 10 sumber
    4. Penetapan result_id sitasi 1-based [1..N]
    """
    if not results:
        return []

    unique_results = deduplicate_results(results)

    for item in unique_results:
        rel = calculate_relevance_score(query, item.title, item.snippet)
        ev_weight = EVIDENCE_WEIGHTS.get(item.evidence_level or "journal", 0.10)
        rec_bonus = calculate_recency_bonus(item.year)

        item.score = round((rel * 0.5) + ev_weight + rec_bonus, 4)

    # Urutkan berdasarkan skor total tertinggi
    unique_results.sort(key=lambda x: x.score, reverse=True)

    # Ambil top 6-10
    top_limit = min(max_count, max(min_count, len(unique_results)))
    final_selected = unique_results[:top_limit]

    # Beri indeks sitasi 1-based yang stabil
    for idx, item in enumerate(final_selected, 1):
        item.result_id = idx

    return final_selected
