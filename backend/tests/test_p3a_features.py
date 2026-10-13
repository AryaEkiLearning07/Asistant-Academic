import io
import json
import uuid
import unittest
from fastapi.testclient import TestClient

from app.main import app
from app.ai_service import AssistantAiService, EPIONA_SYSTEM_PROMPT


class TestP3AFeatures(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)
        cls.ai_service = AssistantAiService()

    def test_out_of_library_query_answers_naturally_without_rejection(self):
        """P3A-1: Pertanyaan umum di mode Library dijawab bermutu tinggi dari pengetahuan umum,
        bukan ditolak kaku atau mengulang pertanyaan mentah pengguna.
        """
        question = "jelaskan apa itu OSI layer dengan bahasa mudah + analogi"
        resp = self.ai_service.answer_chat(
            question=question,
            user_docs=[{"id": "doc_far", "title": "Buku Farmasi Klinis"}],
            relevant_pages=[]
        )

        # 1. Jawaban tidak boleh kosong dan tidak ada template penolakan
        self.assertTrue(len(resp.answer.strip()) > 50)
        self.assertNotIn("Dokumen di MyLibrary tidak memuat informasi", resp.answer)
        self.assertNotIn("Mengenai pertanyaan Anda:", resp.answer)

        # 2. Bebas sitasi fiktif
        self.assertEqual(len(resp.citations), 0)

        # 3. Memuat penjelasan substansi dan analogi
        ans_lower = resp.answer.lower()
        self.assertTrue("osi" in ans_lower or "layer" in ans_lower)
        self.assertTrue("analogi" in ans_lower or "pos" in ans_lower or "aplikasi" in ans_lower)

        # 4. Memuat catatan kecil di akhir bahwa tidak ditemukan di dokumen
        self.assertIn("Tidak ditemukan di dokumenmu", resp.answer)

    def test_stream_chat_endpoint_yields_valid_tokens_and_non_empty_end(self):
        """P3A-2: Endpoint streaming /api/v1/chat/stream menghasilkan event token valid
        dan event end dengan answer yang tidak kosong (mencegah gelembung kosong).
        """
        # Register user sementara
        uid = uuid.uuid4().hex[:6]
        reg = self.client.post("/api/v1/auth/register", json={
            "email": f"p3a_stream_{uid}@epiona.my.id",
            "password": "validpassword123",
            "full_name": "Tester P3A Streaming"
        })
        self.assertEqual(reg.status_code, 200)
        token = reg.json()["token"]

        response = self.client.post(
            "/api/v1/chat/stream",
            json={
                "question": "jelaskan apa itu OSI layer dengan bahasa mudah + analogi",
                "chat_history": []
            },
            headers={"Authorization": f"Bearer {token}"}
        )

        self.assertEqual(response.status_code, 200)
        self.assertIn("text/event-stream", response.headers.get("content-type", ""))

        lines = response.text.strip().split("\n")
        events = []
        for line in lines:
            line = line.strip()
            if line.startswith("data: "):
                try:
                    payload = json.loads(line[6:])
                    events.append(payload)
                except Exception:
                    pass

        self.assertTrue(len(events) > 0, "Harus menghasilkan setidaknya satu event SSE")

        # Cek apakah ada token
        token_events = [e for e in events if e.get("type") == "token"]
        self.assertTrue(len(token_events) > 0, "Harus memancarkan event token streaming")

        # Cek event end
        end_events = [e for e in events if e.get("type") == "end"]
        self.assertTrue(len(end_events) > 0, "Harus memancarkan event end")
        end_payload = end_events[-1]
        final_answer = end_payload.get("answer") or end_payload.get("full_answer") or ""
        self.assertTrue(len(final_answer.strip()) > 0, "Jawaban akhir tidak boleh berupa string kosong")
        self.assertIn("Tidak ditemukan di dokumenmu", final_answer)

    def test_gemini_contents_payload_builder_handles_multiturn_alternation(self):
        """P3A-3: Penyusun riwayat multi-turn Gemini merapikan role yang berurutan
        dan memangkas model message pembuka agar terhindar dari HTTP 400.
        """
        raw_history = [
            {"sender": "assistant", "text": "Pesan sambutan asisten di awal"},  # harus dipangkas karena bukan user
            {"sender": "user", "text": "Halo pertama"},
            {"sender": "user", "text": "Halo kedua berturut-turut"},  # harus digabung ke user sebelumnya
            {"sender": "assistant", "text": "Jawaban asisten pertama"},
            {"sender": "user", "text": "Pertanyaan user ketiga"}
        ]

        contents = self.ai_service._build_gemini_contents_payload(
            user_prompt="Pertanyaan terkini",
            chat_history=raw_history
        )

        # Pesan pertama wajib role 'user'
        self.assertEqual(contents[0]["role"], "user")

        # Tidak boleh ada dua role berurutan yang sama
        for i in range(len(contents) - 1):
            self.assertNotEqual(
                contents[i]["role"],
                contents[i + 1]["role"],
                f"Role kembar berturut-turut pada index {i} dan {i+1}"
            )

        # Pesan terakhir adalah prompt terkini dari role 'user'
        self.assertEqual(contents[-1]["role"], "user")
        self.assertTrue(any("Pertanyaan terkini" in p.get("text", "") for p in contents[-1]["parts"]))

    def test_dosage_warning_included_on_clinical_queries_without_sources(self):
        """P3A-4: Pertanyaan terkait dosis/vaksin tanpa sumber menyertakan peringatan verifikasi klinis."""
        resp = self.ai_service.answer_chat(
            question="Berapa dosis vaksin dengue anak?",
            user_docs=[],
            relevant_pages=[]
        )
        self.assertTrue(len(resp.answer.strip()) > 30)
        self.assertEqual(len(resp.citations), 0)
        ans_lower = resp.answer.lower()
        self.assertTrue("peringatan" in ans_lower or "verifikasi" in ans_lower or "klinis" in ans_lower)
        self.assertIn("Tidak ditemukan di dokumenmu", resp.answer)
