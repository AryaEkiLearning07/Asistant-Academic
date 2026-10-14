import logging
from typing import List, Optional
import httpx
from app.search.models import BaseSearchProvider, SearchResult

logger = logging.getLogger(__name__)

class TavilyProvider(BaseSearchProvider):
    """
    Penyedia penelusuran web umum menggunakan Tavily Search API.
    HANYA aktif jika TAVILY_API_KEY dikonfigurasi. Jika tidak ada kunci, mengembalikan [].
    """

    def __init__(self, api_key: Optional[str] = None, timeout: float = 7.0):
        self.api_key = api_key.strip() if api_key else ""
        self.timeout = timeout
        self.endpoint = "https://api.tavily.com/search"

    @property
    def name(self) -> str:
        return "tavily"

    async def search(self, query: str, limit: int = 5) -> List[SearchResult]:
        if not self.api_key:
            # Tidak aktif jika tidak ada kunci API
            return []

        if not query or not query.strip():
            return []

        payload = {
            "api_key": self.api_key,
            "query": query.strip(),
            "max_results": limit,
            "search_depth": "basic",
            "include_answer": False,
        }

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                resp = await client.post(self.endpoint, json=payload)
                if resp.status_code != 200:
                    logger.warning(f"[Tavily] Search API error HTTP {resp.status_code}")
                    return []

                data = resp.json()
                raw_results = data.get("results", [])
                results: List[SearchResult] = []

                for item in raw_results:
                    title = item.get("title", "").strip()
                    url = item.get("url", "").strip()
                    snippet = item.get("content", "").strip()
                    if not title or not url:
                        continue

                    results.append(SearchResult(
                        title=title,
                        url=url,
                        snippet=snippet or title,
                        full_text=snippet or None,
                        source_type="web",
                        year=2024,
                        authors=[],
                        doi=None,
                        evidence_level="web",
                        journal="Web Pengetahuan Terbuka",
                        pdf_url=None,
                    ))

                return results

        except Exception as e:
            logger.warning(f"[Tavily] Search error: {e}")
            return []
