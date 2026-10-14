import logging
from typing import List, Optional
import httpx
from app.search.models import BaseSearchProvider, SearchResult

logger = logging.getLogger(__name__)

class SemanticScholarProvider(BaseSearchProvider):
    """
    Penyedia pencarian literatur akademik Semantic Scholar via Graph API.
    Mengambil naskah, abstrak lengkap, tahun, DOI, dan tautan openAccessPdf.
    """

    def __init__(self, api_key: Optional[str] = None, timeout: float = 7.0):
        self.api_key = api_key.strip() if api_key else None
        self.timeout = timeout
        self.endpoint = "https://api.semanticscholar.org/graph/v1/paper/search"

    @property
    def name(self) -> str:
        return "semantic_scholar"

    def _determine_evidence_level(self, pub_types: List[str], text: str) -> str:
        lower_types = [t.lower() for t in (pub_types or [])]
        combined = (" ".join(lower_types) + " " + text).lower()

        if any(k in combined for k in ["meta-analysis", "meta analysis"]):
            return "meta_analysis"
        if any(k in combined for k in ["systematic review", "systematic literature review"]):
            return "systematic_review"
        if any(k in combined for k in ["clinicaltrial", "clinical trial", "randomized controlled trial", "rct"]):
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
            "limit": str(limit),
            "fields": "title,url,abstract,year,authors,externalIds,openAccessPdf,publicationTypes,venue",
        }
        headers = {"User-Agent": "EPIONA-ResearchAssistant/2.0"}
        if self.api_key:
            headers["x-api-key"] = self.api_key

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                resp = await client.get(self.endpoint, params=params, headers=headers)
                if resp.status_code != 200:
                    logger.warning(f"[SemanticScholar] API error HTTP {resp.status_code}")
                    return []

                data = resp.json()
                papers = data.get("data", [])
                results: List[SearchResult] = []

                for paper in papers:
                    title = paper.get("title", "").strip()
                    if not title:
                        continue

                    abstract = paper.get("abstract") or ""
                    year = paper.get("year")
                    year_val = int(year) if year and isinstance(year, int) else None

                    authors_list = [a.get("name") for a in paper.get("authors", []) if a.get("name")]
                    ext_ids = paper.get("externalIds") or {}
                    doi = ext_ids.get("DOI")
                    
                    pdf_info = paper.get("openAccessPdf") or {}
                    pdf_url = pdf_info.get("url") if isinstance(pdf_info, dict) else None

                    pub_types = paper.get("publicationTypes") or []
                    evidence_level = self._determine_evidence_level(pub_types, f"{title} {abstract}")

                    paper_url = paper.get("url")
                    final_url = f"https://doi.org/{doi}" if doi else (paper_url or f"https://www.semanticscholar.org/paper/{paper.get('paperId')}")

                    venue = paper.get("venue") or "Semantic Scholar"

                    results.append(SearchResult(
                        title=title,
                        url=final_url,
                        snippet=abstract or title,
                        full_text=abstract or None,
                        source_type="journal",
                        year=year_val,
                        authors=authors_list,
                        doi=doi,
                        evidence_level=evidence_level,
                        journal=venue,
                        pdf_url=pdf_url,
                    ))

                return results

        except Exception as e:
            logger.warning(f"[SemanticScholar] Search error: {e}")
            return []
