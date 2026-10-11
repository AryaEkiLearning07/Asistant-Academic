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

        # 7. ISOLASI: User B bertanya ke AI -> ditolak karena library masih kosong
        chat_b_empty = self.client.post(
            "/api/v1/chat",
            json={"question": "Apa itu Vd?"},
            headers={"X-User-Id": token_b}
        ).json()
        self.assertIn("MyLibrary Anda masih kosong", chat_b_empty["answer"])

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

if __name__ == "__main__":
    unittest.main()
