import json
import pytest
import sqlite3
import time
from unittest.mock import AsyncMock, patch, MagicMock
from app.search.models import SearchResult
from app.search.pubmed import PubMedProvider
from app.search.semantic_scholar import SemanticScholarProvider
from app.search.europepmc import EuropePMCProvider
from app.search.openfda_label import OpenFDALabelProvider
from app.search.tavily import TavilyProvider
from app.search.cache import SearchCache
from app.search.ranking import (
    deduplicate_results,
    rank_and_select,
    normalize_doi,
    normalize_url,
    calculate_relevance_score,
    calculate_recency_bonus,
    EVIDENCE_WEIGHTS
)
from app.search.router import SearchRouter
from app.search.claim_checker import ClaimChecker
from app.search.orchestrator import SearchOrchestrator


# ==============================================================================
# 1. TEST PUBMED PROVIDER (MOCK HTTP)
# ==============================================================================
@pytest.mark.asyncio
async def test_pubmed_provider_success():
    mock_xml = """<?xml version="1.0" encoding="UTF-8"?>
    <PubmedArticleSet>
        <PubmedArticle>
            <MedlineCitation>
                <PMID>31234567</PMID>
                <Article>
                    <ArticleTitle>Amlodipine in Elderly Patients: A Randomized Controlled Trial.</ArticleTitle>
                    <Journal>
                        <Title>Journal of Clinical Hypertension</Title>
                        <JournalIssue>
                            <PubDate>
                                <Year>2024</Year>
                            </PubDate>
                        </JournalIssue>
                    </Journal>
                    <Abstract>
                        <AbstractText Label="OBJECTIVE">To investigate amlodipine efficacy in hypertension.</AbstractText>
                        <AbstractText Label="CONCLUSION">Amlodipine significantly reduces systolic BP with minimal edema.</AbstractText>
                    </Abstract>
                    <AuthorList>
                        <Author>
                            <LastName>Smith</LastName>
                            <ForeName>John</ForeName>
                        </Author>
                        <Author>
                            <LastName>Doe</LastName>
                            <ForeName>Jane</ForeName>
                        </Author>
                    </AuthorList>
                    <PublicationTypeList>
                        <PublicationType>Randomized Controlled Trial</PublicationType>
                    </PublicationTypeList>
                </Article>
            </MedlineCitation>
            <PubmedData>
                <ArticleIdList>
                    <ArticleId IdType="doi">10.1016/j.jch.2024.01.001</ArticleId>
                    <ArticleId IdType="pmc">PMC7891234</ArticleId>
                </ArticleIdList>
            </PubmedData>
        </PubmedArticle>
    </PubmedArticleSet>
    """

    mock_search_json = {"esearchresult": {"idlist": ["31234567"]}}

    provider = PubMedProvider(api_key="mock_ncbi_key", timeout=5.0)

    with patch("httpx.AsyncClient.get") as mock_get:
        mock_resp_search = MagicMock()
        mock_resp_search.status_code = 200
        mock_resp_search.json.return_value = mock_search_json

        mock_resp_fetch = MagicMock()
        mock_resp_fetch.status_code = 200
        mock_resp_fetch.text = mock_xml

        mock_get.side_effect = [mock_resp_search, mock_resp_fetch]

        results = await provider.search("amlodipine elderly", limit=1)

        assert len(results) == 1
        item = results[0]
        assert "Amlodipine in Elderly Patients" in item.title
        assert item.source_type == "journal"
        assert item.year == 2024
        assert item.doi == "10.1016/j.jch.2024.01.001"
        assert item.evidence_level == "rct"
        assert "John Smith" in item.authors
        assert "Jane Doe" in item.authors
        assert item.pdf_url == "https://pmc.ncbi.nlm.nih.gov/articles/PMC7891234/pdf/"
        assert "significantly reduces systolic BP" in item.snippet


@pytest.mark.asyncio
async def test_pubmed_provider_meta_analysis_detection():
    mock_xml = """<?xml version="1.0" encoding="UTF-8"?>
    <PubmedArticleSet>
        <PubmedArticle>
            <MedlineCitation>
                <PMID>39887766</PMID>
                <Article>
                    <ArticleTitle>Efficacy of Metformin: A Systematic Review and Meta-Analysis.</ArticleTitle>
                    <Journal>
                        <Title>Lancet Diabetes</Title>
                        <JournalIssue>
                            <PubDate><Year>2025</Year></PubDate>
                        </JournalIssue>
                    </Journal>
                    <Abstract>
                        <AbstractText>Comprehensive meta-analysis demonstrating glycemic control.</AbstractText>
                    </Abstract>
                    <PublicationTypeList>
                        <PublicationType>Meta-Analysis</PublicationType>
                    </PublicationTypeList>
                </Article>
            </MedlineCitation>
            <PubmedData>
                <ArticleIdList>
                    <ArticleId IdType="doi">10.1016/S2213-8587(25)001</ArticleId>
                </ArticleIdList>
            </PubmedData>
        </PubmedArticle>
    </PubmedArticleSet>
    """

    provider = PubMedProvider()
    with patch("httpx.AsyncClient.get") as mock_get:
        mock_get.side_effect = [
            MagicMock(status_code=200, json=lambda: {"esearchresult": {"idlist": ["39887766"]}}),
            MagicMock(status_code=200, text=mock_xml)
        ]
        results = await provider.search("metformin meta analysis")
        assert len(results) == 1
        assert results[0].evidence_level == "meta_analysis"


# ==============================================================================
# 2. TEST SEMANTIC SCHOLAR PROVIDER (MOCK HTTP)
# ==============================================================================
@pytest.mark.asyncio
async def test_semantic_scholar_provider_success():
    mock_response = {
        "data": [
            {
                "paperId": "abc123def456",
                "title": "Pharmacology of Angiotensin Receptor Blockers",
                "abstract": "This review analyzes the safety and renal protective effects of ARBs in chronic kidney disease.",
                "year": 2023,
                "authors": [{"name": "Dr. Sarah Connor"}, {"name": "Dr. Alan Grant"}],
                "externalIds": {"DOI": "10.1056/NEJMoa2300123"},
                "openAccessPdf": {"url": "https://arxiv.org/pdf/2301.00123.pdf"},
                "publicationTypes": ["Review"],
                "venue": "New England Journal of Medicine"
            }
        ]
    }

    provider = SemanticScholarProvider(api_key="test_key")
    with patch("httpx.AsyncClient.get") as mock_get:
        mock_get.return_value = MagicMock(status_code=200, json=lambda: mock_response)
        results = await provider.search("angiotensin receptor blocker ckd")

        assert len(results) == 1
        res = results[0]
        assert res.title == "Pharmacology of Angiotensin Receptor Blockers"
        assert res.doi == "10.1056/NEJMoa2300123"
        assert res.pdf_url == "https://arxiv.org/pdf/2301.00123.pdf"
        assert res.year == 2023
        assert res.evidence_level == "review"
        assert res.source_type == "journal"
        assert len(res.authors) == 2


# ==============================================================================
# 3. TEST EUROPE PMC PROVIDER (MOCK HTTP)
# ==============================================================================
@pytest.mark.asyncio
async def test_europepmc_provider_success():
    mock_response = {
        "resultList": {
            "result": [
                {
                    "id": "PMC10293847",
                    "title": "Cardiovascular Outcomes with SGLT2 Inhibitors",
                    "abstractText": "<p>SGLT2 inhibitors demonstrate profound reductions in heart failure hospitalizations.</p>",
                    "pubYear": "2024",
                    "authorString": "Zheng X, Miller J, Patel R",
                    "doi": "10.1038/s41569-024-001",
                    "journalTitle": "Nature Reviews Cardiology",
                    "pubTypeList": {"pubType": ["Clinical Trial", "Journal Article"]},
                    "fullTextUrlList": {
                        "fullTextUrl": [
                            {"documentStyle": "pdf", "url": "https://europepmc.org/articles/PMC10293847?pdf=render"}
                        ]
                    }
                }
            ]
        }
    }

    provider = EuropePMCProvider()
    with patch("httpx.AsyncClient.get") as mock_get:
        mock_get.return_value = MagicMock(status_code=200, json=lambda: mock_response)
        results = await provider.search("sglt2 inhibitor heart failure")

        assert len(results) == 1
        res = results[0]
        assert "Cardiovascular Outcomes" in res.title
        assert res.year == 2024
        assert res.evidence_level == "rct"
        assert "<p>" not in res.snippet  # HTML stripped
        assert res.pdf_url == "https://europepmc.org/articles/PMC10293847?pdf=render"


# ==============================================================================
# 4. TEST OPENFDA DRUG LABEL PROVIDER (MOCK HTTP)
# ==============================================================================
@pytest.mark.asyncio
async def test_openfda_label_provider_success():
    mock_response = {
        "results": [
            {
                "openfda": {
                    "brand_name": ["NORVASC"],
                    "generic_name": ["AMLODIPINE BESYLATE"],
                    "substance_name": ["AMLODIPINE BESYLATE"]
                },
                "indications_and_usage": [
                    "NORVASC is indicated for the treatment of hypertension, to lower blood pressure."
                ],
                "dosage_and_administration": [
                    "The usual initial starting dose of NORVASC is 5 mg once daily, with a maximum dose of 10 mg once daily."
                ],
                "warnings": [
                    "Symptomatic hypotension is possible, particularly in patients with severe aortic stenosis."
                ],
                "effective_time": "20240315"
            }
        ]
    }

    provider = OpenFDALabelProvider()
    with patch("httpx.AsyncClient.get") as mock_get:
        mock_get.return_value = MagicMock(status_code=200, json=lambda: mock_response)
        results = await provider.search("amlodipine dosage")

        assert len(results) == 1
        res = results[0]
        assert "NORVASC" in res.title
        assert res.source_type == "label"
        assert res.evidence_level == "drug_label"
        assert "Indikasi:" in res.snippet
        assert "Dosis:" in res.snippet
        assert res.year == 2024
        assert "FDA" in res.authors[0]


# ==============================================================================
# 5. TEST TAVILY PROVIDER (ACTIVE ONLY IF API KEY PRESENT)
# ==============================================================================
@pytest.mark.asyncio
async def test_tavily_provider_disabled_without_key():
    provider = TavilyProvider(api_key="")
    # Tanpa HTTP call harus langsung mengembalikan []
    results = await provider.search("latest biomedical guidelines 2025")
    assert results == []


@pytest.mark.asyncio
async def test_tavily_provider_active_with_key():
    mock_response = {
        "results": [
            {
                "title": "WHO Guidelines on Hypertension Management",
                "url": "https://www.who.int/publications/i/item/9789240033986",
                "content": "WHO releases updated global guidelines for pharmacological treatment of hypertension."
            }
        ]
    }

    provider = TavilyProvider(api_key="tvly-mock-key")
    with patch("httpx.AsyncClient.post") as mock_post:
        mock_post.return_value = MagicMock(status_code=200, json=lambda: mock_response)
        results = await provider.search("who hypertension guideline")

        assert len(results) == 1
        res = results[0]
        assert res.source_type == "web"
        assert res.evidence_level == "web"
        assert res.url == "https://www.who.int/publications/i/item/9789240033986"


# ==============================================================================
# 6. TEST ROUTER: CLASSIFICATION & QUERY REWRITE
# ==============================================================================
def test_search_router_classification():
    # Sapaan & obrolan ringan tidak perlu search
    assert SearchRouter.needs_search("Halo") is False
    assert SearchRouter.needs_search("hai Claudia") is False
    assert SearchRouter.needs_search("siapa kamu") is False
    assert SearchRouter.needs_search("terima kasih banyak") is False
    assert SearchRouter.needs_search("apa kabar?") is False
    assert SearchRouter.needs_search("selamat pagi") is False

    # Pertanyaan medis/faktual butuh search
    assert SearchRouter.needs_search("efek samping amlodipine pada pasien lansia") is True
    assert SearchRouter.needs_search("mekanisme kerja metformin terhadap AMPK") is True
    assert SearchRouter.needs_search("apa perbedaan ADMA dan SDMA pada biomarker ginjal") is True
    assert SearchRouter.needs_search("dosis ibuprofen untuk anak 5 tahun") is True
    assert SearchRouter.needs_search("apakah aspirin aman untuk ibu hamil trimester 3") is True


def test_search_router_query_rewriting():
    queries = SearchRouter.rewrite_queries("efek samping amlodipine pada lansia")
    assert 2 <= len(queries) <= 4
    # Memuat istilah bahasa Inggris untuk repositori akademik
    assert any("amlodipine" in q.lower() for q in queries)
    assert any("adverse" in q.lower() or "safety" in q.lower() or "geriatric" in q.lower() or "elderly" in q.lower() for q in queries)

    # Uji akronim medis
    queries_adma = SearchRouter.rewrite_queries("apa peran ADMA dalam endotel")
    assert any("asymmetric dimethylarginine" in q.lower() for q in queries_adma)


# ==============================================================================
# 7. TEST RANKING, DEDUPLICATION, EVIDENCE WEIGHTS, RECENCY
# ==============================================================================
def test_ranking_deduplication_by_doi_and_url():
    item1 = SearchResult(
        title="Study on Metformin in DM2",
        url="https://doi.org/10.1001/jama.2024.1",
        snippet="Short abstract",
        source_type="journal",
        doi="10.1001/jama.2024.1",
        year=2024,
        evidence_level="journal"
    )
    item2 = SearchResult(
        title="Study on Metformin in DM2 (Full)",
        url="https://europepmc.org/article/MED/12345",
        snippet="Longer, more detailed abstract with complete methodology.",
        source_type="journal",
        doi="10.1001/jama.2024.1",  # Same DOI!
        year=2024,
        evidence_level="rct",  # Higher evidence level
        pdf_url="https://europepmc.org/article/12345.pdf"
    )

    deduped = deduplicate_results([item1, item2])
    assert len(deduped) == 1
    # Metadata terlengkap dipertahankan
    merged = deduped[0]
    assert "detailed abstract" in merged.snippet
    assert merged.evidence_level == "rct"
    assert merged.pdf_url == "https://europepmc.org/article/12345.pdf"


def test_evidence_hierarchy_and_recency_score():
    meta = SearchResult(
        title="Amlodipine Meta-Analysis",
        url="https://example.com/meta",
        snippet="Amlodipine efficacy meta-analysis review.",
        year=2025,
        evidence_level="meta_analysis"
    )
    rct = SearchResult(
        title="Amlodipine RCT Trial",
        url="https://example.com/rct",
        snippet="Amlodipine clinical trial.",
        year=2021,
        evidence_level="rct"
    )
    web = SearchResult(
        title="Amlodipine General Web Article",
        url="https://example.com/web",
        snippet="Amlodipine general web overview.",
        year=2015,
        evidence_level="web"
    )

    ranked = rank_and_select("amlodipine", [web, rct, meta], min_count=1, max_count=5)
    # Meta-analysis harus berada di peringkat 1 karena bobot EBM tertinggi + recency 2025
    assert ranked[0].evidence_level == "meta_analysis"
    assert ranked[1].evidence_level == "rct"
    assert ranked[2].evidence_level == "web"
    assert ranked[0].result_id == 1
    assert ranked[1].result_id == 2
    assert ranked[2].result_id == 3


# ==============================================================================
# 8. TEST SEARCH CACHE (SQLITE & TTL)
# ==============================================================================
def test_search_cache_set_get_and_expiration(tmp_path):
    cache_db = tmp_path / "test_cache.db"
    cache = SearchCache(db_path=cache_db, default_ttl=2)

    sample_results = [
        SearchResult(
            title="Sample Paper",
            url="https://doi.org/10.1234/test",
            snippet="A snippet of evidence.",
            year=2024
        )
    ]

    # Simpan ke cache
    cache.set("Efek Samping Amlodipine?", sample_results, ttl_seconds=2)

    # Ambil dengan normalisasi kueri (lowercase, tanda baca stripped)
    cached = cache.get("efek samping amlodipine")
    assert cached is not None
    assert len(cached) == 1
    assert cached[0].title == "Sample Paper"

    # Simulasi kedaluwarsa TTL
    time.sleep(2.1)
    expired = cache.get("efek samping amlodipine")
    assert expired is None


# ==============================================================================
# 9. TEST CLAIM CHECKER (VERIFIKASI KLAIM BERSITASI)
# ==============================================================================
def test_claim_checker_supported_and_unsupported():
    sources = [
        SearchResult(
            result_id=1,
            title="Amlodipine Pharmacokinetics",
            url="https://example.com/1",
            snippet="Amlodipine has a half-life of 30-50 hours and is metabolized by CYP3A4."
        ),
        SearchResult(
            result_id=2,
            title="Metformin Dosing",
            url="https://example.com/2",
            snippet="Metformin is contraindicated in severe renal impairment eGFR < 30."
        )
    ]

    answer = (
        "Amlodipine memiliki waktu paruh eliminasi berkisar 30-50 jam melalui metabolisme CYP3A4 [1]. "
        "Metformin tidak boleh diberikan pada gangguan ginjal berat dengan eGFR di bawah 30 [2]. "
        "Obat ini terbukti menyembuhkan penyakit Parkinson secara instan dalam 24 jam [1]."
    )

    verified, reports = ClaimChecker.verify_answer_claims(answer, sources, enabled=True)

    # Dua kalimat pertama valid
    assert "CYP3A4 [1]" in verified
    assert "eGFR di bawah 30 [2]" in verified
    # Kalimat ketiga klaim mengada-ada terhadap sumber 1, harus diberi peringatan/tanda
    assert "memerlukan verifikasi tambahan" in verified


def test_claim_checker_disabled_by_env():
    sources = [
        SearchResult(result_id=1, title="Test", url="https://example.com", snippet="Some text")
    ]
    raw_answer = "Klaim tanpa bukti sama sekali [1]."
    # Ketika dimatikan (enabled=False / CLAIM_CHECK=0), teks asli dikembalikan utuh tanpa perubahan
    verified, reports = ClaimChecker.verify_answer_claims(raw_answer, sources, enabled=False)
    assert verified == raw_answer
    assert reports == []


# ==============================================================================
# 10. TEST SEARCH ORCHESTRATOR PARALLELISM & RESILIENCE
# ==============================================================================
@pytest.mark.asyncio
async def test_search_orchestrator_one_provider_failure_does_not_break_all(tmp_path):
    cache_db = tmp_path / "orch_cache.db"
    cache = SearchCache(db_path=cache_db)
    orchestrator = SearchOrchestrator(cache=cache)

    # Provider 1: Gagal (raise Exception / Timeout)
    failing_provider = AsyncMock()
    failing_provider.name = "pubmed"
    failing_provider.search.side_effect = Exception("NCBI Connection Timeout 504")

    # Provider 2: Berhasil
    success_provider = AsyncMock()
    success_provider.name = "europepmc"
    success_provider.search.return_value = [
        SearchResult(
            title="Efficacy of ARB in Hypertension",
            url="https://europepmc.org/123",
            snippet="Blood pressure reduction verified.",
            year=2024,
            evidence_level="rct"
        )
    ]

    orchestrator.providers = {
        "pubmed": failing_provider,
        "europepmc": success_provider
    }

    with patch("app.search.orchestrator.SEARCH_PROVIDERS", "pubmed,europepmc"):
        results = await orchestrator.search("arb hypertension", mode="academic")

        # Provider yang gagal tidak menggagalkan provider lain
        assert len(results) >= 1
        assert "Efficacy of ARB" in results[0].title
