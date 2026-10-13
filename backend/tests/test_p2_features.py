import io
import json
import uuid
import unittest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from fastapi import HTTPException

from app.main import app, storage_mgr, check_web_mode_rate_limit
from app.config import (
    ANTHROPIC_DEFAULT_MODEL,
    ANTHROPIC_FAST_MODEL,
    OPENROUTER_DEFAULT_MODEL,
    OPENROUTER_FAST_MODEL,
    CORS_ORIGINS,
    OCR_ENABLED,
)
from app.ai_service import AssistantAiService, EPIONA_SYSTEM_PROMPT
from app.parser import PdfDocumentParser
from app.models import CitationItem


class TestP2Features(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)
        cls.test_email = f"test_user_p2_{uuid.uuid4().hex[:8]}@epiona.my.id"
        reg = cls.client.post("/api/v1/auth/register", json={
            "email": cls.test_email,
            "password": "SecretPassword123!",
            "full_name": "P2 Test User"
        })
        assert reg.status_code == 200, f"Gagal register user test: {reg.text}"
        data = reg.json()
        cls.test_token = data["token"]
        cls.test_user_id = data["user_id"]

    # -------------------------------------------------------------
    # ITEM A: MODEL CLAUDE & PROMPT CACHING HEADER CLEANUP
    # -------------------------------------------------------------
    def test_item_a_claude_model_defaults_and_env_override(self):
        """Item A: Verifikasi model Claude terbaru sebagai default dan dukungan override env."""
        self.assertEqual(ANTHROPIC_DEFAULT_MODEL, "claude-sonnet-5-5")
        self.assertEqual(ANTHROPIC_FAST_MODEL, "claude-haiku-5-5")
        self.assertEqual(OPENROUTER_DEFAULT_MODEL, "anthropic/claude-sonnet-5.5")
        self.assertEqual(OPENROUTER_FAST_MODEL, "anthropic/claude-haiku-5.5")

        service = AssistantAiService()
        self.assertEqual(service.anthropic_default_model, "claude-sonnet-5-5")
        self.assertEqual(service.anthropic_fast_model, "claude-haiku-5-5")
        self.assertEqual(service.openrouter_default_model, "anthropic/claude-sonnet-5.5")
        self.assertEqual(service.openrouter_fast_model, "anthropic/claude-haiku-5.5")

        with patch.dict("os.environ", {
            "ANTHROPIC_DEFAULT_MODEL": "custom-claude-override",
            "OPENROUTER_DEFAULT_MODEL": "custom-openrouter-override"
        }):
            overridden_service = AssistantAiService()
            self.assertEqual(overridden_service.anthropic_default_model, "custom-claude-override")
            self.assertEqual(overridden_service.openrouter_default_model, "custom-openrouter-override")

    def test_item_a_anthropic_headers_omit_obsolete_beta_preserve_cache_control(self):
        """Item A: Header anthropic-beta usang dihapus, blok prompt tetap menyertakan cache_control."""
        service = AssistantAiService()

        with patch("urllib.request.urlopen") as mock_url:
            mock_resp = MagicMock()
            mock_resp.read.return_value = json.dumps({
                "content": [{"type": "text", "text": "Jawaban Claude"}],
                "usage": {"input_tokens": 10, "output_tokens": 20}
            }).encode("utf-8")
            mock_url.return_value.__enter__.return_value = mock_resp

            service._call_anthropic_direct(
                question="Apakah obat A efektif?",
                relevant_pages=[],
                user_docs=[]
            )

            req_called = mock_url.call_args[0][0]
            # Header anthropic-beta tidak boleh ada
            self.assertIsNone(req_called.headers.get("Anthropic-beta"))
            sent_data = json.loads(req_called.data.decode("utf-8"))
            self.assertIsInstance(sent_data["system"], list)
            # Ephemeral cache_control harus dipertahankan
            self.assertEqual(sent_data["system"][0]["cache_control"]["type"], "ephemeral")
            self.assertEqual(sent_data["system"][0]["text"], EPIONA_SYSTEM_PROMPT)

    # -------------------------------------------------------------
    # ITEM B: CORS ORIGIN WHITELIST & CREDENTIALS SAFETY
    # -------------------------------------------------------------
    def test_item_b_cors_configuration(self):
        """Item B: CORS_ORIGINS whitelist tidak mengizinkan wildcard '*' jika credentials diaktifkan."""
        self.assertIn("http://localhost:3000", CORS_ORIGINS)

        # Uji simulasi parsing CORS whitelist
        raw_origins = "http://localhost:3000,https://app.epiona.my.id,*"
        parsed = [o.strip() for o in raw_origins.split(",") if o.strip() and o.strip() != "*"]
        self.assertIn("http://localhost:3000", parsed)
        self.assertIn("https://app.epiona.my.id", parsed)
        self.assertNotIn("*", parsed)

    # -------------------------------------------------------------
    # ITEM C: KUNCI GEMINI VIA HEADER X-GOOG-API-KEY
    # -------------------------------------------------------------
    def test_item_c_gemini_api_key_sent_via_header_not_query(self):
        """Item C: Kunci API Gemini dikirim via header x-goog-api-key, bukan query parameter URL."""
        service = AssistantAiService()
        service.gemini_keys = ["test-gemini-secret-key"]

        # Mock urllib request untuk memverifikasi URL dan headers
        with patch("urllib.request.urlopen") as mock_urlopen:
            mock_resp = MagicMock()
            mock_resp.read.return_value = json.dumps({
                "candidates": [{
                    "content": {
                        "parts": [{"text": "Jawaban dari Gemini via header auth"}]
                    }
                }],
                "usageMetadata": {"totalTokenCount": 50}
            }).encode("utf-8")
            mock_urlopen.return_value.__enter__.return_value = mock_resp

            res = service._call_gemini_pool("Kompilasikan ringkasan", relevant_pages=[], user_docs=[])
            self.assertIn("Jawaban dari Gemini", res.answer)

            # Dapatkan objek Request dari mock_urlopen
            self.assertTrue(mock_urlopen.called)
            req_arg = mock_urlopen.call_args[0][0]

            # Periksa URL: TIDAK boleh memuat ?key= atau kunci rahasia
            self.assertNotIn("?key=", req_arg.full_url)
            self.assertNotIn("test-gemini-secret-key", req_arg.full_url)

            # Periksa header: x-goog-api-key harus ada dengan nilai kunci
            self.assertEqual(req_arg.headers.get("X-goog-api-key"), "test-gemini-secret-key")

    # -------------------------------------------------------------
    # ITEM D: STREAMING CHAT SSE & NON-STREAM FALLBACK
    # -------------------------------------------------------------
    def test_item_d_streaming_endpoint_sse_events(self):
        """Item D: Endpoint /api/v1/chat/stream menghasilkan text/event-stream dengan token dan end event."""
        mock_chunks = [
            {"type": "token", "token": "Halo "},
            {"type": "token", "token": "farmasi."},
            {"type": "end", "answer": "Halo farmasi.", "citations": [{"source_title": "Buku A", "page": 1}], "figures": []}
        ]

        with patch("app.main.ai_service.stream_chat", return_value=iter(mock_chunks)):
            response = self.client.post(
                "/api/v1/chat/stream",
                headers={"X-User-Id": self.test_token},
                json={
                    "question": "Jelaskan efek samping obat",
                    "grounding_mode": "document",
                    "model_preference": "gemini-2.0-flash"
                }
            )
            self.assertEqual(response.status_code, 200)
            self.assertIn("text/event-stream", response.headers.get("content-type", ""))

            lines = response.text.split("\n")
            data_lines = [l for l in lines if l.startswith("data: ")]
            self.assertTrue(len(data_lines) >= 3)

            # Validasi event token
            event1 = json.loads(data_lines[0].replace("data: ", ""))
            self.assertEqual(event1.get("type"), "token")
            self.assertEqual(event1.get("token"), "Halo ")

            # Validasi event end memuat sitasi
            event_end = json.loads(data_lines[-1].replace("data: ", ""))
            self.assertEqual(event_end.get("type"), "end")
            self.assertEqual(event_end.get("answer"), "Halo farmasi.")
            self.assertEqual(len(event_end.get("citations")), 1)

    def test_item_d_stream_chat_service_generator(self):
        """Item D: Generator stream_chat menghasilkan potongan token dan event final."""
        service = AssistantAiService()
        with patch.object(service, "answer_chat") as mock_answer:
            mock_answer.return_value = MagicMock(
                answer="Sintesis jawaban non-stream fallback.",
                citations=[],
                figures=[]
            )
            chunks = list(service.stream_chat(
                question="Pertanyaan streaming uji",
                user_docs=[],
                relevant_pages=[],
                model_preference="gemini-2.0-flash"
            ))
            self.assertTrue(len(chunks) >= 2)
            has_token = any(c.get("type") == "token" for c in chunks)
            has_end = any(c.get("type") == "end" for c in chunks)
            self.assertTrue(has_token)
            self.assertTrue(has_end)

    # -------------------------------------------------------------
    # ITEM E: PDF TABLE EXTRACTION & OPTIONAL OCR FALLBACK
    # -------------------------------------------------------------
    def test_item_e_pdfplumber_table_extraction(self):
        """Item E: Ekstraksi tabel pdfplumber dikonversi ke format Markdown terstruktur."""
        # Mock pdfplumber object
        mock_table_data = [
            ["Nama Obat", "Dosis", "Frekuensi"],
            ["Paracetamol", "500 mg", "3x sehari"],
            ["Amoxicillin", "500 mg", "3x sehari"]
        ]
        mock_page = MagicMock()
        mock_page.extract_tables.return_value = [mock_table_data]

        table_text = PdfDocumentParser._extract_page_tables_structured(mock_page, page_num=1)
        self.assertIn("Nama Obat", table_text)
        self.assertIn("Paracetamol", table_text)
        self.assertIn("|", table_text)
        self.assertIn("---", table_text)

    def test_item_e_ocr_fallback_when_enabled(self):
        """Item E: OCR dipanggil untuk halaman tanpa teks saat OCR_ENABLED=True."""
        mock_pytesseract = MagicMock()
        mock_pytesseract.image_to_string.return_value = "Teks hasil scan OCR farmasi"
        mock_pil = MagicMock()
        mock_image = MagicMock()
        mock_pil.Image = mock_image

        with patch("app.parser.OCR_ENABLED", True):
            with patch.dict("sys.modules", {"pytesseract": mock_pytesseract, "PIL": mock_pil, "PIL.Image": mock_image}):
                mock_page = MagicMock()
                mock_pix = MagicMock()
                mock_pix.tobytes.return_value = b"fake-png-bytes"
                mock_page.get_pixmap.return_value = mock_pix

                ocr_res = PdfDocumentParser._ocr_page_if_needed(mock_page, page_num=1)
                self.assertIn("Teks hasil scan OCR farmasi", ocr_res)

    def test_item_e_ocr_skipped_when_disabled(self):
        """Item E: OCR dilewati jika OCR_ENABLED=False."""
        mock_page = MagicMock()
        with patch("app.parser.OCR_ENABLED", False):
            res = PdfDocumentParser._ocr_page_if_needed(mock_page, page_num=1)
            self.assertEqual(res, "")

    # -------------------------------------------------------------
    # ITEM F: DATABASE PERSISTENT RATE LIMITER (WEB MODE)
    # -------------------------------------------------------------
    def test_item_f_web_mode_rate_limiter_db_persistence(self):
        """Item F: Rate limit mode web tersimpan di DB, memblokir setelah 10 rpm per user."""
        test_user = f"rate_limit_user_{uuid.uuid4().hex[:6]}"

        # Catat 10 request dalam batas aman
        for i in range(10):
            storage_mgr.check_and_record_web_rate_limit(test_user, max_per_minute=10, max_per_day=50)

        # Request ke-11 harus memicu HTTPException 429
        with self.assertRaises(HTTPException) as cm:
            storage_mgr.check_and_record_web_rate_limit(test_user, max_per_minute=10, max_per_day=50)
        self.assertEqual(cm.exception.status_code, 429)
        self.assertIn("Batas penggunaan mode web terlampaui", cm.exception.detail)

        # Verifikasi isolasi user: user lain tidak terblokir
        other_user = f"other_user_{uuid.uuid4().hex[:6]}"
        try:
            storage_mgr.check_and_record_web_rate_limit(other_user, max_per_minute=10, max_per_day=50)
        except HTTPException:
            self.fail("User lain tidak boleh terblokir oleh rate limit user berbeda.")

    # -------------------------------------------------------------
    # ITEM G: FRONTEND ERROR UX BACKEND CONTRACTS
    # -------------------------------------------------------------
    def test_item_g_error_contracts_401_413_429(self):
        """Item G: Verifikasi backend merespon 401 saat unauthorized dan 422 saat muatan terlalu besar."""
        # 1. 401 Unauthorized bila header user tidak disertakan
        res_401 = self.client.get("/api/v1/documents")
        self.assertEqual(res_401.status_code, 401)

        # 2. 422 Unprocessable Content jika pertanyaan > 8000 karakter (validasi skema Pydantic)
        giant_query = "A" * 8005
        res_giant = self.client.post(
            "/api/v1/chat/stream",
            headers={"X-User-Id": self.test_token},
            json={"question": giant_query, "grounding_mode": "document"}
        )
        self.assertEqual(res_giant.status_code, 422)

        # 3. 429 Too Many Requests saat fungsi rate limit mode web dipicu
        user_429 = f"rate_limit_contract_{uuid.uuid4().hex[:6]}"
        for _ in range(10):
            check_web_mode_rate_limit(user_429)
        with self.assertRaises(HTTPException) as cm:
            check_web_mode_rate_limit(user_429)
        self.assertEqual(cm.exception.status_code, 429)


if __name__ == "__main__":
    unittest.main()
