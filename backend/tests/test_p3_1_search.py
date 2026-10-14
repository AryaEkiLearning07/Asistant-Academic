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


# ==============================================================================
# 11. P3-1B TESTS: RATE LIMIT & RETRY BACKOFF (PUBMED & SEMANTIC SCHOLAR)
# ==============================================================================
@pytest.mark.asyncio
async def test_pubmed_retry_on_429():
    from app.search.models import classify_evidence_level
    provider = PubMedProvider(api_key="mock_key", timeout=5.0)
    resp_429_1 = MagicMock(status_code=429, headers={"Retry-After": "0.01"})
    resp_429_2 = MagicMock(status_code=429, headers={})
    resp_200_search = MagicMock(status_code=200, json=lambda: {"esearchresult": {"idlist": ["12345"]}})

    mock_xml = """<?xml version="1.0"?><PubmedArticleSet><PubmedArticle>
    <MedlineCitation><PMID>12345</PMID><Article><ArticleTitle>Warfarin Aspirin Study</ArticleTitle>
    <Journal><Title>J Throm</Title></Journal><Abstract><AbstractText>Interaction trial.</AbstractText></Abstract>
    </Article></MedlineCitation></PubmedArticle></PubmedArticleSet>"""
    resp_200_fetch = MagicMock(status_code=200, text=mock_xml)

    with patch("httpx.AsyncClient.get") as mock_get, patch("asyncio.sleep", return_value=None):
        mock_get.side_effect = [resp_429_1, resp_429_2, resp_200_search, resp_200_fetch]
        results = await provider.search("warfarin aspirin")
        assert len(results) == 1
        assert "Warfarin Aspirin" in results[0].title
        assert mock_get.call_count == 4


@pytest.mark.asyncio
async def test_pubmed_combined_esearch_single_efetch():
    provider = PubMedProvider(api_key="mock_key", timeout=5.0)

    search_resp_1 = MagicMock(status_code=200, json=lambda: {"esearchresult": {"idlist": ["1001", "1002"]}})
    search_resp_2 = MagicMock(status_code=200, json=lambda: {"esearchresult": {"idlist": ["1002", "1003"]}})

    combined_xml = """<?xml version="1.0"?><PubmedArticleSet>
    <PubmedArticle><MedlineCitation><PMID>1001</PMID><Article><ArticleTitle>Paper 1001</ArticleTitle>
    <Journal><Title>J1</Title></Journal><Abstract><AbstractText>Text 1</AbstractText></Abstract></Article></MedlineCitation></PubmedArticle>
    <PubmedArticle><MedlineCitation><PMID>1002</PMID><Article><ArticleTitle>Paper 1002</ArticleTitle>
    <Journal><Title>J2</Title></Journal><Abstract><AbstractText>Text 2</AbstractText></Abstract></Article></MedlineCitation></PubmedArticle>
    <PubmedArticle><MedlineCitation><PMID>1003</PMID><Article><ArticleTitle>Paper 1003</ArticleTitle>
    <Journal><Title>J3</Title></Journal><Abstract><AbstractText>Text 3</AbstractText></Abstract></Article></MedlineCitation></PubmedArticle>
    </PubmedArticleSet>"""
    fetch_resp = MagicMock(status_code=200, text=combined_xml)

    with patch("httpx.AsyncClient.get") as mock_get:
        mock_get.side_effect = [search_resp_1, search_resp_2, fetch_resp]
        results = await provider.search_queries(["query 1", "query 2"], limit_per_query=4, max_total=6)

        assert mock_get.call_count == 3
        fetch_call = mock_get.call_args_list[2]
        called_params = fetch_call.kwargs.get("params") or fetch_call[1].get("params")
        assert "1001,1002,1003" == called_params.get("id")
        assert len(results) == 3


@pytest.mark.asyncio
async def test_semantic_scholar_retry_on_429_and_api_key():
    provider = SemanticScholarProvider(api_key="custom_s2_key")
    assert provider.api_key == "custom_s2_key"
    assert provider.throttler.req_per_second == 10.0

    resp_429 = MagicMock(status_code=429, headers={"Retry-After": "0.01"})
    mock_data = {
        "data": [
            {
                "paperId": "p1",
                "title": "Bleeding Risk with Warfarin and Aspirin",
                "abstract": "Dual therapy increases bleeding.",
                "year": 2024,
                "publicationTypes": ["Review"],
                "venue": "Blood Journal"
            }
        ]
    }
    resp_200 = MagicMock(status_code=200, json=lambda: mock_data)

    with patch("httpx.AsyncClient.get") as mock_get, patch("asyncio.sleep", return_value=None):
        mock_get.side_effect = [resp_429, resp_200]
        results = await provider.search("warfarin aspirin")

        assert len(results) == 1
        assert "Bleeding Risk with Warfarin and Aspirin" in results[0].title
        assert results[0].evidence_level == "review"

        first_call = mock_get.call_args_list[0]
        headers = first_call.kwargs.get("headers") or first_call[1].get("headers")
        assert headers.get("x-api-key") == "custom_s2_key"


# ==============================================================================
# 12. P3-1B TESTS: RELEVANCE, QUERY REWRITE & DRUG EXTRACTION
# ==============================================================================
def test_query_rewrite_drug_extraction_warfarin_aspirin():
    q = "interaksi warfarin dengan aspirin risiko perdarahan"
    drugs = SearchRouter.extract_drug_entities(q)
    assert "warfarin" in drugs
    assert "aspirin" in drugs

    rewritten = SearchRouter.rewrite_queries(q)
    assert len(rewritten) >= 2
    for r in rewritten:
        r_lower = r.lower()
        assert "warfarin" in r_lower
        assert "aspirin" in r_lower


def test_translate_fallback_non_llm_dictionary():
    q = "interaksi warfarin dengan aspirin risiko perdarahan"
    translated = SearchRouter.translate_to_english_fallback(q)
    t_lower = translated.lower()
    assert "warfarin" in t_lower
    assert "aspirin" in t_lower
    assert "interaction" in t_lower
    assert "bleeding" in t_lower
    assert "risk" in t_lower


@pytest.mark.asyncio
async def test_openfda_skips_when_no_drug_detected():
    provider = OpenFDALabelProvider()
    with patch("httpx.AsyncClient.get") as mock_get:
        results = await provider.search("bagaimana cara konfigurasi router osi layer")
        assert results == []
        mock_get.assert_not_called()


@pytest.mark.asyncio
async def test_openfda_targets_detected_drugs():
    provider = OpenFDALabelProvider()
    mock_fda_response = {
        "results": [
            {
                "openfda": {"brand_name": ["COUMADIN"], "generic_name": ["WARFARIN SODIUM"]},
                "drug_interactions": ["Concomitant use of aspirin with warfarin increases the risk of bleeding."],
                "warnings": ["Bleeding is the most common adverse reaction."],
                "effective_time": "20240101"
            }
        ]
    }
    with patch("httpx.AsyncClient.get") as mock_get:
        mock_get.return_value = MagicMock(status_code=200, json=lambda: mock_fda_response)
        results = await provider.search(
            "interaksi warfarin dengan aspirin risiko perdarahan",
            detected_drugs=["warfarin", "aspirin"]
        )
        assert len(results) >= 1
        res = results[0]
        assert "COUMADIN" in res.title
        assert "Interaksi:" in res.snippet
        assert "aspirin with warfarin increases the risk of bleeding" in res.snippet


def test_ranking_filters_unrelated_entities_moxifloxacin_fontan_ibrutinib():
    query = "interaksi warfarin dengan aspirin risiko perdarahan"
    key_drugs = ["warfarin", "aspirin"]

    item_moxifloxacin = SearchResult(
        title="Moxifloxacin in Community-Acquired Pneumonia: A Meta-Analysis",
        url="https://doi.org/10.1001/moxi",
        snippet="Efficacy and safety of moxifloxacin in respiratory tract infections.",
        evidence_level="meta_analysis",
        year=2025
    )
    item_fontan = SearchResult(
        title="Fontan Procedure Outcomes in Pediatric Congenital Heart Disease: An RCT",
        url="https://doi.org/10.1001/fontan",
        snippet="Surgical hemodynamics in Fontan palliation patients.",
        evidence_level="rct",
        year=2024
    )
    item_ibrutinib = SearchResult(
        title="Ibrutinib in Relapsed Chronic Lymphocytic Leukemia",
        url="https://doi.org/10.1001/ibrutinib",
        snippet="Monotherapy with BTK inhibitor ibrutinib in CLL patients.",
        evidence_level="systematic_review",
        year=2024
    )

    item_relevant_1 = SearchResult(
        title="Risk of Bleeding with Warfarin and Aspirin Co-administration: A Systematic Review",
        url="https://doi.org/10.1001/warfarin-aspirin",
        snippet="The combination of warfarin and aspirin significantly increases major hemorrhage risk.",
        evidence_level="systematic_review",
        year=2024
    )
    item_relevant_2 = SearchResult(
        title="Bleeding Outcomes with Dual Warfarin and Aspirin Therapy: A Cohort Study",
        url="https://doi.org/10.1001/warfarin-aspirin-cohort",
        snippet="Investigating gastrointestinal bleeding risk when aspirin is added to warfarin anticoagulation.",
        evidence_level="observational",
        year=2023
    )

    ranked = rank_and_select(
        query=query,
        results=[item_moxifloxacin, item_fontan, item_ibrutinib, item_relevant_1, item_relevant_2],
        min_count=2,
        max_count=5,
        key_entities=key_drugs
    )

    assert len(ranked) >= 2
    top_titles = [r.title for r in ranked[:2]]
    assert any("Warfarin and Aspirin Co-administration" in t for t in top_titles)

    assert "Moxifloxacin" not in ranked[0].title
    assert "Fontan" not in ranked[0].title
    assert "Ibrutinib" not in ranked[0].title


# ==============================================================================
# 13. P3-1B TESTS: EVIDENCE LEVEL CLASSIFICATION (REVIEW VS RCT)
# ==============================================================================
def test_evidence_classification_review_not_labeled_rct():
    from app.search.models import classify_evidence_level
    pub_types = ["Review", "Journal Article"]
    title = "Contemporary Management of Atrial Fibrillation: A Clinical Review"
    abstract_with_rct_mention = (
        "In this comprehensive review, we evaluate multiple randomized controlled trials (RCTs) "
        "and clinical trials investigating stroke prevention with anticoagulation."
    )

    level = classify_evidence_level(
        pub_types=pub_types,
        title=title,
        text=abstract_with_rct_mention
    )
    assert level == "review"


def test_evidence_classification_systematic_review_priority():
    from app.search.models import classify_evidence_level
    pub_types = ["Systematic Review"]
    title = "Bleeding Complications in Combined Antiplatelet and Anticoagulation"
    abstract = "Systematic review of 12 clinical trials and randomized controlled studies."

    level = classify_evidence_level(
        pub_types=pub_types,
        title=title,
        text=abstract
    )
    assert level == "systematic_review"


def test_evidence_classification_title_and_abstract_fallback():
    from app.search.models import classify_evidence_level
    level_meta = classify_evidence_level(
        pub_types=["Journal Article"],
        title="Efficacy of SGLT2 Inhibitors: A Meta-Analysis of Randomized Trials",
        text="Background and methods."
    )
    assert level_meta == "meta_analysis"

    level_rct = classify_evidence_level(
        pub_types=[],
        title="Amlodipine vs Placebo in Isolated Systolic Hypertension: A Randomized Controlled Trial",
        text="A double-blind trial."
    )
    assert level_rct == "rct"

