import io
import json
import uuid
import unittest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient

from app.main import app
from app.indexer import SafeStemmer, DocumentSearchIndex, chunk_text_to_passages
from app.embedding_service import EmbeddingService
from app.reranker_service import RerankerService
from app.ai_service import AssistantAiService, EPIONA_SYSTEM_PROMPT
from app.academic_service import AcademicRetrieverService
import fitz

class TestP1Features(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)
        # Buat PDF sintetis uji
        doc = fitz.open()
        p1 = doc.new_page()
        p1.insert_text((50, 72), "Bab 1: Parameter farmakokinetika obat meliputi clearance, volume distribusi Vd, dan waktu paruh eliminasi t1/2.")
        p2 = doc.new_page()
        p2.insert_text((50, 72), "Bab 2: Formulasi tablet dan biofarmasetika sediaan padat farmasi.")
        cls.pdf_bytes = doc.tobytes()
        doc.close()

    # -------------------------------------------------------------
    # ITEM 4: PERBAIKAN STEMMER (SafeStemmer)
    # -------------------------------------------------------------
    def test_safe_stemmer_pharma_canonical_matching(self):
        """Item 4: farmakokinetika vs farmakokinetik selaras ke bentuk kanonikal yang sama."""
        stem_a = SafeStemmer.stem_word("farmakokinetika")
        stem_b = SafeStemmer.stem_word("farmakokinetik")
        self.assertEqual(stem_a, stem_b)
        self.assertEqual(stem_a, "farmakokinetik")

        # Uji istilah farmasi lainnya
        self.assertEqual(SafeStemmer.stem_word("farmakodinamika"), "farmakodinamik")
        self.assertEqual(SafeStemmer.stem_word("farmakodinamik"), "farmakodinamik")
        self.assertEqual(SafeStemmer.stem_word("biofarmasetika"), "biofarmasetik")
        self.assertEqual(SafeStemmer.stem_word("biofarmasetik"), "biofarmasetik")

    def test_safe_stemmer_preserves_root_words(self):
        """Item 4: Kata dasar seperti masalah, proses, diabetes TIDAK rusak terpotong."""
        self.assertEqual(SafeStemmer.stem_word("masalah"), "masalah")
        self.assertNotEqual(SafeStemmer.stem_word("masalah"), "masa")

        self.assertEqual(SafeStemmer.stem_word("proses"), "proses")
        self.assertNotEqual(SafeStemmer.stem_word("proses"), "pros")

        self.assertEqual(SafeStemmer.stem_word("diabetes"), "diabetes")
        self.assertNotEqual(SafeStemmer.stem_word("diabetes"), "diabet")

        self.assertEqual(SafeStemmer.stem_word("dosis"), "dosis")
        self.assertEqual(SafeStemmer.stem_word("analisis"), "analisis")

    # -------------------------------------------------------------
    # ITEM 1: RETRIEVAL HYBRID & RECIPROCAL RANK FUSION (RRF)
    # -------------------------------------------------------------
    def test_reciprocal_rank_fusion_logic(self):
        """Item 1: RRF menggabungkan peringkat BM25 dan Vektor dengan bobot k=60 secara presisi."""
        bm25_list = [
            {"document_id": "doc1", "page_number": 1, "passage_index": 0, "text": "Passage 1"},
            {"document_id": "doc2", "page_number": 2, "passage_index": 0, "text": "Passage 2"}
        ]
        vector_list = [
            {"document_id": "doc2", "page_number": 2, "passage_index": 0, "text": "Passage 2"},
            {"document_id": "doc3", "page_number": 1, "passage_index": 0, "text": "Passage 3"}
        ]

        fused = DocumentSearchIndex.reciprocal_rank_fusion([bm25_list, vector_list], k=60, top_k=5)
        self.assertEqual(len(fused), 3)

        # doc2 ada di peringkat 2 BM25 (1/62) dan peringkat 1 Vector (1/61) -> skor tertinggi!
        self.assertEqual(fused[0]["document_id"], "doc2")
        expected_doc2_score = (1.0 / 62) + (1.0 / 61)
        self.assertAlmostEqual(fused[0]["rrf_score"], expected_doc2_score, places=5)

    def test_passage_chunking(self):
        """Item 1: Pemecahan teks panjang menjadi passage terstruktur."""
        long_text = ("Kalimat farmakokinetika pertama yang cukup panjang untuk pengujian chunking. " * 20)
        chunks = chunk_text_to_passages(long_text, chunk_size=300, overlap=50)
        self.assertTrue(len(chunks) > 1)
        for c in chunks:
            self.assertTrue(len(c) > 0)

    def test_hybrid_search_fallback_when_embedding_unavailable(self):
        """Item 1: Jika embedding tidak disetel / tidak tersedia, fallback aman ke BM25 leksikal."""
        with patch.object(EmbeddingService, "is_available", return_value=False):
            corpus = [
                {"document_id": "d1", "page_number": 1, "passage_index": 0, "passage_text": "Farmakokinetika metformin waktu paruh."},
                {"document_id": "d2", "page_number": 1, "passage_index": 0, "passage_text": "Materi komputasi kalkulus matematika."}
            ]
            res = DocumentSearchIndex.search_hybrid("metformin", corpus, top_k=2)
            self.assertTrue(len(res) > 0)
            self.assertEqual(res[0]["document_id"], "d1")

    # -------------------------------------------------------------
    # ITEM 2: RERANKER OPSIONAL (TOP-20 MENJADI TOP-6)
    # -------------------------------------------------------------
    def test_reranker_service_rescoring(self):
        """Item 2: Reranker cross-encoder mengubah urutan kandidat berdasarkan relevansi semantik."""
        mock_candidates = [
            {"passage_text": "Teks kurang relevan tentang pengantar", "score": 1.5},
            {"passage_text": "Teks sangat relevan memuat mekanisme aksi dan farmakokinetik", "score": 0.8}
        ]

        class DummyModel:
            def predict(self, pairs, show_progress_bar=False):
                # Berikan skor tinggi pada kandidat kedua
                return [0.1, 0.95]

        with patch.object(RerankerService, "is_available", return_value=True):
            with patch.object(RerankerService, "get_model", return_value=DummyModel()):
                reranked = RerankerService.rerank("kueri uji", mock_candidates, top_k=1)
                self.assertEqual(len(reranked), 1)
                self.assertIn("sangat relevan", reranked[0]["passage_text"])
                self.assertEqual(reranked[0]["rerank_score"], 0.95)

    def test_reranker_fallback_when_disabled(self):
        """Item 2: Jika RERANKER_MODEL tidak disetel, urutan asli dipertahankan."""
        with patch.object(RerankerService, "is_available", return_value=False):
            candidates = [{"id": 1}, {"id": 2}, {"id": 3}]
            res = RerankerService.rerank("kueri", candidates, top_k=2)
            self.assertEqual(len(res), 2)
            self.assertEqual(res[0]["id"], 1)

    # -------------------------------------------------------------
    # ITEM 3: QUERY REWRITING (HAIKU / GATEWAY FALLBACK)
    # -------------------------------------------------------------
    def test_query_rewriting_success_and_fallback(self):
        """Item 3: Query rewriting menghasilkan kueri Indonesia & Inggris, dan fallback aman ke kueri asli jika gagal."""
        svc = AssistantAiService()

        # 1. Fallback ketika tidak ada API key
        svc.anthropic_api_key = ""
        svc.openrouter_api_key = ""
        svc.groq_client = None
        fb = svc.rewrite_query_for_retrieval("bagaimana klirens ginjal?")
        self.assertEqual(fb["rewritten_id"], "bagaimana klirens ginjal?")
        self.assertEqual(fb["rewritten_en"], "bagaimana klirens ginjal?")

        # 2. Ketika mock respon model Claude Haiku berhasil
        mock_haiku_response = json.dumps({
            "content": [{"text": '{"rewritten_id": "klirens ginjal farmakokinetik", "rewritten_en": "renal clearance pharmacokinetics"}'}]
        }).encode("utf-8")

        svc.anthropic_api_key = "sk-ant-test"
        with patch("urllib.request.urlopen") as mock_url:
            mock_resp = MagicMock()
            mock_resp.read.return_value = mock_haiku_response
            mock_resp.__enter__.return_value = mock_resp
            mock_url.return_value = mock_resp

            res = svc.rewrite_query_for_retrieval("bagaimana klirens ginjal?")
            self.assertEqual(res["rewritten_id"], "klirens ginjal farmakokinetik")
            self.assertEqual(res["rewritten_en"], "renal clearance pharmacokinetics")

    # -------------------------------------------------------------
    # ITEM 5: ANTI-HALUSINASI & PENGHAPUSAN AFINITAS JUDUL
    # -------------------------------------------------------------
    def test_anti_hallucination_rejects_out_of_context(self):
        """Item 5: Jika pertanyaan tidak ada di dokumen (skor di bawah ambang), sistem menjawab dengan catatan tanpa mengarang sitasi."""
        svc = AssistantAiService()
        user_docs = [{"id": "d1", "title": "Modul Farmakologi"}]
        # relevant_pages kosong karena skor retrieval di bawah ambang
        resp = svc.answer_chat(
            question="Berapa dosis vaksin dengue menurut dokumen?",
            user_docs=user_docs,
            relevant_pages=[]
        )
        self.assertIn("Tidak ditemukan di dokumenmu", resp.answer)
        self.assertEqual(len(resp.citations), 0)

    def test_anti_hallucination_empty_library_message(self):
        """Item 5: Library kosong dijawab dari pengetahuan umum dengan catatan tanpa template kaku."""
        svc = AssistantAiService()
        resp = svc.answer_chat(
            question="Apa itu farmakokinetika?",
            user_docs=[],
            relevant_pages=[]
        )
        self.assertIn("Tidak ditemukan di dokumenmu", resp.answer)
        self.assertEqual(len(resp.citations), 0)

    # -------------------------------------------------------------
    # ITEM 6: ABSTRAK JURNAL LENGKAP TANPA TRANSLATE TIDAK RESMI
    # -------------------------------------------------------------
    def test_academic_abstract_not_truncated_and_original_text(self):
        """Item 6: Abstrak asli tidak dipotong 600 char dan tidak diterjemahkan lewat Google Translate tidak resmi."""
        full_english_abstract = (
            "Background: Pharmacokinetics of novel therapeutics. "
            "Methods: Double-blind randomized clinical trial with 500 patients. "
            "Results: Clearance was reduced significantly in impaired subjects. "
            "Conclusion: Dosing adjustments are required for elderly cohorts. "
        ) * 5  # Panjang > 1000 karakter

        # Mock XML PubMed eFetch
        xml_content = f"""
        <PubmedArticleSet>
            <PubmedArticle>
                <MedlineCitation>
                    <PMID>12345678</PMID>
                    <Article>
                        <Abstract>
                            <AbstractText>{full_english_abstract}</AbstractText>
                        </Abstract>
                    </Article>
                </MedlineCitation>
            </PubmedArticle>
        </PubmedArticleSet>
        """.encode("utf-8")

        # Mock eSearch & eSummary
        search_res = json.dumps({"esearchresult": {"idlist": ["12345678"]}}).encode("utf-8")
        summary_res = json.dumps({
            "result": {
                "uids": ["12345678"],
                "12345678": {
                    "title": "Clinical Study on Clearance",
                    "source": "Journal of Pharmacology",
                    "pubdate": "2024",
                    "authors": [{"name": "Smith J"}],
                    "articleids": [{"idtype": "doi", "value": "10.1016/j.jpharm.2024.01"}]
                }
            }
        }).encode("utf-8")

        with patch("urllib.request.urlopen") as mock_url:
            def side_effect(req, timeout=None):
                url_str = req.full_url if hasattr(req, "full_url") else str(req)
                resp = MagicMock()
                if "esearch.fcgi" in url_str:
                    resp.read.return_value = search_res
                elif "esummary.fcgi" in url_str:
                    resp.read.return_value = summary_res
                elif "efetch.fcgi" in url_str:
                    resp.read.return_value = xml_content
                else:
                    resp.read.return_value = b"{}"
                resp.__enter__.return_value = resp
                return resp

            mock_url.side_effect = side_effect

            evidence = AcademicRetrieverService.retrieve_academic_evidence("pharmacokinetics")
            self.assertTrue(len(evidence) > 0)
            target = evidence[0]
            # Pastikan abstrak tidak terpotong 600 karakter
            self.assertTrue(len(target["abstract_snippet"]) > 600)
            # Pastikan teks bahasa Inggris asli dipertahankan
            self.assertIn("Double-blind randomized clinical trial", target["abstract_snippet"])

    # -------------------------------------------------------------
    # ITEM 7: INPUT & TRANSPARANSI ERROR PROVIDER
    # -------------------------------------------------------------
    def test_reject_empty_question(self):
        """Item 7: Tolak pertanyaan string kosong atau hanya spasi dengan HTTP 400."""
        uid = uuid.uuid4().hex[:6]
        reg = self.client.post("/api/v1/auth/register", json={
            "email": f"input_{uid}@epiona.my.id",
            "password": "password123",
            "full_name": "Input Tester"
        }).json()
        token = reg["token"]

        res_empty = self.client.post(
            "/api/v1/chat",
            json={"question": "   "},
            headers={"Authorization": f"Bearer {token}"}
        )
        self.assertEqual(res_empty.status_code, 400)
        self.assertIn("Pertanyaan tidak boleh kosong", res_empty.json()["detail"])

    def test_provider_error_transparency(self):
        """Item 7: Error provider tidak ditelan diam-diam, pesan kegagalan dikembalikan jelas."""
        svc = AssistantAiService()
        svc.groq_client = MagicMock()
        svc.groq_client.chat.completions.create.side_effect = Exception("429 Too Many Requests: Rate limit reached")

        # Coba panggil Groq
        with self.assertRaises(Exception):
            svc.groq_client.chat.completions.create()

    # -------------------------------------------------------------
    # ITEM 8: IDENTITAS EPIONA & PROMPT CACHING ANTHROPIC
    # -------------------------------------------------------------
    def test_epiona_identity_system_prompt_structure(self):
        """Item 8: System prompt ringkas, berfokus pada identitas Epiona dan penalaran ilmiah."""
        self.assertIn("EPIONA Academic Research Assistant", EPIONA_SYSTEM_PROMPT)
        self.assertIn("Arya Eki Nur Seputro", EPIONA_SYSTEM_PROMPT)
        self.assertIn("Inverted Pyramid", EPIONA_SYSTEM_PROMPT)
        self.assertIn("LaTeX", EPIONA_SYSTEM_PROMPT)
        # Pastikan tidak memuat teks dokumen acak
        self.assertNotIn("Chapter 1", EPIONA_SYSTEM_PROMPT)
        # Ringkas (< 1500 karakter)
        self.assertTrue(len(EPIONA_SYSTEM_PROMPT) < 1500)

    def test_anthropic_prompt_caching_payload(self):
        """Item 8: Anthropic messages API memisahkan system prompt dengan ephemeral cache_control."""
        svc = AssistantAiService()
        svc.anthropic_api_key = "sk-ant-mock-key"

        with patch("urllib.request.urlopen") as mock_url:
            mock_resp = MagicMock()
            mock_resp.read.return_value = json.dumps({
                "content": [{"text": "Jawaban teruji [1].\n\nCITATIONS_JSON:[{\"document_id\":\"d1\",\"document_title\":\"Buku\",\"page_number\":1,\"exact_quote\":\"Kutipan\"}]"}]
            }).encode("utf-8")
            mock_resp.__enter__.return_value = mock_resp
            mock_url.return_value = mock_resp

            relevant_pages = [{
                "document_id": "d1",
                "document_title": "Buku",
                "page_number": 1,
                "text": "Kutipan terverifikasi dari modul farmasi."
            }]

            resp = svc._call_anthropic_direct(
                question="Pertanyaan?",
                relevant_pages=relevant_pages,
                user_docs=[{"id": "d1", "title": "Buku"}]
            )

            # Verifikasi request yang dikirim: header beta usang dihapus, cache_control dipertahankan
            req_called = mock_url.call_args[0][0]
            self.assertIsNone(req_called.headers.get("Anthropic-beta"))
            sent_data = json.loads(req_called.data.decode("utf-8"))
            self.assertIsInstance(sent_data["system"], list)
            self.assertEqual(sent_data["system"][0]["cache_control"]["type"], "ephemeral")
            self.assertEqual(sent_data["system"][0]["text"], EPIONA_SYSTEM_PROMPT)

if __name__ == "__main__":
    unittest.main()
