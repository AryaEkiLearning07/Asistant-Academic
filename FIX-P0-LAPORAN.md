# Laporan Perbaikan Temuan P0 - Epiona Assistant

Tanggal: 13 Oktober 2026  
Status: **SELESAI (Seluruh 9 Temuan P0 Teratasi & Terverifikasi Empiris)**

---

## 1. Status Tiap Item Temuan P0

| No | Temuan / Arahan | Status | Ringkasan Perbaikan |
|---|---|---|---|
| **1** | Hapus password admin hardcoded & reset otomatis saat login; ambil dari env `ADMIN_PASSWORD` (hash), jangan tulis password apa pun di kode. | **SELESAI** | Menghapus string password hardcoded (`aryaeki07`) dari seluruh basis kode. Mengambil kredensial admin dari `ADMIN_EMAIL`, `ADMIN_PASSWORD`, atau `ADMIN_PASSWORD_HASH` di environment. Menghapus pemanggilan `ensure_admin_user()` dari alur login pengguna (`main.py`) agar password tidak di-reset ulang setiap kali login. |
| **2** | Auth nyata: token JWT bertanda tangan (env `JWT_SECRET`, kedaluwarsa), hapus auto-login guest dan `guest123`; request tanpa token = 401. Hash password dengan bcrypt/argon2 (migrasi saat login). | **SELESAI** | Mengganti token mentah `user_id` dengan signed JWT (`HS256`, claim `sub`, `exp`, `iat`, masa berlaku terkonfigurasi via `JWT_EXPIRATION_HOURS`). Menghapus fallback akun `guest@epiona.ac.id`/`guest123` di backend dan tombol demo tamu di frontend. Permintaan tanpa header Authorization mengembalikan `HTTP 401 Unauthorized`. Mengimplementasikan `bcrypt` untuk hash password baru serta auto-rehash transparan untuk password legacy (`salt:sha256`) saat login. |
| **3** | Cek kepemilikan di semua endpoint sesi chat (baca/tulis/rename/hapus), `/chat` history, mode web, thumbnail/figures/pages; nama file tidak bisa ditebak. | **SELESAI** | Menambahkan validasi kepemilikan sesi `check_user_owns_session(user_id, session_id)` pada `GET /chats/{id}/messages`, `PATCH /chats/{id}`, `DELETE /chats/{id}`, dan saat `session_id` disertakan pada `POST /chat` (mengembalikan 404 jika bukan milik user). Menambahkan guard kepemilikan dokumen pada endpoint `GET /figures/{filename}`, `GET /pages/{filename}`, `GET /thumbnails/{filename}`, dan `GET /documents/{id}/pages/{n}/thumbnail` (mengembalikan 403 jika bukan pemilik). Nama file aset gambar dilengkapi token deterministik HMAC/SHA-256 (`_file_token`) agar tidak dapat ditebak. |
| **4** | Matikan `POST /subscription/activate` (hanya admin). | **SELESAI** | Mengubah dependensi otorisasi endpoint dari `get_current_user` menjadi `require_admin`. Akses oleh pengguna non-admin langsung ditolak dengan `HTTP 403 Forbidden`. |
| **5** | Mode jurnal: hapus semua data karangan (abstrak, DOI palsu, 'Author Group', tahun default); tampilkan hanya metadata asli, kosongkan bila tidak ada. | **SELESAI** | Menghapus seluruh string sintetis di `academic_service.py` dan `ai_service.py`: tidak ada lagi abstrak palsu `"Studi publikasi di {journal}..."`, tidak ada DOI rekaan `"10.ncbi.pmc/{uid}"` atau `"arxiv..."`, tidak ada fallback penulis `"Author Group"` / `"arXiv Author"`, dan tidak ada default tahun `"2024"`. Jika metadata tidak tersedia pada respons resmi PubMed/arXiv, field bernilai `None` atau `[]`. |
| **6** | Kutipan yang gagal verifikasi verbatim jangan diganti teks lain; tandai 'tidak terverifikasi' atau buang. | **SELESAI** | Menghentikan substitusi diam-diam dengan 200 karakter awal teks sumber (`src_text[:200]`). Jika kutipan model tidak ditemukan secara verbatim pada naskah passage terkait, kutipan ditandai dengan flag `is_verbatim=False` dan prefix `[Tidak terverifikasi]` pada `exact_quote`. |
| **7** | Sitasi web: petakan `[n]` ke ID hasil asli, bukan nomor ulang setelah dedup. | **SELESAI** | Menetapkan `result_id` asli (1-based) pada setiap item literatur saat diambil dari pangkalan data PubMed/arXiv sebelum deduplikasi. Saat deduplikasi berjalan, item yang tersisa mempertahankan `result_id` aslinya tanpa penomoran ulang. Penanda `[n]` pada konteks prompt dan sitasi `academic-{result_id}` terkunci konsisten, serta dilakukan sanitasi pembersihan penanda sitasi `[n]` yang tidak memiliki rujukan hasil asli. |
| **8** | Batas: ukuran upload (env `MAX_UPLOAD_MB`, default 25), cek magic bytes PDF, panjang pertanyaan maks 8000 karakter, kuota/rate limit mode web per user. | **SELESAI** | Menambahkan batasan ukuran upload dengan konfigurasi `MAX_UPLOAD_MB=25` (mengembalikan `HTTP 413` jika melebihi batas). Memvalidasi magic bytes file PDF wajib diawali `%PDF-` (`HTTP 400` jika bukan PDF valid). Memvalidasi panjang pertanyaan maksimal 8000 karakter pada model Pydantic `ChatRequest` dan router `POST /chat` (`HTTP 400`/`422`). Menambahkan rate limiter sliding-window per menit (`WEB_MODE_RATE_LIMIT_PER_MINUTE=10`) dan kuota harian (`MAX_WEB_QUOTA_PER_DAY=50`) per user untuk mode web/academic (`HTTP 429`). |
| **9** | Upgrade `next` ke versi patch yang menutup CVE-2025-66478 di `frontend/package.json`. | **SELESAI** | Meng-upgrade dependensi `next` dari `15.1.4` ke `^15.5.27` pada `frontend/package.json` dan memverifikasi instalasi `15.5.27` di `node_modules`. Kerentanan kritis CVE-2025-66478 (RCE React flight protocol) tertutup sepenuhnya. `npm run build` dan `npx tsc --noEmit` lolos bersih. |

---

## 2. Berkas yang Diubah

### Backend (`backend/`)
1. **`backend/app/config.py`**:
   - Konfigurasi JWT: `JWT_SECRET`, `JWT_ALGORITHM`, `JWT_EXPIRATION_HOURS`.
   - Konfigurasi bootstrap admin aman: `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_PASSWORD_HASH`.
   - Batasan & proteksi DoS: `MAX_UPLOAD_MB` (default 25), `WEB_MODE_RATE_LIMIT_PER_MINUTE` (default 10), `MAX_WEB_QUOTA_PER_DAY` (default 50).
2. **`backend/app/storage.py`**:
   - Mengimplementasikan `hash_password` dengan `bcrypt` dan auto-salt.
   - Mengimplementasikan `verify_password` yang mendukung bcrypt serta kompatibilitas migrasi legacy SHA-256.
   - Menambahkan helper `needs_password_rehash` dan `update_user_password`.
   - Menghapus password admin hardcoded (`aryaeki07`) dan mencegah penimpaan password saat startup.
   - Menambahkan validasi kepemilikan sesi `check_user_owns_session(user_id, session_id)` dan helper pencarian `get_document_id_for_figure`.
   - Memperbarui `delete_chat_session` dan `update_chat_session_title` dengan filter kepemilikan `user_id`.
3. **`backend/app/main.py`**:
   - Mengimplementasikan `create_access_token` dan `decode_access_token` berbasis PyJWT.
   - Memperbarui `get_current_user` agar menolak request tanpa token valid dengan `HTTP 401 Unauthorized` (menghapus auto-login guest).
   - Memperbarui `login_user` dengan migrasi otomatis password lama ke hash bcrypt.
   - Mengamankan endpoint `POST /subscription/activate` dengan `require_admin`.
   - Menambahkan validasi upload: batas ukuran `MAX_UPLOAD_MB` (`HTTP 413`) dan magic bytes `%PDF-` (`HTTP 400`).
   - Menambahkan validasi panjang pertanyaan maksimal 8000 karakter (`HTTP 400`).
   - Menambahkan sliding-window rate limiter dan kuota harian per user untuk mode web/academic (`HTTP 429`).
   - Menambahkan pengecekan kepemilikan sesi pada `GET /chats/{id}/messages`, `PATCH /chats/{id}`, `DELETE /chats/{id}`, dan `POST /chat`.
   - Menambahkan autentikasi dan pengecekan kepemilikan dokumen pada `GET /figures/{filename}`, `GET /pages/{filename}`, `GET /thumbnails/{filename}`, dan `GET /documents/{id}/pages/{n}/thumbnail`.
4. **`backend/app/models.py`**:
   - Menambahkan batasan `Field(min_length=1, max_length=8000)` pada field `question` di `ChatRequest`.
   - Menambahkan atribut `is_verbatim: Optional[bool] = True` pada `CitationItem`.
   - Menambahkan field opsional `target_user_id` pada `SubscriptionPlanRequest`.
5. **`backend/app/academic_service.py`**:
   - Membersihkan data karangan: tidak menyintesis abstrak palsu jika kosong (`abstract_snippet=None`).
   - Menghapus default DOI palsu (`None` jika tidak ada di metadata asli).
   - Menghapus default penulis `"Author Group"` / `"arXiv Author"` (menjadi `[]`).
   - Menghapus default tahun publikasi `"2024"` (menjadi `None`).
   - Menetapkan `result_id` asli (1-based) sebelum deduplikasi dan mempertahankan `result_id` asli saat deduplikasi.
6. **`backend/app/ai_service.py`**:
   - Memperbarui `answer_chat` agar menolak pertanyaan dengan penegasan `"MyLibrary Anda masih kosong"` jika pengguna belum memiliki dokumen di perpustakaan.
   - Memperbarui `_build_chat_response` agar memvalidasi kutipan verbatim terhadap teks naskah dan menandai `[Tidak terverifikasi]` (`is_verbatim=False`) tanpa mengganti dengan teks sumber secara diam-diam.
   - Menghapus fabrikasi tahun `"2024"` dan abstrak sintetis pada `_synthesize_academic_offline`.
   - Menyelaraskan penomoran sitasi web `[n]` dengan `result_id` asli literatur dan membersihkan penanda sitasi tak bersumber.
7. **`backend/app/parser.py`**:
   - Menambahkan HMAC/SHA-256 security token (`_file_token`) pada penamaan file thumbnail, figure, dan rendered page agar nama file tidak deterministik/tidak dapat ditebak.
8. **`backend/requirements.txt`**:
   - Menambahkan dependensi `pyjwt>=2.8.0` dan `bcrypt>=4.0.0`.
9. **`backend/.env.example`** & **`backend/.env`**:
   - Menambahkan variabel environment konfigurasi baru.
10. **`backend/tests/test_backend.py`**:
    - Memperbarui dan menambah 11 unit test untuk memverifikasi autentikasi JWT, penolakan 401 tanpa token, isolasi IDOR sesi chat & file, aktivasi admin langganan, validasi magic bytes, batasan upload & pertanyaan, metadata jurnal tanpa halusinasi, verifikasi verbatim kutipan, pemetaan sitasi web, dan rate limiting.

### Frontend (`frontend/`)
1. **`frontend/package.json` & `frontend/package-lock.json`**:
   - Meng-upgrade paket `next` dari `15.1.4` ke `^15.5.27` (terinstal `15.5.27`) untuk menutup CVE-2025-66478.
2. **`frontend/components/auth/AuthScreen.tsx`**:
   - Menghapus tombol demo tamu "Masuk Demo Tamu" dengan kredensial `guest123`.
3. **`frontend/types/index.ts`**:
   - Menambahkan field `is_verbatim?: boolean` pada tipe `CitationItem`.

---

## 3. Variabel Environment Baru

Variabel berikut telah didokumentasikan di `backend/.env.example` dan diaktifkan di `backend/.env`:

```env
# Kredensial Administrator Epiona (wajib disetel, jangan hardcode di kode)
ADMIN_EMAIL=admin@epiona.my.id
ADMIN_PASSWORD=change_this_admin_password_in_production
# ADMIN_PASSWORD_HASH= (opsional, jika ingin menyediakan hash langsung)

# Keamanan Autentikasi JWT (wajib disetel acak minimal 32 karakter di produksi)
JWT_SECRET=change_this_jwt_secret_key_minimum_32_characters_random
JWT_ALGORITHM=HS256
JWT_EXPIRATION_HOURS=24

# Batasan Upload & Proteksi DoS & Rate Limit
MAX_UPLOAD_MB=25
WEB_MODE_RATE_LIMIT_PER_MINUTE=10
MAX_WEB_QUOTA_PER_DAY=50
```

---

## 4. Hasil Verifikasi Pengujian Empiris

### A. Backend Pytest (`python -m pytest backend`)
Perintah:
```powershell
python -m pytest backend
```
Hasil:
```text
============================= test session starts =============================
platform win32 -- Python 3.14.2, pytest-9.1.1, pluggy-1.6.0
rootdir: E:\epiona-assistant
configfile: pytest.ini
plugins: anyio-4.15.0, asyncio-1.4.0
collected 11 items

backend\tests\test_backend.py ...........                                [100%]

======================= 11 passed, 1 warning in 31.45s ========================
```
Daftar seluruh 11 kasus uji lulus 100%:
1. `test_health_check`: Endpoint status sehat (200 OK).
2. `test_pdf_parsing_preserves_page_numbers`: Integritas ekstraksi halaman 1:1.
3. `test_auth_and_user_isolation_lifecycle`: Siklus isolasi multi-tenant antar user dan penolakan saat library kosong.
4. `test_auth_real_jwt_and_no_guest_fallback`: Penolakan 401 tanpa token, format token JWT valid, dan penolakan token palsu.
5. `test_chat_ownership_guard`: Pencegahan IDOR baca/ubah/hapus/injeksi sesi chat.
6. `test_figures_and_thumbnails_access_control`: Akses kontrol dan pencegahan kebocoran thumbnail/gambar milik user lain.
7. `test_subscription_activate_admin_only`: Penolakan 403 Forbidden untuk aktivasi langganan oleh user biasa.
8. `test_upload_magic_bytes_and_size_limits`: Penolakan 400 untuk file tanpa magic bytes `%PDF-`, pertanyaan kosong, batas 8000 karakter, dan rate limit web mode (429).
9. `test_academic_metadata_no_hallucination`: Ketiadaan DOI, penulis, atau abstrak palsu pada retrieval jurnal.
10. `test_verbatim_quote_verification`: Penandaan `[Tidak terverifikasi]` tanpa substitusi diam-diam ketika kutipan model gagal verifikasi verbatim.
11. `test_web_citation_mapping_and_deduplication`: Pemetaan penanda sitasi web `[n]` ke `result_id` asli setelah deduplikasi.

### B. Frontend TypeScript Typecheck (`cd frontend; npx tsc --noEmit`)
Perintah:
```powershell
cd frontend; npx tsc --noEmit
```
Hasil:
```text
Exit code: 0 (Lolos bersih tanpa error ketikan atau type mismatch)
```

### C. Frontend Production Build (`cd frontend; npm run build`)
Perintah:
```powershell
cd frontend; npm run build
```
Hasil:
```text
   ▲ Next.js 15.5.27
   Creating an optimized production build ...
 ✓ Compiled successfully
   Linting and checking validity of types ...
   Collecting page data ...
 ✓ Generating static pages (4/4)
   Finalizing page optimization ...
Route (app)                                 Size  First Load JS
┌ ○ /                                     171 kB         274 kB
└ ○ /_not-found                            996 B         104 kB
+ First Load JS shared by all             103 kB
Exit code: 0
```
Kerentanan kritis **CVE-2025-66478 (GHSA-9qr9-h5gf-34mp - RCE React flight protocol)**: **TERATASI (Next.js 15.5.27)**.
