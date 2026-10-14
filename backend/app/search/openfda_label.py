import logging
import re
from typing import List, Optional
import httpx
from app.search.models import BaseSearchProvider, SearchResult

logger = logging.getLogger(__name__)

class OpenFDALabelProvider(BaseSearchProvider):
    """
    Penyedia informasi label obat resmi FDA via openFDA Drug Label API.
    Khusus mengekstraksi indikasi klinis, aturan dosis resmi, kontraindikasi,
    dan peringatan keamanan untuk pertanyaan farmasi.
    """

    def __init__(self, timeout: float = 7.0):
        self.timeout = timeout
        self.endpoint = "https://api.fda.gov/drug/label.json"

    @property
    def name(self) -> str:
        return "openfda_label"

    async def search(self, query: str, limit: int = 4) -> List[SearchResult]:
        if not query or not query.strip():
            return []

        clean_query = query.strip()
        # Ekstrak kata kunci obat utama (hilangkan kata penghubung/pertanyaan umum)
        terms = re.findall(r"\b[A-Za-z0-9-]+\b", clean_query)
        stop = {"what", "is", "the", "dose", "dosage", "of", "for", "effect", "side", "in", "and", "or", "drug", "fda"}
        drug_terms = [t for t in terms if t.lower() not in stop and len(t) > 2]
        search_term = " ".join(drug_terms[:2]) if drug_terms else clean_query

        # Coba format pencarian openfda berdasarkan nama brand/generik
        search_query = (
            f'openfda.brand_name:"{search_term}" OR '
            f'openfda.generic_name:"{search_term}" OR '
            f'openfda.substance_name:"{search_term}"'
        )

        headers = {"User-Agent": "EPIONA-ResearchAssistant/2.0"}

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                # 1. Coba pencarian bidang nama obat
                resp = await client.get(
                    self.endpoint,
                    params={"search": search_query, "limit": str(limit)},
                    headers=headers
                )

                # 2. Jika tidak ada hasil, fallback ke pencarian teks bebas
                if resp.status_code != 200:
                    resp = await client.get(
                        self.endpoint,
                        params={"search": f'"{search_term}"', "limit": str(limit)},
                        headers=headers
                    )

                if resp.status_code != 200:
                    logger.debug(f"[openFDA] Drug label not found or HTTP {resp.status_code}")
                    return []

                data = resp.json()
                items = data.get("results", [])
                results: List[SearchResult] = []

                for item in items:
                    openfda = item.get("openfda") or {}
                    brand_names = openfda.get("brand_name") or []
                    generic_names = openfda.get("generic_name") or []
                    substance_names = openfda.get("substance_name") or []

                    drug_name = (
                        (brand_names[0] if brand_names else None)
                        or (generic_names[0] if generic_names else None)
                        or (substance_names[0] if substance_names else None)
                        or search_term.title()
                    )

                    # Ekstraksi bagian klinis esensial
                    indications = " ".join(item.get("indications_and_usage") or [])
                    dosage = " ".join(item.get("dosage_and_administration") or [])
                    warnings = " ".join(item.get("warnings") or item.get("boxed_warning") or [])
                    adverse = " ".join(item.get("adverse_reactions") or [])

                    snippet_parts = []
                    if indications:
                        snippet_parts.append(f"Indikasi: {indications[:280].strip()}...")
                    if dosage:
                        snippet_parts.append(f"Dosis: {dosage[:220].strip()}...")
                    if warnings:
                        snippet_parts.append(f"Peringatan: {warnings[:220].strip()}...")
                    if adverse and len(snippet_parts) < 3:
                        snippet_parts.append(f"Efek Samping: {adverse[:180].strip()}...")

                    snippet_text = " | ".join(snippet_parts) if snippet_parts else f"Label resmi obat FDA untuk {drug_name}."
                    full_text = f"INDIKASI:\n{indications}\n\nDOSIS & CARA PAKAI:\n{dosage}\n\nPERINGATAN:\n{warnings}"

                    # Tahun revisi / persetujuan
                    effective_time = item.get("effective_time")
                    year_val: Optional[int] = None
                    if effective_time and len(str(effective_time)) >= 4:
                        try:
                            year_val = int(str(effective_time)[:4])
                        except Exception:
                            year_val = None

                    title = f"{drug_name} - FDA Approved Drug Label"
                    dailymed_url = f"https://dailymed.nlm.nih.gov/dailymed/search.cfm?labeltype=all&query={drug_name}"

                    results.append(SearchResult(
                        title=title,
                        url=dailymed_url,
                        snippet=snippet_text,
                        full_text=full_text,
                        source_type="label",
                        year=year_val or 2024,
                        authors=["U.S. Food and Drug Administration (FDA)"],
                        doi=None,
                        evidence_level="drug_label",
                        journal="U.S. FDA Drug Database",
                        pdf_url=None,
                    ))

                return results

        except Exception as e:
            logger.warning(f"[openFDA] Search error: {e}")
            return []
