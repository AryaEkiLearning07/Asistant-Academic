import logging
import re
from typing import List, Optional
import httpx
from app.search.models import BaseSearchProvider, SearchResult
from app.search.router import SearchRouter

logger = logging.getLogger(__name__)

class OpenFDALabelProvider(BaseSearchProvider):
    """
    Penyedia informasi label obat resmi FDA via openFDA Drug Label API.
    Khusus mengekstraksi indikasi klinis, aturan dosis resmi, kontraindikasi,
    peringatan keamanan, dan interaksi obat.
    HANYA mencari entitas obat yang terdeteksi secara valid (mencegah label menyimpang).
    """

    def __init__(self, timeout: float = 7.0):
        self.timeout = timeout
        self.endpoint = "https://api.fda.gov/drug/label.json"

    @property
    def name(self) -> str:
        return "openfda_label"

    async def search(
        self,
        query: str,
        limit: int = 4,
        detected_drugs: Optional[List[str]] = None
    ) -> List[SearchResult]:
        if not query or not query.strip():
            return []

        # 1. Pastikan entitas obat terdeteksi
        target_drugs = detected_drugs or SearchRouter.extract_drug_entities(query)
        if not target_drugs:
            logger.debug(f"[openFDA] Tidak ada entitas obat yang terdeteksi untuk kueri '{query}'. Lewati openFDA.")
            return []

        # Batasi maksimal 2 entitas obat terdepan (misal warfarin dan aspirin)
        active_drugs = target_drugs[:2]
        limit_per_drug = max(1, limit // len(active_drugs))
        results: List[SearchResult] = []
        headers = {"User-Agent": "EPIONA-ResearchAssistant/2.0 (mailto:admin@epiona.my.id)"}

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                for drug_name in active_drugs:
                    search_query = (
                        f'openfda.generic_name:"{drug_name}" OR '
                        f'openfda.brand_name:"{drug_name}" OR '
                        f'openfda.substance_name:"{drug_name}"'
                    )

                    try:
                        resp = await client.get(
                            self.endpoint,
                            params={"search": search_query, "limit": str(limit_per_drug)},
                            headers=headers
                        )

                        # Fallback ke pencarian teks bebas khusus entitas obat tersebut jika pencarian medan kosong
                        if resp.status_code != 200:
                            resp = await client.get(
                                self.endpoint,
                                params={"search": f'"{drug_name}"', "limit": str(limit_per_drug)},
                                headers=headers
                            )

                        if resp.status_code != 200:
                            logger.debug(f"[openFDA] Label tidak ditemukan untuk obat '{drug_name}' (HTTP {resp.status_code})")
                            continue

                        data = resp.json()
                        items = data.get("results", [])

                        for item in items:
                            openfda = item.get("openfda") or {}
                            brand_names = openfda.get("brand_name") or []
                            generic_names = openfda.get("generic_name") or []
                            substance_names = openfda.get("substance_name") or []

                            label_drug_title = (
                                (brand_names[0] if brand_names else None)
                                or (generic_names[0] if generic_names else None)
                                or (substance_names[0] if substance_names else None)
                                or drug_name.title()
                            )

                            # Ekstraksi bagian klinis esensial & interaksi obat
                            indications = " ".join(item.get("indications_and_usage") or [])
                            dosage = " ".join(item.get("dosage_and_administration") or [])
                            warnings = " ".join(item.get("warnings") or item.get("boxed_warning") or [])
                            interactions = " ".join(item.get("drug_interactions") or [])
                            adverse = " ".join(item.get("adverse_reactions") or [])

                            snippet_parts = []
                            if interactions:
                                snippet_parts.append(f"Interaksi: {interactions[:280].strip()}...")
                            if warnings and len(snippet_parts) < 2:
                                snippet_parts.append(f"Peringatan: {warnings[:220].strip()}...")
                            if indications and len(snippet_parts) < 3:
                                snippet_parts.append(f"Indikasi: {indications[:220].strip()}...")
                            if dosage and len(snippet_parts) < 3:
                                snippet_parts.append(f"Dosis: {dosage[:180].strip()}...")
                            if adverse and len(snippet_parts) < 3:
                                snippet_parts.append(f"Efek Samping: {adverse[:160].strip()}...")

                            snippet_text = " | ".join(snippet_parts) if snippet_parts else f"Label resmi FDA untuk {label_drug_title}."
                            full_text = (
                                f"INTERAKSI OBAT:\n{interactions}\n\n"
                                f"PERINGATAN:\n{warnings}\n\n"
                                f"INDIKASI:\n{indications}\n\n"
                                f"DOSIS:\n{dosage}"
                            )

                            effective_time = item.get("effective_time")
                            year_val: Optional[int] = None
                            if effective_time and len(str(effective_time)) >= 4:
                                try:
                                    year_val = int(str(effective_time)[:4])
                                except Exception:
                                    year_val = None

                            title = f"{label_drug_title} - FDA Approved Drug Label"
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

                    except Exception as drug_err:
                        logger.warning(f"[openFDA] Error saat memproses obat '{drug_name}': {drug_err}")

                return results

        except Exception as e:
            logger.warning(f"[openFDA] Search error: {e}")
            return []
