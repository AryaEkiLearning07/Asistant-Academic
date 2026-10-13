# Laporan Implementasi P1: Epiona Assistant

Dokumen ini merangkum penyelesaian seluruh butir pekerjaan P1 (Peningkatan Kualitas Retrieval, Reranking, Stemming Aman, dan Penguatan Anti-Halusinasi) pada Epiona Assistant (FastAPI backend & Next.js frontend) sesuai spesifikasi `AUDIT-P0.md`.

---

## 1. Status Tiap Item P1

| No | Fitur / Pekerjaan | Status | Ringkasan Perubahan & Mekanisme |
|---|---|---|---|
| **P1.1** | **Retrieval Hybrid (BM25 + Dense Vector + RRF)** | **SELESAI** | - Memisahkan teks dokumen menjadi passages (~350–500 token) dengan overlap.<br>- Menambahkan modul `backend/app/embedding_service.py` (`sentence-transformers`, model default `BAAI/bge-m3`, singleton, lazy loading).<br>- Menghitung dan menyimpan vektor embedding JSON per passage ke tabel `document_passages` saat background ingest.<br>- Menggabungkan peringkat BM25 dan cosine similarity vektor via Reciprocal Rank Fusion ($k=60$).<br>- Fallback otomatis dan aman ke BM25 murni jika `EMBEDDING_MODEL` kosong atau pustaka tidak terpasang. |
| **P1.2** | **Reranker Opsional (Cross-Encoder Top-20 -> Top-6)** | **SELESAI** | - Menambahkan modul `backend/app/reranker_service.py` (`sentence-transformers` CrossEncoder, mis. `BAAI/bge-reranker-v2-m3`).<br>- Menerima kandidat Top-20 dari retrieval hybrid dan menyortir ulang menjadi Top-6 paling relevan.<br>- Melewati tahap reranking secara aman (zero-overhead) jika `RERANKER_MODEL` kosong/dinonaktifkan. |
| **P1.3** | **Query Rewriting (Claude Haiku / Router Gateway)** | **SELESAI** | - Menambahkan fungsi `rewrite_query_for_retrieval` di `backend/app/ai_service.py`.<br>- Memanfaatkan model inferensi berbiaya hemat (Claude 3.5 Haiku / OpenRouter / 9Router) untuk menghasilkan versi kueri Bahasa Indonesia yang diperluas serta terjemahan teknis Bahasa Inggris.<br>- Hasil kueri dwibahasa di-retrieve dan digabungkan via RRF.<br>- Fallback transparan ke kueri asli jika gateway/API gagal atau timeout. |
| **P1.4** | **Perbaikan Stemmer Aman (`SafeStemmer`)** | **SELESAI** | - Mengimplementasikan class `SafeStemmer` di `backend/app/indexer.py`.<br>- Melindungi kata dasar dan istilah baku farmasi (misal: *farmakokinetika*, *farmakodinamika*, *masalah*, *proses*, *diabetes*, *resep*, *dosis*) dari pemotongan ekstrem (`farmakokinet`, `masa`, `pros`, `diabet`).<br>- Mendukung integrasi opsional PySastrawi untuk morfologi Bahasa Indonesia yang valid dengan canonical whitelist. |
| **P1.5** | **Anti-Halusinasi & Penolakan Tegas Diluar Konteks** | **SELESAI** | - Menghapus total fallback "afinitas judul" di `backend/app/main.py` yang sebelumnya memaksakan pengiriman halaman 1 saat skor BM25 kosong.<br>- Menolak tegas pertanyaan jika skor retrieval di bawah ambang batas (relevant passages kosong) dengan format panduan penelusuran yang jujur.<br>- Menolak kueri dengan pesan informatif jika koleksi MyLibrary pengguna masih kosong.<br>- Memperbaiki deteksi sapaan/identitas agar kata ilmiah (seperti *farmakokinetika* atau *dokumen*) tidak terpicu secara salah oleh kata sapaan pendek (*ok*, *hai*). |
| **P1.6** | **Integritas Abstrak Jurnal Akademik** | **SELESAI** | - Menghapus pemotongan abstrak naskah ilmiah (`[:600]` dan `[:500]`) di `backend/app/academic_service.py`.<br>- Menghapus panggilan ke endpoint Google Translate tidak resmi (`translate_a/single?client=gtx`).<br>- Teks asli Bahasa Inggris dikirim utuh ke model AI untuk inferensi dan sitasi langsung. |
| **P1.7** | **Validasi Input & Transparansi Error Provider** | **SELESAI** | - Endpoint `/api/v1/chat` menolak pertanyaan kosong/whitespace dengan `HTTP 400 Bad Request`.<br>- Error dari cloud AI provider (quota exceeded, auth error, connectivity) tidak lagi ditelan menjadi jawaban seolah-olah sukses; detail galat dikembalikan secara transparan ke antarmuka pengguna.<br>- Frontend (`frontend/app/page.tsx`) diperbarui untuk menampilkan `errData.detail` secara eksplisit saat respon `!res.ok`. |
| **P1.8** | **Identitas Epiona & Prompt Caching** | **SELESAI** | - Menetapkan `EPIONA_SYSTEM_PROMPT` yang padat (~150 kata) berprinsip piramida terbalik dan notasi LaTeX.<br>- Memisahkan system prompt dari konteks dokumen dinamis.<br>- Mengaktifkan Anthropic Prompt Caching (`cache_control: {"type": "ephemeral"}` dan header `anthropic-beta: prompt-caching-2024-07-31`) untuk efisiensi latensi dan biaya token. |

---

## 2. Berkas yang Diubah dan Dibuat

### Berkas Baru:
1. `backend/app/embedding_service.py` — Layanan abstraksi embedding vektor lokal (`sentence-transformers`), singleton, lazy-loading, cosine similarity calculation, dan fallback deterministik.
2. `backend/app/reranker_service.py` — Layanan cross-encoder reranker (`BAAI/bge-reranker-v2-m3`), singleton, skoring ulang top-20 ke top-6.
3. `backend/tests/test_p1_features.py` — 15 unit test komprehensif menguji seluruh mekanisme P1 (1-8) menggunakan mock terisolasi tanpa dependensi jaringan eksternal.
4. `FIX-P1-LAPORAN.md` — Laporan hasil pengerjaan, verifikasi, dan status perubahan.

### Berkas yang Diubah:
1. `backend/app/config.py` — Penambahan konfigurasi env `EMBEDDING_MODEL` dan `RERANKER_MODEL`.
2. `backend/app/storage.py` — Penambahan skema tabel `document_passages` (SQLite & MySQL), index `idx_passages_doc`, cascade delete, serta method penyimpanan & pengambilan passage per dokumen dan per user.
3. `backend/app/indexer.py` — Integrasi `SafeStemmer`, pembuatan chunk passage ber-overlap, `reciprocal_rank_fusion` ($k=60$), dan fungsi pencarian terpadu `search_hybrid`.
4. `backend/app/academic_service.py` — Penghapusan pemotongan karakter dan pemanggilan Google Translate tidak resmi pada abstrak PubMed dan arXiv.
5. `backend/app/ai_service.py` — Perampingan `EPIONA_SYSTEM_PROMPT`, pemisahan system prompt dari dokumen, prompt caching Anthropic, query rewriting dwibahasa, penolakan anti-halusinasi skor rendah, serta transparansi pesan error provider.
6. `backend/app/main.py` — Integrasi background passage/embedding processing saat upload dokumen, kueri rewriting dan hybrid search di endpoint chat, eliminasi total fallback afinitas judul, validasi penolakan kueri kosong (HTTP 400), dan perbaikan word-boundary sapaan.
7. `backend/.env.example` — Dokumentasi variabel lingkungan baru `EMBEDDING_MODEL` dan `RERANKER_MODEL`.
8. `backend/requirements.txt` — Penambahan dependensi opsional: `sentence-transformers`, `PySastrawi`, dan `numpy`.
9. `frontend/app/page.tsx` — Penanganan respon HTTP error dari backend agar mengekstrak pesan `errData.detail` secara transparan ke user chat UI.

---

## 3. Hasil Pengujian Empiris

### A. Pengujian Backend (`python -m pytest tests/ -v`)
Seluruh 26 pengujian (11 unit test `test_backend.py` + 15 unit test `test_p1_features.py`) **100% PASSED** (Hijau):
```text
tests/test_backend.py::TestEpionaAssistantBackend::test_academic_metadata_no_hallucination PASSED [  3%]
tests/test_backend.py::TestEpionaAssistantBackend::test_auth_and_user_isolation_lifecycle PASSED [  7%]
tests/test_backend.py::TestEpionaAssistantBackend::test_auth_real_jwt_and_no_guest_fallback PASSED [ 11%]
tests/test_backend.py::TestEpionaAssistantBackend::test_health_check PASSED [ 15%]
tests/test_backend.py::TestEpionaAssistantBackend::test_idor_protection_chat_sessions_and_resources PASSED [ 19%]
tests/test_backend.py::TestEpionaAssistantBackend::test_pdf_parsing_preserves_page_numbers PASSED [ 23%]
tests/test_backend.py::TestEpionaAssistantBackend::test_security_boundaries_and_limits PASSED [ 26%]
tests/test_backend.py::TestEpionaAssistantBackend::test_subscription_activate_admin_only PASSED [ 30%]
tests/test_backend.py::TestEpionaAssistantBackend::test_upload_magic_bytes_and_size_limits PASSED [ 34%]
tests/test_backend.py::TestEpionaAssistantBackend::test_verbatim_quote_verification PASSED [ 38%]
tests/test_backend.py::TestEpionaAssistantBackend::test_web_citation_mapping_and_deduplication PASSED [ 42%]
tests/test_p1_features.py::TestP1Features::test_academic_abstract_not_truncated_and_original_text PASSED [ 46%]
tests/test_p1_features.py::TestP1Features::test_anthropic_prompt_caching_payload PASSED [ 50%]
tests/test_p1_features.py::TestP1Features::test_anti_hallucination_empty_library_message PASSED [ 53%]
tests/test_p1_features.py::TestP1Features::test_anti_hallucination_rejects_out_of_context PASSED [ 57%]
tests/test_p1_features.py::TestP1Features::test_epiona_identity_system_prompt_structure PASSED [ 61%]
tests/test_p1_features.py::TestP1Features::test_hybrid_search_fallback_when_embedding_unavailable PASSED [ 65%]
tests/test_p1_features.py::TestP1Features::test_passage_chunking PASSED [ 69%]
tests/test_p1_features.py::TestP1Features::test_provider_error_transparency PASSED [ 73%]
tests/test_p1_features.py::TestP1Features::test_query_rewriting_success_and_fallback PASSED [ 76%]
tests/test_p1_features.py::TestP1Features::test_reciprocal_rank_fusion_logic PASSED [ 80%]
tests/test_p1_features.py::TestP1Features::test_reject_empty_question PASSED [ 84%]
tests/test_p1_features.py::TestP1Features::test_reranker_fallback_when_disabled PASSED [ 88%]
tests/test_p1_features.py::TestP1Features::test_reranker_service_rescoring PASSED [ 92%]
tests/test_p1_features.py::TestP1Features::test_safe_stemmer_pharma_canonical_matching PASSED [ 96%]
tests/test_p1_features.py::TestP1Features::test_safe_stemmer_preserves_root_words PASSED [100%]

======================= 26 passed, 1 warning in 31.23s =======================
```

### B. Pengujian Frontend (`npx tsc --noEmit`)
Hasil eksekusi kompilasi TypeScript Next.js:
```text
Exit code: 0 (No type errors)
```

---

## 4. Variabel Lingkungan Baru (`.env.example`)

Dua variabel lingkungan baru ditambahkan pada `backend/.env.example`:
```env
# ==========================================
# P1: SEMANTIC SEARCH & RERANKER (OPSIONAL)
# ==========================================
# Model embedding lokal multi-bahasa via sentence-transformers (mis. BAAI/bge-m3)
# Kosongkan untuk menggunakan BM25 murni tanpa embedding vektor
EMBEDDING_MODEL=

# Model reranker cross-encoder (mis. BAAI/bge-reranker-v2-m3)
# Kosongkan untuk menonaktifkan tahap reranker (menggunakan ranking RRF langsung)
RERANKER_MODEL=
```

---

## 5. Hal yang Belum Terverifikasi / Catatan Lingkungan Nyata

1. **Unduhan Model Riil (`BAAI/bge-m3` ~2.2GB & `BAAI/bge-reranker-v2-m3` ~2.2GB)**:
   - Pengujian unit memverifikasi seluruh antarmuka, parsing skema, cosine similarity math, RRF fusion, dan skenario fallback ketiadaan pustaka melalui mock terisolasi.
   - Pemuatan bobot model neural riil dari Hugging Face Hub belum diunduh pada mesin lokal saat ini untuk menghindari unduhan paket besar (>4GB) di tahap audit/CI. Bila env `EMBEDDING_MODEL=BAAI/bge-m3` diaktifkan di produksi, model akan diunduh otomatis sekali pada inisialisasi pertama.
2. **Koneksi Jaringan Live ke 9Router / Claude Haiku Gateway**:
   - Query rewriting diuji dengan mock payload dan fallback timeout. Pengujian langsung panggilan HTTP ke Claude Haiku membutuhkan API token valid pada berkas `backend/.env`.
3. **Status Git**:
   - Sesuai instruksi, tidak ada tindakan `git commit` maupun `git push` yang dijalankan. Seluruh modifikasi tersimpan rapi pada working tree.
