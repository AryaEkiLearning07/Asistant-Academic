import asyncio
import logging
from typing import List, Dict, Any, Optional
from app.config import (
    SEARCH_PROVIDERS,
    NCBI_API_KEY,
    S2_API_KEY,
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
    Orkestrator utama mesin penelusuran multi-provider (P3-1 & P3-1b):
    1. Evaluasi intent via SearchRouter (apakah pertanyaan memerlukan pencarian).
    2. Pengecekan cache SQLite (TTL 24 jam) berbasis kueri ternormalisasi.
    3. Ekstraksi entitas obat & Query Rewriting menjadi 2-4 kueri terfokus.
    4. Eksekusi paralel provider terpilih dengan throttling & retry backoff 429.
    5. Penggabungan esearch multi-kueri PubMed sebelum efetch tunggal.
    6. Pembatasan target openFDA hanya untuk entitas obat yang terdeteksi.
    7. Fusi & perankingan EBM: filter/demote naskah tanpa entitas kunci,
       reranker relevansi judul+abstrak, dan bobot EBM bertingkat.
    8. Integrasi dengan RAG dokumen pengguna jika mode Library/Semua diaktifkan.
    """

    def __init__(self, cache: Optional[SearchCache] = None):
        self.cache = cache or SearchCache()
        self.providers: Dict[str, BaseSearchProvider] = {
            "pubmed": PubMedProvider(api_key=NCBI_API_KEY),
            "semantic_scholar": SemanticScholarProvider(api_key=S2_API_KEY),
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
        mode: str = "auto",
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

        # 2. Ekstraksi entitas obat kunci
        detected_drugs = SearchRouter.extract_drug_entities(question)

        # 3. Cek Cache jika tidak dipaksa refresh
        if not force_refresh:
            cached_results = self.cache.get(question)
            if cached_results:
                logger.debug(f"[Orchestrator] Cache HIT untuk kueri '{question}'.")
                if user_passages:
                    doc_results = self._convert_passages_to_results(user_passages)
                    return rank_and_select(
                        question,
                        cached_results + doc_results,
                        min_count=6,
                        max_count=10,
                        key_entities=detected_drugs
                    )
                return cached_results

        # 4. Query Rewriting menjadi 2-4 kueri terfokus (berbahasa Inggris & memuat entitas obat)
        rewritten_queries = SearchRouter.rewrite_queries(question)
        if not rewritten_queries:
            rewritten_queries = [question]

        # 5. Pilih provider aktif
        active_providers = self._get_active_providers(mode=mode)
        if not active_providers:
            logger.warning("[Orchestrator] Tidak ada provider pencarian yang aktif.")
            return []

        # 6. Jalankan pencarian paralel secara aman (asyncio.gather dengan return_exceptions=True)
        tasks = []
        for p in active_providers:
            if p.name == "pubmed" and hasattr(p, "search_queries"):
                # Gabungkan esearch kueri 1 & 2 sebelum satu kali efetch tunggal
                tasks.append(self._safe_pubmed_multi_search(p, rewritten_queries[:2], limit_per_query=4, max_total=6))
            elif p.name in ("openfda", "openfda_label"):
                # openFDA HANYA mencari entitas obat yang terdeteksi
                if detected_drugs:
                    tasks.append(self._safe_openfda_search(p, rewritten_queries[0], detected_drugs=detected_drugs, limit=4))
                else:
                    logger.debug("[Orchestrator] Lewati openFDA karena tidak ada entitas obat terdeteksi.")
            else:
                # Kueri primer
                tasks.append(self._safe_provider_search(p, rewritten_queries[0], limit=4))
                # Kueri kedua untuk repositori naskah akademik (Semantic Scholar & Europe PMC)
                if len(rewritten_queries) > 1 and p.name in ("semantic_scholar", "europepmc"):
                    tasks.append(self._safe_provider_search(p, rewritten_queries[1], limit=3))

        gather_results = await asyncio.gather(*tasks, return_exceptions=True)

        collected_results: List[SearchResult] = []
        for res in gather_results:
            if isinstance(res, list):
                collected_results.extend(res)
            elif isinstance(res, Exception):
                logger.warning(f"[Orchestrator] Error dari provider: {res}")

        # 7. Integrasi dengan RAG dokumen MyLibrary pengguna jika ada
        if user_passages:
            doc_results = self._convert_passages_to_results(user_passages)
            collected_results.extend(doc_results)

        # 8. Ranking komprehensif, filter entitas kunci, dan seleksi top 6 - 10
        final_ranked = rank_and_select(
            question,
            collected_results,
            min_count=6,
            max_count=10,
            key_entities=detected_drugs
        )

        # 9. Simpan ke Cache jika ada hasil
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

    async def _safe_pubmed_multi_search(
        self,
        provider: PubMedProvider,
        queries: List[str],
        limit_per_query: int = 4,
        max_total: int = 6
    ) -> List[SearchResult]:
        try:
            return await provider.search_queries(queries, limit_per_query=limit_per_query, max_total=max_total)
        except Exception as e:
            logger.warning(f"[Orchestrator] PubMed search_queries gagal: {e}")
            return []

    async def _safe_openfda_search(
        self,
        provider: BaseSearchProvider,
        query: str,
        detected_drugs: Optional[List[str]] = None,
        limit: int = 4
    ) -> List[SearchResult]:
        try:
            if hasattr(provider, "search") and "detected_drugs" in provider.search.__code__.co_varnames:
                return await provider.search(query, limit=limit, detected_drugs=detected_drugs)
            return await provider.search(query, limit=limit)
        except Exception as e:
            logger.warning(f"[Orchestrator] openFDA search gagal: {e}")
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
