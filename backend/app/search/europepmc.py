import logging
import re
from typing import List, Optional
import httpx
from app.search.models import BaseSearchProvider, SearchResult

logger = logging.getLogger(__name__)

class EuropePMCProvider(BaseSearchProvider):
    """
    Penyedia pencarian literatur biomedis & farmasi Europe PMC via REST API.
    Menyediakan akses komprehensif ke abstrak jurnal dan berkas PDF Open Access.
    """

    def __init__(self, timeout: float = 7.0):
        self.timeout = timeout
        self.endpoint = "https://www.ebi.ac.uk/europepmc/webservices/rest/search"

    @property
    def name(self) -> str:
        return "europepmc"

    def _determine_evidence_level(self, pub_types: List[str], text: str) -> str:
        lower_types = [t.lower() for t in (pub_types or [])]
        combined = (" ".join(lower_types) + " " + text).lower()

        if any(k in combined for k in ["meta-analysis", "meta analysis"]):
            return "meta_analysis"
        if any(k in combined for k in ["systematic review", "systematic literature review"]):
            return "systematic_review"
        if any(k in combined for k in ["randomized controlled trial", "clinical trial", "rct"]):
            return "rct"
        if any(k in combined for k in ["cohort", "observational", "case-control"]):
            return "observational"
        if any(k in combined for k in ["guideline", "consensus"]):
            return "guideline"
        if any(k in combined for k in ["review"]):
            return "review"
        return "journal"

    async def search(self, query: str, limit: int = 5) -> List[SearchResult]:
        if not query or not query.strip():
            return []

        clean_query = query.strip()
        params = {
            "query": clean_query,
            "format": "json",
            "pageSize": str(limit),
            "resultType": "core",
        }
        headers = {"User-Agent": "EPIONA-ResearchAssistant/2.0"}

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                resp = await client.get(self.endpoint, params=params, headers=headers)
                if resp.status_code != 200:
                    logger.warning(f"[EuropePMC] API error HTTP {resp.status_code}")
                    return []

                data = resp.json()
                items = data.get("resultList", {}).get("result", [])
                results: List[SearchResult] = []

                for item in items:
                    title = item.get("title", "").strip().rstrip(".")
                    if not title:
                        continue

                    abstract = item.get("abstractText") or ""
                    # Hapus tag HTML jika ada di abstrak EuropePMC
                    abstract_clean = re.sub(r"<[^>]+>", "", abstract).strip()

                    pub_year = item.get("pubYear")
                    year_val = int(pub_year) if pub_year and pub_year.isdigit() else None

                    authors_str = item.get("authorString") or ""
                    authors_list = [a.strip() for a in authors_str.split(",") if a.strip()] if authors_str else []

                    doi = item.get("doi")
                    pmid = item.get("pmid")
                    pmcid = item.get("pmcid")

                    # Cari URL PDF Open Access
                    pdf_url = None
                    full_text_urls = item.get("fullTextUrlList", {}).get("fullTextUrl", [])
                    for ft in full_text_urls:
                        doc_style = (ft.get("documentStyle") or "").lower()
                        if doc_style == "pdf" or (ft.get("url") and ft.get("url").endswith(".pdf")):
                            pdf_url = ft.get("url")
                            break

                    journal_name = item.get("journalTitle") or "Europe PMC"

                    pub_type_list = item.get("pubTypeList", {}).get("pubType", [])
                    if isinstance(pub_type_list, str):
                        pub_type_list = [pub_type_list]

                    evidence_level = self._determine_evidence_level(pub_type_list, f"{title} {abstract_clean}")

                    final_url = f"https://doi.org/{doi}" if doi else (
                        f"https://europepmc.org/article/MED/{pmid}" if pmid else (
                            f"https://europepmc.org/article/PMC/{pmcid}" if pmcid else f"https://europepmc.org/article/{item.get('id')}"
                        )
                    )

                    results.append(SearchResult(
                        title=title,
                        url=final_url,
                        snippet=abstract_clean or title,
                        full_text=abstract_clean or None,
                        source_type="journal",
                        year=year_val,
                        authors=authors_list[:6],
                        doi=doi,
                        evidence_level=evidence_level,
                        journal=journal_name,
                        pdf_url=pdf_url,
                    ))

                return results

        except Exception as e:
            logger.warning(f"[EuropePMC] Search error: {e}")
            return []
