import io
import uuid
import unittest
import fitz
from fastapi.testclient import TestClient

from app.main import app
from app.parser import PdfDocumentParser

class TestEpionaAssistantBackend(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)
        
        # Buat dokumen PDF 2 halaman sintetis di memory
        doc = fitz.open()
        page1 = doc.new_page()
        page1.insert_text((50, 72), "Chapter 1: Pharmacokinetics and Volume of Distribution Vd. Vd relates drug amount to plasma concentration.", fontsize=12)
        page2 = doc.new_page()
        page2.insert_text((50, 72), "Chapter 2: Elimination and Clearance. In renal impairment, clearance of renally eliminated drugs decreases.", fontsize=12)
        cls.synthetic_pdf_bytes = doc.tobytes()
        doc.close()

    def test_health_check(self):
        response = self.client.get("/api/v1/health")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["status"], "healthy")

    def test_pdf_parsing_preserves_page_numbers(self):
        result = PdfDocumentParser.parse_pdf(self.synthetic_pdf_bytes)
        self.assertEqual(result["total_pages"], 2)
        self.assertEqual(result["pages"][0]["page_number"], 1)
        self.assertIn("Volume of Distribution", result["pages"][0]["text"])
        self.assertEqual(result["pages"][1]["page_number"], 2)
        self.assertIn("Clearance", result["pages"][1]["text"])

    def test_auth_and_user_isolation_lifecycle(self):
        uid = uuid.uuid4().hex[:6]
        # 1. Daftarkan User A
        reg_a = self.client.post("/api/v1/auth/register", json={
            "email": f"user_a_{uid}@farmasi.ac.id",
            "password": "password123",
            "full_name": "Apoteker Pratama A"
        })
        self.assertEqual(reg_a.status_code, 200)
        token_a = reg_a.json()["token"]

        # 2. Daftarkan User B
        reg_b = self.client.post("/api/v1/auth/register", json={
            "email": f"user_b_{uid}@farmasi.ac.id",
            "password": "password123",
            "full_name": "Mahasiswa Farmasi B"
        })
        self.assertEqual(reg_b.status_code, 200)
        token_b = reg_b.json()["token"]

        # 3. User A mengunggah dokumen
        files_a = {"file": ("shargel_a.pdf", io.BytesIO(self.synthetic_pdf_bytes), "application/pdf")}
        data_a = {"title": "Biopharmaceutics Shargel"}
        res_upload_a = self.client.post(
            "/api/v1/documents/upload",
            files=files_a,
            data=data_a,
            headers={"X-User-Id": token_a}
        )
        self.assertEqual(res_upload_a.status_code, 200)
        doc_a_id = res_upload_a.json()["id"]

        # 4. User A melihat dokumen di library miliknya
        docs_a = self.client.get("/api/v1/documents", headers={"X-User-Id": token_a}).json()["documents"]
        self.assertEqual(len(docs_a), 1)
        self.assertEqual(docs_a[0]["id"], doc_a_id)

        # 5. ISOLASI: User B melihat perpustakaannya masih kosong (0 dokumen)!
        docs_b = self.client.get("/api/v1/documents", headers={"X-User-Id": token_b}).json()["documents"]
        self.assertEqual(len(docs_b), 0)

        # 6. ISOLASI: User B dilarang mengakses stream PDF milik User A (HTTP 403 Forbidden)
        res_forbidden = self.client.get(f"/api/v1/documents/{doc_a_id}/pdf", headers={"X-User-Id": token_b})
        self.assertEqual(res_forbidden.status_code, 403)

        # 7. ISOLASI & P3A KEBIJAKAN BERTINGKAT: User B bertanya ke AI tanpa dokumen di library -> dijawab dari pengetahuan umum dengan catatan tanpa sitasi
        chat_b_empty = self.client.post(
            "/api/v1/chat",
            json={"question": "Apa itu Vd?"},
            headers={"X-User-Id": token_b}
        ).json()
        self.assertEqual(len(chat_b_empty["citations"]), 0)
        self.assertIn("Tidak ditemukan di dokumenmu", chat_b_empty["answer"])

        # 8. User A bertanya ke AI -> berhasil mendapatkan jawaban bersitasi halaman 1
        chat_a = self.client.post(
            "/api/v1/chat",
            json={"question": "Volume of Distribution Vd"},
            headers={"X-User-Id": token_a}
        ).json()
        self.assertTrue(len(chat_a["citations"]) > 0)
        self.assertEqual(chat_a["citations"][0]["page_number"], 1)

        # 9. DEDUKLIPASI & SHARING: User B mengunggah file identik
        files_b = {"file": ("identical_copy.pdf", io.BytesIO(self.synthetic_pdf_bytes), "application/pdf")}
        res_upload_b = self.client.post(
            "/api/v1/documents/upload",
            files=files_b,
            data={"title": "Shargel Salinan B"},
            headers={"X-User-Id": token_b}
        )
        self.assertEqual(res_upload_b.status_code, 200)
        # Deduplikasi aktif secara global
        self.assertTrue(res_upload_b.json()["is_duplicate"])
        self.assertEqual(res_upload_b.json()["id"], doc_a_id)

        # 10. Sekarang User B memiliki dokumen di library miliknya dan boleh membaca PDF
        docs_b_after = self.client.get("/api/v1/documents", headers={"X-User-Id": token_b}).json()["documents"]
        self.assertEqual(len(docs_b_after), 1)
        res_ok_b = self.client.get(f"/api/v1/documents/{doc_a_id}/pdf", headers={"X-User-Id": token_b})
        self.assertEqual(res_ok_b.status_code, 200)

    def test_auth_real_jwt_and_no_guest_fallback(self):
        """P0-1 & P0-3: Tanpa token wajib 401 (guest fallback dihapus), token harus JWT bertanda tangan."""
        # 1. Tanpa token
        res_no_token = self.client.get("/api/v1/documents")
        self.assertEqual(res_no_token.status_code, 401)
        self.assertIn("Autentikasi diperlukan", res_no_token.json()["detail"])

        # 2. Token sembarang / palsu
        res_fake_token = self.client.get("/api/v1/documents", headers={"Authorization": "Bearer fake_token_string"})
        self.assertEqual(res_fake_token.status_code, 401)

        # 3. Register user menghasilkan JWT token valid
        uid = uuid.uuid4().hex[:6]
        reg = self.client.post("/api/v1/auth/register", json={
            "email": f"jwt_user_{uid}@epiona.my.id",
            "password": "validpassword123",
            "full_name": "Dr. Testing JWT"
        })
        self.assertEqual(reg.status_code, 200)
        jwt_token = reg.json()["token"]
        self.assertEqual(len(jwt_token.split(".")), 3)  # Format header.payload.signature

        # 4. Akses dengan JWT valid berhasil
        res_valid = self.client.get("/api/v1/documents", headers={"Authorization": f"Bearer {jwt_token}"})
        self.assertEqual(res_valid.status_code, 200)

    def test_idor_protection_chat_sessions_and_resources(self):
        """P0-4 & P0-9: IDOR sesi chat & gambar/halaman/thumbnail dicegah dengan cek kepemilikan."""
        uid = uuid.uuid4().hex[:6]
        # User A
        reg_a = self.client.post("/api/v1/auth/register", json={
            "email": f"owner_a_{uid}@epiona.my.id",
            "password": "password123",
            "full_name": "User Owner A"
        })
        token_a = reg_a.json()["token"]
        user_a_id = reg_a.json()["user_id"]

        # User B (Attacker)
        reg_b = self.client.post("/api/v1/auth/register", json={
            "email": f"attacker_b_{uid}@epiona.my.id",
            "password": "password123",
            "full_name": "User Attacker B"
        })
        token_b = reg_b.json()["token"]

        # User A membuat sesi chat
        sess_a = self.client.post("/api/v1/chats", json={"title": "Sesi Rahasia A"}, headers={"Authorization": f"Bearer {token_a}"}).json()
        session_a_id = sess_a["id"]

        # User B mencoba BACA pesan sesi A -> 404
        get_b = self.client.get(f"/api/v1/chats/{session_a_id}/messages", headers={"Authorization": f"Bearer {token_b}"})
        self.assertEqual(get_b.status_code, 404)

        # User B mencoba RENAME sesi A -> 404
        patch_b = self.client.patch(f"/api/v1/chats/{session_a_id}", json={"title": "Dibajak B"}, headers={"Authorization": f"Bearer {token_b}"})
        self.assertEqual(patch_b.status_code, 404)

        # User B mencoba HAPUS sesi A -> 404
        del_b = self.client.delete(f"/api/v1/chats/{session_a_id}", headers={"Authorization": f"Bearer {token_b}"})
        self.assertEqual(del_b.status_code, 404)

        # User B mencoba menulis riwayat ke sesi A lewat /chat -> 404
        chat_idor = self.client.post(
            "/api/v1/chat",
            json={"question": "Injeksi riwayat?", "session_id": session_a_id},
            headers={"Authorization": f"Bearer {token_b}"}
        )
        self.assertEqual(chat_idor.status_code, 404)

        # Upload dokumen milik User A
        files_a = {"file": ("secret_a.pdf", io.BytesIO(self.synthetic_pdf_bytes), "application/pdf")}
        up_a = self.client.post("/api/v1/documents/upload", files=files_a, headers={"Authorization": f"Bearer {token_a}"})
        doc_a_id = up_a.json()["id"]

        # User B mencoba akses thumbnail halaman User A -> 403
        thumb_idor = self.client.get(f"/api/v1/documents/{doc_a_id}/pages/1/thumbnail", headers={"Authorization": f"Bearer {token_b}"})
        self.assertEqual(thumb_idor.status_code, 403)

        # User B mencoba akses thumbnail file langsung -> 403
        thumb_fn = f"thumb_{doc_a_id}.png"
        direct_thumb = self.client.get(f"/api/v1/thumbnails/{thumb_fn}", headers={"Authorization": f"Bearer {token_b}"})
        self.assertEqual(direct_thumb.status_code, 403)

    def test_subscription_activate_admin_only(self):
        """P0-5: POST /subscription/activate hanya boleh dipanggil oleh Administrator."""
        uid = uuid.uuid4().hex[:6]
        # User biasa
        reg = self.client.post("/api/v1/auth/register", json={
            "email": f"normal_user_{uid}@epiona.my.id",
            "password": "password123",
            "full_name": "Normal User"
        })
        token_user = reg.json()["token"]

        # User biasa mencoba aktivasi -> 403 Forbidden
        res_user = self.client.post(
            "/api/v1/subscription/activate",
            json={"plan_type": "pro_monthly"},
            headers={"Authorization": f"Bearer {token_user}"}
        )
        self.assertEqual(res_user.status_code, 403)
        self.assertIn("Akses ditolak", res_user.json()["detail"])

    def test_upload_magic_bytes_and_size_limits(self):
        """P0-8: Validasi upload magic bytes %PDF-, batasan ukuran, dan panjang pertanyaan."""
        uid = uuid.uuid4().hex[:6]
        reg = self.client.post("/api/v1/auth/register", json={
            "email": f"limits_user_{uid}@epiona.my.id",
            "password": "password123",
            "full_name": "User Limits"
        })
        token = reg.json()["token"]

        # 1. File bukan PDF (ekstensi .pdf tetapi isi bukan %PDF-)
        fake_pdf = {"file": ("fake.pdf", io.BytesIO(b"ini bukan file pdf asli"), "application/pdf")}
        res_fake = self.client.post("/api/v1/documents/upload", files=fake_pdf, headers={"Authorization": f"Bearer {token}"})
        self.assertEqual(res_fake.status_code, 400)
        self.assertIn("Magic bytes %PDF-", res_fake.json()["detail"])

        # 2. Pertanyaan kosong -> 400
        res_empty_q = self.client.post("/api/v1/chat", json={"question": "   "}, headers={"Authorization": f"Bearer {token}"})
        self.assertEqual(res_empty_q.status_code, 400)

        # 3. Pertanyaan melebihi 8000 karakter -> 422 (Pydantic validation) atau 400
        long_q = "A" * 8005
        res_long_q = self.client.post("/api/v1/chat", json={"question": long_q}, headers={"Authorization": f"Bearer {token}"})
        self.assertIn(res_long_q.status_code, [400, 422])

    def test_academic_metadata_no_hallucination(self):
        """P0-5 Mode Jurnal: Metadata asli tanpa data karangan (abstrak palsu, DOI palsu, Author Group)."""
        from app.academic_service import AcademicRetrieverService
        # Jalankan pencarian PubMed / mock
        evidence = AcademicRetrieverService.retrieve_academic_evidence("metformin pharmacokinetics")
        for item in evidence:
            # Tidak boleh ada default karangan
            if item.get("doi"):
                self.assertNotIn("10.ncbi.pmc/", item["doi"])
            if item.get("authors"):
                self.assertNotIn("Author Group", item["authors"])
                self.assertNotIn("arXiv Author", item["authors"])
            if item.get("abstract_snippet"):
                self.assertNotIn("Studi publikasi di", item["abstract_snippet"])

    def test_verbatim_quote_verification(self):
        """P0-6: Kutipan yang gagal verifikasi verbatim tidak diganti dengan teks 200 char awal passage."""
        from app.ai_service import AssistantAiService
        svc = AssistantAiService()
        relevant = [{
            "document_id": "doc1",
            "document_title": "Judul Buku",
            "page_number": 1,
            "text": "Farmakokinetika adalah ilmu yang mempelajari nasib obat dalam tubuh."
        }]
        # Data AI mengarang kutipan yang tidak ada di teks
        ai_data = {
            "answer": "Berikut penjelasan [1].",
            "citations": [{
                "document_id": "doc1",
                "document_title": "Judul Buku",
                "page_number": 1,
                "exact_quote": "Kutipan fiktif yang tidak pernah ada di naskah sama sekali."
            }]
        }
        res = svc._build_chat_response(ai_data, relevant)
        self.assertEqual(len(res.citations), 1)
        # Tidak boleh diganti diam-diam dengan 200 karakter awal teks sumber
        self.assertNotEqual(res.citations[0].exact_quote, relevant[0]["text"][:200])
        # Wajib ditandai tidak terverifikasi atau is_verbatim=False
        self.assertFalse(res.citations[0].is_verbatim)
        self.assertIn("[Tidak terverifikasi]", res.citations[0].exact_quote)

    def test_web_citation_mapping_and_deduplication(self):
        """P0-7: Sitasi web memetakan [n] ke ID hasil asli, bukan nomor ulang setelah dedup."""
        from app.academic_service import AcademicRetrieverService
        from app.ai_service import AssistantAiService
        svc = AssistantAiService()

        # Simulasi evidence dengan deduplikasi yang menjaga result_id asli
        mock_evidence = [
            {"result_id": 1, "document_title": "Paper One", "journal_name": "J1", "publication_year": "2023", "abstract_snippet": "First study.", "url": "https://example.com/1"},
            {"result_id": 3, "document_title": "Paper Three", "journal_name": "J3", "publication_year": "2024", "abstract_snippet": "Third study after dedup.", "url": "https://example.com/3"}
        ]

        resp = svc.answer_academic_chat("test query", mock_evidence)
        # Citations harus memetakan ke ID asli (academic-1 dan academic-3, bukan academic-2)
        citation_ids = [c.document_id for c in resp.citations]
        self.assertIn("academic-1", citation_ids)
        self.assertIn("academic-3", citation_ids)
        self.assertNotIn("academic-2", citation_ids)

    def test_security_boundaries_and_limits(self):
        """P0-8: Ukuran upload (MAX_UPLOAD_MB), magic bytes PDF, panjang pertanyaan 8000 char, rate limit web mode."""
        uid = uuid.uuid4().hex[:6]
        reg = self.client.post("/api/v1/auth/register", json={
            "email": f"limits_{uid}@farmasi.ac.id",
            "password": "password123",
            "full_name": "Limit Tester"
        })
        token = reg.json()["token"]
        headers = {"Authorization": f"Bearer {token}"}

        # 1. Magic bytes: File bernama .pdf tapi tanpa %PDF-
        bad_pdf = io.BytesIO(b"This is not a real PDF file!")
        res_magic = self.client.post(
            "/api/v1/documents/upload",
            files={"file": ("fake.pdf", bad_pdf, "application/pdf")},
            data={"title": "Fake PDF"},
            headers=headers
        )
        self.assertEqual(res_magic.status_code, 400)
        self.assertIn("Magic bytes %PDF- tidak ditemukan", res_magic.json()["detail"])

        # 2. Panjang pertanyaan > 8000 karakter
        long_q = "A" * 8001
        res_long = self.client.post(
            "/api/v1/chat",
            json={"question": long_q},
            headers=headers
        )
        self.assertIn(res_long.status_code, [400, 422])

        # 3. Rate limit / Kuota mode web per user (mock retrieval agar instan tanpa network delay)
        from unittest.mock import patch
        with patch("app.main.AcademicRetrieverService.retrieve_academic_evidence", return_value=[]):
            status_codes = []
            for i in range(12):
                res_rate = self.client.post(
                    "/api/v1/chat",
                    json={"question": f"kueri farmasi {i}", "grounding_mode": "academic"},
                    headers=headers
                )
                status_codes.append(res_rate.status_code)

        # Harus ada setidaknya satu HTTP 429 Too Many Requests
        self.assertIn(429, status_codes)

if __name__ == "__main__":
    unittest.main()


