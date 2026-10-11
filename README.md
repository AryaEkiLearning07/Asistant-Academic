# EPIONA — Academic Literature Research Assistant & Dual-Pane Workspace

Platform asisten studi literatur farmasi berbasis kecerdasan buatan (*Retrieval-Augmented Generation* / RAG) dengan model kepemilikan dokumen *Bring Your Own Document* (BYOD) dan antarmuka *Dual-Pane Workspace*.

---

## 1. Fitur Utama

1. **Penyimpanan Lokal & Deduplikasi Global (SHA-256)**:
   - File PDF asli (e-book, modul praktikum, slide PPT) disimpan di disk lokal server (`storage/pdfs/<file_hash>.pdf`).
   - Jika file identik diunggah oleh pengguna lain, sistem mendeteksi hash dan langsung menautkan hak akses tanpa menduplikasi ruang harddisk.
2. **Ekstraksi Presisi Halaman Fisik 1:1 (`PyMuPDF`)**:
   - Membaca teks per halaman asli buku, sehingga sitasi akademik selalu merujuk ke nomor halaman yang sebenarnya.
3. **Dual-Pane Split-Screen Workspace (Next.js 15 + Tailwind CSS)**:
   - **Panel Kiri (45%)**: Chatbot tanya-jawab literatur, pencarian konsep, dan kartu sitasi interaktif (`document_title`, `page_number`, `exact_quote`).
   - **Panel Kanan (55%)**: Penampil PDF asli (*native streaming reader*) yang otomatis melompat (*jumpToPage*) ke halaman yang direferensikan dan menampilkan highlight bukti kalimat asli.
4. **AI Grounding Berbasis Groq LPU**:
   - Terintegrasi model `llama-3.3-70b-versatile` dengan inferensi ultra-cepat (300–500 token/detik) dan format JSON sitasi terstruktur.
   - Dilengkapi *Fallback Sintesis Lokal* jika API key belum dimasukkan, sehingga sistem langsung berfungsi 100% sejak pertama dijalankan.

---

## 2. Struktur Proyek

```
E:\epiona-assistant/
├── storage/
│   ├── pdfs/              # Penyimpanan file fisik PDF asli
│   └── data/              # Database SQLite indeks & metadata halaman
├── backend/               # FastAPI Server
│   ├── app/
│   │   ├── config.py      # Konfigurasi path & Groq API Key
│   │   ├── models.py      # Pydantic schema (ChatResponse, CitationItem)
│   │   ├── storage.py     # LocalStorageManager & SHA-256 deduplication
│   │   ├── parser.py      # PyMuPDF: Ekstraksi teks per halaman fisik
│   │   ├── indexer.py     # Mesin pencari halaman dokumen relevan
│   │   ├── ai_service.py  # Groq client & fallback sintesis lokal
│   │   └── main.py        # REST API endpoints
│   ├── tests/
│   │   └── test_backend.py # 5 automated unit tests (100% pass)
│   ├── requirements.txt
│   └── .env.example
├── frontend/              # Next.js 15 Workspace
│   ├── app/
│   │   ├── page.tsx       # Dual-Pane layout, chat, & PDF deep-link
│   │   ├── layout.tsx
│   │   └── globals.css
│   └── package.json
└── run_assistant.bat      # Peluncur 1-klik untuk Windows
```

---

## 3. Cara Menjalankan

### Cara 1: Menggunakan Skrip 1-Klik (Windows)
Cukup klik ganda berkas [**`run_assistant.bat`**](file:///E:/epiona-assistant/run_assistant.bat). Skrip akan otomatis membuka dua jendela terminal untuk backend dan frontend.

### Cara 2: Manual Lewat Terminal

**Terminal 1 — Backend:**
```powershell
cd E:\epiona-assistant\backend
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

**Terminal 2 — Frontend:**
```powershell
cd E:\epiona-assistant\frontend
npm run dev
```

Buka peramban di:
- **Aplikasi Web**: [http://localhost:3005](http://localhost:3005)
- **Dokumentasi API Swagger**: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)

---

## 4. Konfigurasi Opsional (Groq API Key)
Jika ingin menggunakan model Llama-3.3-70b via Groq Cloud:
1. Buat API key gratis di [console.groq.com](https://console.groq.com/).
2. Buat file `.env` di folder `backend/` dan isi:
   ```env
   GROQ_API_KEY=gsk_kunci_anda_di_sini
   GROQ_MODEL=llama-3.3-70b-versatile
   ```
*(Jika `.env` tidak diisi, sistem tetap berjalan normal menggunakan mesin sintesis lokal deterministik).*
