import logging
from typing import List, Optional
import httpx
from app.config import S2_API_KEY
from app.search.models import BaseSearchProvider, SearchResult, classify_evidence_level
from app.search.throttler import Throttler, execute_with_retry

logger = logging.getLogger(__name__)

class SemanticScholarProvider(BaseSearchProvider):
    """
    Penyedia pencarian literatur akademik Semantic Scholar via Graph API.
    Mendukung S2_API_KEY opsional (rate limit ~10 req/s vs ~1 req/s tanpa kunci).
    Dilengkapi throttling, retry backoff HTTP 429 (maks 3x), dan
    klasifikasi EBM berbasis publicationTypes resmi.
    """

    def __init__(self, api_key: Optional[str] = None, timeout: float = 7.0):
        # Gunakan API key dari argumen atau dari konfigurasi lingkungan S2_API_KEY
        resolved_key = (api_key.strip() if api_key else "") or S2_API_KEY
        self.api_key = resolved_key if resolved_key else None
        self.timeout = timeout
        self.endpoint = "https://api.semanticscholar.org/graph/v1/paper/search"

        # Throttle: ~1 req/s tanpa key, 10 req/s dengan key
        req_per_sec = 10.0 if self.api_key else 1.0
        self.throttler = Throttler(requests_per_second=req_per_sec, max_concurrency=1)

    @property
    def name(self) -> str:
        return "semantic_scholar"

    def _determine_evidence_level(self, pub_types: List[str], text: str, title: str = "") -> str:
        """Kompatibilitas mundur internal, mengacu ke classifier EBM terpadu."""
        return classify_evidence_level(pub_types=pub_types, title=title, text=text)

    async def search(self, query: str, limit: int = 5) -> List[SearchResult]:
        if not query or not query.strip():
            return []

        clean_query = query.strip()
        params = {
            "query": clean_query,
            "limit": str(limit),
            "fields": "title,url,abstract,year,authors,externalIds,openAccessPdf,publicationTypes,venue",
        }
        headers = {"User-Agent": "EPIONA-ResearchAssistant/2.0 (mailto:admin@epiona.my.id)"}
        if self.api_key:
            headers["x-api-key"] = self.api_key

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                resp = await execute_with_retry(
                    lambda: client.get(self.endpoint, params=params, headers=headers),
                    throttler=self.throttler,
                    max_retries=3,
                    base_backoff=1.0,
                    provider_name="SemanticScholar"
                )

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
                    evidence_level = classify_evidence_level(
                        pub_types=pub_types,
                        title=title,
                        text=abstract
                    )

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
