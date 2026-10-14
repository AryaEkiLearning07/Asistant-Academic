import asyncio
import logging
from typing import List, Dict, Any, Optional
from app.config import (
    SEARCH_PROVIDERS,
    NCBI_API_KEY,
    TAVILY_API_KEY,
)
from app.search.models import SearchResult, BaseSearchProvider
from app.search.pubmed import PubMedProvider
from app.search.semantic_scholar import SemanticScholarProvider
from app.search.europepmc import EuropePMCProvider
from app.search.openfda_label import OpenFDALabelProvider
from app.search.tavily import TavilyProvider
from app.search.cache import SearchCache
from app.search.ranking import rank_and_select
from app.search.router import SearchRouter

logger = logging.getLogger(__name__)

class SearchOrchestrator:
    """
    Orkestrator utama mesin penelusuran multi-provider (P3-1):
    1. Evaluasi intent via SearchRouter (apakah pertanyaan memerlukan pencarian).
    2. Pengecekan cache SQLite (TTL 24 jam) berbasis kueri ternormalisasi.
    3. Eksekusi paralel provider terpilih (PubMed, Semantic Scholar, Europe PMC, openFDA, Tavily) via asyncio.
    4. Resiliensi kegagalan: timeout per provider, kegagalan satu provider tidak menggagalkan provider lain.
    5. Fusi & perankingan EBM (relevansi, derajat bukti, kebaruan), deduplikasi DOI/URL.
    6. Integrasi dengan RAG dokumen pengguna jika mode Library/Semua diaktifkan.
    """

    def __init__(self, cache: Optional[SearchCache] = None):
        self.cache = cache or SearchCache()
        self.providers: Dict[str, BaseSearchProvider] = {
            "pubmed": PubMedProvider(api_key=NCBI_API_KEY),
            "semantic_scholar": SemanticScholarProvider(),
            "europepmc": EuropePMCProvider(),
            "openfda_label": OpenFDALabelProvider(),
            "openfda": OpenFDALabelProvider(),  # alias
            "tavily": TavilyProvider(api_key=TAVILY_API_KEY),
        }

    def _get_active_providers(self, mode: str = "academic") -> List[BaseSearchProvider]:
        configured_names = [p.strip().lower() for p in SEARCH_PROVIDERS.split(",") if p.strip()]
        active = []
        for name in configured_names:
            provider = self.providers.get(name)
            if not provider:
                continue
            # Jika mode akademik murni, lewati tavily web umum kecuali mode web
            if mode == "academic" and provider.name == "tavily":
                continue
            if provider not in active:
                active.append(provider)
        return active

    async def search(
        self,
        question: str,
        mode: str = "academic",
        user_passages: Optional[List[Dict[str, Any]]] = None,
        force_refresh: bool = False
    ) -> List[SearchResult]:
        """
        Menjalankan alur penelusuran lengkap dari router, cache, provider eksternal,
        hingga perankingan EBM dan integrasi dokumen pengguna.
        """
        # 1. Klasifikasi awal: apakah butuh pencarian?
        if not SearchRouter.needs_search(question):
            logger.debug(f"[Orchestrator] Pertanyaan '{question}' tidak membutuhkan penelusuran.")
            return []

        # 2. Cek Cache jika tidak dipaksa refresh
        if not force_refresh:
            cached_results = self.cache.get(question)
            if cached_results:
                logger.debug(f"[Orchestrator] Cache HIT untuk kueri '{question}'.")
                # Jika ada dokumen user tambahan, fusi dengan cache
                if user_passages:
                    doc_results = self._convert_passages_to_results(user_passages)
                    return rank_and_select(question, cached_results + doc_results, min_count=6, max_count=10)
                return cached_results

        # 3. Query Rewriting menjadi 2-4 kueri terfokus
        rewritten_queries = SearchRouter.rewrite_queries(question)
        if not rewritten_queries:
            rewritten_queries = [question]

        # 4. Pilih provider aktif
        active_providers = self._get_active_providers(mode=mode)
        if not active_providers:
            logger.warning("[Orchestrator] Tidak ada provider pencarian yang aktif.")
            return []

        # 5. Jalankan pencarian paralel secara aman (asyncio.gather dengan return_exceptions=True)
        tasks = []
        # Untuk mengoptimalkan latensi & kuota, kueri primer dikirim ke semua provider,
        # kueri sekunder dikirim ke penyedia jurnal medis utama
        for p in active_providers:
            # Kueri primer
            tasks.append(self._safe_provider_search(p, rewritten_queries[0], limit=4))
            # Kueri kedua (mekanisme / istilah alternatif) untuk jurnal
            if len(rewritten_queries) > 1 and p.name in ("pubmed", "semantic_scholar", "europepmc"):
                tasks.append(self._safe_provider_search(p, rewritten_queries[1], limit=3))

        gather_results = await asyncio.gather(*tasks, return_exceptions=True)

        collected_results: List[SearchResult] = []
        for res in gather_results:
            if isinstance(res, list):
                collected_results.extend(res)
            elif isinstance(res, Exception):
                logger.warning(f"[Orchestrator] Error dari provider: {res}")

        # 6. Integrasi dengan RAG dokumen MyLibrary pengguna jika ada
        if user_passages:
            doc_results = self._convert_passages_to_results(user_passages)
            collected_results.extend(doc_results)

        # 7. Ranking, deduplikasi, dan seleksi top 6 - 10
        final_ranked = rank_and_select(question, collected_results, min_count=6, max_count=10)

        # 8. Simpan ke Cache jika ada hasil
        if final_ranked:
            self.cache.set(question, final_ranked)

        return final_ranked

    async def _safe_provider_search(
        self,
        provider: BaseSearchProvider,
        query: str,
        limit: int = 4
    ) -> List[SearchResult]:
        try:
            return await provider.search(query, limit=limit)
        except Exception as e:
            logger.warning(f"[Orchestrator] Provider {provider.name} gagal pada query '{query}': {e}")
            return []

    def _convert_passages_to_results(self, passages: List[Dict[str, Any]]) -> List[SearchResult]:
        doc_results: List[SearchResult] = []
        for idx, p in enumerate(passages):
            doc_id = p.get("document_id") or f"doc_{idx}"
            doc_title = p.get("document_title") or "Dokumen MyLibrary"
            page_num = p.get("page_number", 1)
            text = p.get("passage_text") or p.get("text") or ""
            if not text:
                continue

            doc_results.append(SearchResult(
                title=f"{doc_title} (Halaman {page_num})",
                url=f"/api/v1/documents/{doc_id}/preview?page={page_num}",
                snippet=text[:350].strip(),
                full_text=text,
                source_type="document",
                year=2024,
                authors=["MyLibrary Koleksi"],
                doi=None,
                evidence_level="document",
                journal="MyLibrary Dokumen Lokal",
                pdf_url=None,
            ))
        return doc_results
