# LAPORAN PERBAIKAN P3-1b: PENINGKATAN KUALITAS & RESILIENSI PENCARIAN AKADEMIK (EPIONA ASSISTANT)

**Repositori**: Epiona Assistant  
**Branch**: `fix/audit-p0`  
**Status**: SELESAI & TERVERIFIKASI EMPIRIS  
**Tanggal Verifikasi**: 14 Oktober 2026  
**Standar Arsitektur**: Context7 Deep Mode (Zero Assumption, Strict Minimality, High-Density Execution)

---

## 1. RINGKASAN EKSEKUTIF

Pada tahap audit P3-1, pengujian langsung kueri farmasi klinis:
> *"interaksi warfarin dengan aspirin risiko perdarahan"* (mode academic)

menemukan tiga kelompok kegagalan kritis:
1. **HTTP 429 (Rate Limit) pada PubMed EFetch & Semantic Scholar**: Panggilan asinkron simultan memicu rate limiting server hulu NCBI (tanpa API key batas 3 req/s) dan Semantic Scholar Graph API (~1 req/s tanpa kunci).
2. **Relevansi Buruk (Penyimpangan Entitas Medis)**: Muncul publikasi yang sama sekali tidak relevan seperti *Moxifloxacin*, *Fontan procedure*, dan *Ibrutinib* pada peringkat teratas karena tidak adanya isolasi entitas obat kunci, kegagalan translasi non-LLM, pencarian teks liar pada openFDA, serta bobot EBM yang mendominasi di atas relevansi faktual.
3. **Salah Label Derajat Bukti EBM**: Artikel tinjauan (*Review*) yang mengkaji uji klinis acak (*RCT*) salah dilabeli sebagai `rct` karena regex mencocokkan teks abstrak terlebih dahulu daripada membaca metadata tipe publikasi resmi (*MeSH PublicationType* / *publicationTypes*).

Seluruh permasalahan di atas telah diperbaiki secara tuntas melalui arsitektur deterministik terpadu, diverifikasi dengan **67 unit test lulus 100%** di `pytest`, serta divalidasi pada **5 kueri farmasi klinis riil** melalui skrip diagnostik `backend/scripts/live_search_check.py`.

---

## 2. ANALISIS AKAR MASALAH (ROOT CAUSE ANALYSIS)

### 2.1 HTTP 429 Rate Limit & Redundansi EFetch
- **Penyebab**: `SearchOrchestrator` sebelumnya memecah kueri menjadi primer dan sekunder, lalu menembak `PubMedProvider.search()` dua kali secara paralel. Masing-masing pemanggilan melakukan 1x `esearch` dan 1x `efetch`. Akibatnya, terjadi 2 pemanggilan `efetch` beruntun dalam fraksi milidetik, melanggar batas 3 req/s NCBI tanpa API key. Hal serupa terjadi pada Semantic Scholar Graph API tanpa interval jeda dan tanpa penanganan backoff bertingkat saat menerima header `HTTP 429 Too Many Requests`.

### 2.2 Relevansi Buruk (Moxifloxacin, Fontan, Ibrutinib)
- **Penyebab 1 (Kegagalan Translasi Kueri)**: Jika endpoint translasi cepat gagal atau mengembalikan teks asli bahasa Indonesia (*"interaksi warfarin dengan aspirin risiko perdarahan"*), kata-kata non-Inggris tersebut dikirim mentah-mentah ke basis data internasional. PubMed dan Europe PMC mengabaikan istilah tak dikenal dan hanya mencocokkan kata parsial (misal *aspirin*), sehingga mengembalikan naskah acak.
- **Penyebab 2 (openFDA Mengambil Kata Bebas)**: Provider openFDA sebelumnya mengambil 2 kata pertama dari kueri mentah (`['interaksi', 'warfarin']`) dan mencari label untuk *"interaksi warfarin"* alih-alih entitas obat aktifnya.
- **Penyebab 3 (Bobot EBM Tanpa Gatekeeper Relevansi)**: Naskah tentang *Moxifloxacin* atau *Fontan* yang bertipe `meta_analysis` atau `rct` secara otomatis mendapat bobot EBM tinggi (+0.40 atau +0.30). Meskipun skor relevansi teksnya hampir nol, bobot EBM melambungkan naskah menyimpang tersebut ke posisi 1-3.

### 2.3 Salah Klasifikasi Derajat Bukti (Review Dilabeli RCT)
- **Penyebab**: Fungsi `_determine_evidence_level()` menggabungkan string tipe publikasi dengan teks abstrak (`combined_text = pub_types + text`). Artikel tinjauan (*Systematic Review / Review*) yang mencantumkan kalimat *"We reviewed randomized controlled trials (RCTs)..."* di bagian metodologi abstrak langsung terpicu oleh regex RCT, sehingga metadata resmi `PublicationType: Review` terabaikan.

---

## 3. PERUBAHAN IMPLEMENTASI & REKAYASA TEKNIS

### 3.1 Rate Limiting, Throttling & 429 Retry Backoff
- **Modul Baru**: [`backend/app/search/throttler.py`](backend/app/search/throttler.py)
  - `Throttler`: Asynchronous rate limiter & concurrency controller berbasis `asyncio.Semaphore` dan `asyncio.Lock` yang membatasi interval antar-permintaan (`1.0 / req_per_second`) dan kuota konkurensi aktif.
  - `execute_with_retry()`: Wrapper HTTP dengan penanganan status 429 otomatis. Mendukung pembacaan header `Retry-After` dan fallback *exponential backoff* ($1.0\text{s} \to 2.0\text{s} \to 4.0\text{s}$), maksimal 3 kali percobaan ulang sebelum menyerah secara aman.
- **Optimasi PubMed**:
  - Konfigurasi laju: $\le 3\text{ req/s}$ tanpa API key; $10\text{ req/s}$ jika `NCBI_API_KEY` terkonfigurasi.
  - Penambahan metode `search_queries()` pada [`PubMedProvider`](backend/app/search/pubmed.py): Menjalankan `esearch` untuk variasi kueri yang dihasilkan, menggabungkan daftar PMID secara unik (*deduplicated*), lalu mengeksekusi **SATU kali `efetch` tunggal**. Hal ini memangkas 50% panggilan `efetch` NCBI.
- **Dukungan API Key & Throttling Semantic Scholar**:
  - Mendukung variabel lingkungan `S2_API_KEY` (atau `SEMANTIC_SCHOLAR_API_KEY`) di [`backend/app/config.py`](backend/app/config.py).
  - Laju throttle diatur $\sim 1.0\text{ req/s}$ jika tanpa kunci, dan dinaikkan menjadi $10\text{ req/s}$ dengan kunci, lengkap dengan injeksi header `x-api-key` dan retry backoff 429.

### 3.2 Penanganan Relevansi, Entitas Obat & Query Rewriting
- **Ekstraksi Entitas Obat Non-LLM**:
  - Diimplementasikan pada [`SearchRouter.extract_drug_entities()`](backend/app/search/router.py).
  - Menggunakan kamus 70+ zat aktif farmasi baku (`KNOWN_DRUGS`), pemetaan sinonim/alias lokal Indonesia ke nama generik internasional (`DRUG_ALIASES`, misal: *asam mefenamat* $\to$ *mefenamic acid*, *parasetamol* $\to$ *paracetamol*, *siprofloksasin* $\to$ *ciprofloxacin*), dan *regex stemmer* akhiran farmakologi (`-statin`, `-olol`, `-pril`, `-sartan`, `-dipine`, `-floxacin`, `-cillin`, `-xaban`, dll).
- **Kamus Fallback Translasi Medis ID $\to$ EN Non-LLM**:
  - [`SearchRouter.translate_to_english_fallback()`](backend/app/search/router.py) memetakan frasa medis penting (*risiko perdarahan* $\to$ *bleeding risk*, *efek samping* $\to$ *adverse effects*, *gangguan fungsi ginjal* $\to$ *renal impairment*, *aturan pakai* $\to$ *dosage administration*, dll).
  - Menjamin kueri yang dikirim ke basis data internasional selalu 100% berbahasa Inggris ilmiah deterministik tanpa ketergantungan jaringan eksternal/LLM.
- **Query Rewrite Berjangkar Entitas**:
  - Seluruh variasi kueri yang dibentuk (primer, efek samping/interaksi, meta-analisis/review, luaran klinis) **wajib menyertakan entitas obat yang terdeteksi** di posisi terdepan.
- **Isolasi Sasaran openFDA**:
  - [`OpenFDALabelProvider.search()`](backend/app/search/openfda_label.py) diperbarui untuk **HANYA mencari entitas obat yang terdeteksi secara valid**. Jika kueri bukan pertanyaan farmasi/obat (misal: konsep jaringan), openFDA tidak membuang kuota HTTP dan langsung mengembalikan `[]`.
  - Jika terdapat 2 obat (misal: *warfarin* dan *aspirin*), openFDA mengambil label resmi masing-masing obat dan secara eksplisit mengekstrak bagian `drug_interactions` ke dalam cuplikan teks.
- **Filter Entitas Kunci & Reranker Judul + Abstrak**:
  - Pada [`calculate_relevance_score()`](backend/app/search/ranking.py), pencocokan dievaluasi atas judul (bobot 3.0x) dan cuplikan/abstrak (bobot 1.5x).
  - **Invarian Eliminasi**: Naskah yang sama sekali tidak memuat satupun entitas obat yang dicari langsung diberi skor penalti $\le 0.01$ dan disingkirkan dari daftar kandidat akhir.
  - **Bonus Ko-okurensi Multi-Obat**: Naskah yang memuat kedua obat interaksi (misal *warfarin* DAN *aspirin*) mendapatkan skor relevansi ganda (+0.45).
  - **Gatekeeper Derajat Bukti (EBM Gating)**: Bobot EBM penuh hanya diberikan kepada artikel yang terbukti relevan secara faktual ($\text{rel} \ge 0.20$). Naskah tidak relevan dilarang menduduki peringkat atas hanya karena berjenis meta-analisis/RCT.

### 3.3 Klasifikasi Bukti EBM Terpadu (Publication Type Priority)
- Diimplementasikan fungsi terpusat [`classify_evidence_level()`](backend/app/search/models.py):
  1. **Prioritas Utama (Wajib)**: Evaluasi metadata resmi tipe publikasi (`pub_types` dari MeSH PubMed, Semantic Scholar `publicationTypes`, atau Europe PMC `pubTypeList`). Tipe `review` / `systematic_review` / `meta_analysis` dievaluasi sebelum `rct`, sehingga naskah telaah pustaka tidak akan pernah salah dilabeli sebagai RCT.
  2. **Fallback 1**: Regex eksplisit pada judul naskah (*title*).
  3. **Fallback 2**: Regex eksplisit pada abstrak (*abstract*).
  4. Default: `journal`.

---

## 4. BUKTI EMPIRIS PENGUJIAN UNIT (PYTEST)

Seluruh suite pengujian backend dijalankan dengan perintah:
```bash
python -m pytest backend
```

### Hasil Uji Terminal:
```text
============================= test session starts =============================
platform win32 -- Python 3.14.2, pytest-9.1.1, pluggy-1.6.0
rootdir: E:\epiona-assistant
configfile: pytest.ini
plugins: anyio-4.15.0, asyncio-1.4.0
asyncio: mode=Mode.STRICT, debug=False

collected 67 items

backend\tests\test_backend.py ...........                                [ 16%]
backend\tests\test_p1_features.py ...............                        [ 38%]
backend\tests\test_p2_features.py ...........                            [ 55%]
backend\tests\test_p3_1_search.py ..........................             [ 94%]
backend\tests\test_p3a_features.py ....                                  [100%]

================== 67 passed, 1 warning in 108.69s (0:01:48) ==================
```

### Rincian 11 Unit Test Baru P3-1b di `test_p3_1_search.py`:
| No | Nama Unit Test | Area yang Diuji | Status |
|---|---|---|---|
| 1 | `test_pubmed_retry_on_429` | Simulasi PubMed ESearch HTTP 429 2x, retry berhasil pada percobaan ke-3 | **PASSED** |
| 2 | `test_pubmed_combined_esearch_single_efetch` | Verifikasi 2 kueri esearch digabung jadi 1 panggilan efetch tunggal | **PASSED** |
| 3 | `test_semantic_scholar_retry_on_429_and_api_key` | S2 rate limiting, retry backoff 429, dan validasi header `x-api-key` | **PASSED** |
| 4 | `test_query_rewrite_drug_extraction_warfarin_aspirin` | Ekstraksi entitas `['warfarin', 'aspirin']` dan jaminan ada di semua kueri | **PASSED** |
| 5 | `test_translate_fallback_non_llm_dictionary` | Translasi deterministik non-LLM kueri farmasi ID $\to$ EN ilmiah | **PASSED** |
| 6 | `test_openfda_skips_when_no_drug_detected` | openFDA tidak melakukan HTTP call jika kueri tidak memuat entitas obat | **PASSED** |
| 7 | `test_openfda_targets_detected_drugs` | openFDA mencari entitas obat aktif dan mengekstrak `drug_interactions` | **PASSED** |
| 8 | `test_ranking_filters_unrelated_entities_moxifloxacin_fontan_ibrutinib` | Eliminasi total naskah Moxifloxacin, Fontan, Ibrutinib pada kueri warfarin-aspirin | **PASSED** |
| 9 | `test_evidence_classification_review_not_labeled_rct` | Jaminan artikel Review yang menyebut RCT di abstrak tetap berlabel `review` | **PASSED** |
| 10 | `test_evidence_classification_systematic_review_priority` | Prioritas publication type Systematic Review di atas regex teks | **PASSED** |
| 11 | `test_evidence_classification_title_and_abstract_fallback` | Fallback klasifikasi EBM berbasis judul/abstrak jika metadata kosong | **PASSED** |

---

## 5. BUKTI EMPIRIS SKRIP PENGUJIAN LANGSUNG (LIVE SEARCH CHECK)

Skrip diagnostik dijalankan langsung terhadap provider eksternal di terminal:
```bash
python backend/scripts/live_search_check.py
```

### Rangkuman Hasil Nyata 5 Kueri Farmasi Klinis:

| No | Kueri Farmasi Riil | Entitas Obat | Total Hasil | Peringkat #1 (Top Result) | Level Bukti | Status Galat & Throttling |
|---|---|---|---|---|---|---|
| **1** | *"interaksi warfarin dengan aspirin risiko perdarahan"* | `warfarin`, `aspirin` | 8 naskah | **Warfarin Sodium - FDA Approved Drug Label** (DailyMed 2025) | `DRUG_LABEL` | **Penyimpangan 0%** (Moxifloxacin, Fontan, Ibrutinib LENYAP). PubMed 0 galat. S2 backoff 429 terkendali. |
| **2** | *"efek samping amlodipine pada lansia"* | `amlodipine` | 9 naskah | **Effects of candesartan compared with amlodipine in hypertensive patients...** | `RCT` | PubMed 0 galat. Label resmi FDA Amlodipine di Top #2. |
| **3** | *"dosis metformin untuk pasien diabetes melitus tipe 2 dengan gangguan fungsi ginjal"* | `metformin` | 10 naskah | **Efficacy and Safety of Metformin and Atorvastatin Combination Therapy...** | `RCT` | PubMed 0 galat. Penyesuaian dosis ginjal & kombinasi tercakup. |
| **4** | *"efektivitas dan keamanan atorvastatin versus rosuvastatin"* | `atorvastatin`, `rosuvastatin` | 10 naskah | **Rosuvastatin versus atorvastatin treatment in adults with CAD (LODESTAR trial)** | `RCT` | BMJ 2023. Memuat kedua obat komparatif secara presisi. |
| **5** | *"kontraindikasi ciprofloxacin pada kehamilan dan menyusui"* | `ciprofloxacin` | 6 naskah | **ciprofloxacin - FDA Approved Drug Label** (DailyMed 2022) | `DRUG_LABEL` | Kontraindikasi teratogenik & laktasi tertera di Top #1 & Top #3. |

### Bukti Cuplikan Naskah Hasil Nyata Kueri #1 (Warfarin + Aspirin):
```text
================================================================================
[1/5] KUERI NYATA: "interaksi warfarin dengan aspirin risiko perdarahan"
================================================================================
[*] Entitas Obat Terdeteksi : ['warfarin', 'aspirin']
[*] Kueri Hasil Rewrite     :
    1. warfarin aspirin interaction with risk bleeding
    2. warfarin aspirin drug interaction adverse effects
    3. warfarin aspirin bleeding systematic review meta-analysis
    4. warfarin aspirin clinical guidelines safety outcomes

[*] Total Hasil Ditemukan   : 8 naskah/label (14.18 detik)
[*] TOP 5 HASIL PERINGKAT TERATAS:
--------------------------------------------------------------------------------
 #1 [Skor: 0.6550] [DRUG_LABEL] (2025) Warfarin Sodium - FDA Approved Drug Label
    Jurnal/Sumber : U.S. FDA Drug Database
    Entitas Cocok : ['warfarin', 'aspirin'] / ['warfarin', 'aspirin']
    URL           : https://dailymed.nlm.nih.gov/dailymed/search.cfm?labeltype=all&query=warfarin
    Cuplikan      : Interaksi: 7 DRUG INTERACTIONS Concomitant use of drugs that increase bleeding risk, antibiotics, antifungals, botanical (herbal) products, ...

 #2 [Skor: 0.5950] [REVIEW] (2014) Bleeding risk factors affecting warfarin therapy in the elderly with atrial fibrillation
    Jurnal/Sumber : Dimensions of critical care nursing : DCCN
    Entitas Cocok : ['warfarin', 'aspirin'] / ['warfarin', 'aspirin']
    URL           : https://doi.org/10.1097/DCC.0000000000000022
    Cuplikan      : PURPOSE: Inadequate anticoagulation among elderly individuals with atrial fibrillation (AF) is a common problem. This synthesis of the liter...

 #3 [Skor: 0.4495] [META_ANALYSIS] (2024) Risk of bleeding with concomitant use of oral anticoagulants and aspirin: A systematic review and meta-analysis
    Jurnal/Sumber : American journal of health-system pharmacy : AJHP
    Entitas Cocok : ['aspirin'] / ['warfarin', 'aspirin']
    URL           : https://doi.org/10.1016/j.chest.2015.11.026
    Cuplikan      : PURPOSE: Oral anticoagulants (OACs) and aspirin can trigger bleeding events when used alone or in combination. The purpose of this study was...

 #4 [Skor: 0.4304] [REVIEW] (2021) Gastroprotection in patients on antiplatelet and/or anticoagulant therapy: a position paper of National Association of Hospital Cardiologists (ANMCO)...
    Jurnal/Sumber : European journal of internal medicine
    Entitas Cocok : ['warfarin', 'aspirin'] / ['warfarin', 'aspirin']
    URL           : https://doi.org/10.1016/j.ejim.2020.11.014

 #5 [Skor: 0.4046] [REVIEW] (2023) Contemporary Antiplatelet and Anticoagulant Therapies for Secondary Stroke Prevention: A Narrative Review of Current Literature and Guidelines
    Jurnal/Sumber : Current neurology and neuroscience reports
    Entitas Cocok : ['warfarin', 'aspirin'] / ['warfarin', 'aspirin']
    URL           : https://doi.org/10.1007/s11910-023-01266-2
```

---

## 6. INVENTARIS BERKAS YANG DIUBAH / DIBUAT

1. [`backend/app/config.py`](backend/app/config.py): Penambahan `S2_API_KEY` (mendukung alias `SEMANTIC_SCHOLAR_API_KEY`).
2. [`backend/.env.example`](backend/.env.example): Dokumentasi konfigurasi `S2_API_KEY`.
3. [`backend/app/search/throttler.py`](backend/app/search/throttler.py) *(Baru)*: Implementasi `Throttler` dan `execute_with_retry()` untuk rate limit & retry backoff 429.
4. [`backend/app/search/models.py`](backend/app/search/models.py): Penambahan fungsi terpusat `classify_evidence_level()` berhirarki ketat publication type.
5. [`backend/app/search/pubmed.py`](backend/app/search/pubmed.py): Integrasi rate throttle ($\le 3$ / $10\text{ req/s}$), retry backoff 429, dan metode `search_queries()` untuk menggabungkan esearch multi-kueri sebelum satu kali efetch tunggal.
6. [`backend/app/search/semantic_scholar.py`](backend/app/search/semantic_scholar.py): Dukungan `S2_API_KEY`, rate throttle $\sim 1\text{ req/s}$ (atau 10 dengan key), dan retry backoff 429.
7. [`backend/app/search/europepmc.py`](backend/app/search/europepmc.py): Integrasi `classify_evidence_level()`.
8. [`backend/app/search/openfda_label.py`](backend/app/search/openfda_label.py): Filter ketat hanya menembak entitas obat terdeteksi dan mengekstrak medan `drug_interactions`.
9. [`backend/app/search/router.py`](backend/app/search/router.py): Ekstraksi entitas obat non-LLM (`extract_drug_entities`), kamus translasi medis ID $\to$ EN non-LLM (`translate_to_english_fallback`), dan query rewriting berjangkar entitas.
10. [`backend/app/search/ranking.py`](backend/app/search/ranking.py): Eliminasi naskah tanpa entitas kunci, bonus ko-okurensi multi-obat, reranker judul+abstrak, dan EBM relevance gating.
11. [`backend/app/search/orchestrator.py`](backend/app/search/orchestrator.py): Orkestrasi pencarian multi-kueri PubMed terpadu, isolasi openFDA, dan perankingan EBM berbasis entitas.
12. [`backend/app/search/__init__.py`](backend/app/search/__init__.py): Ekspor fungsi & kelas baru.
13. [`backend/scripts/live_search_check.py`](backend/scripts/live_search_check.py) *(Baru)*: Skrip pengujian langsung 5 kueri farmasi nyata dengan pelaporan diagnostik.
14. [`backend/tests/test_p3_1_search.py`](backend/tests/test_p3_1_search.py): Penambahan 11 unit test mock mencakup seluruh perbaikan P3-1b.
15. [`FIX-P3-1B-LAPORAN.md`](FIX-P3-1B-LAPORAN.md) *(Baru)*: Dokumen laporan resmi hasil audit dan verifikasi P3-1b.

---

## 7. KESIMPULAN & STATUS AKHIR

Sesuai instruksi pada `agy-prompt-p3-1b.txt`:
- Seluruh perbaikan P3-1b telah diselesaikan secara tuntas.
- Tidak ada tindakan `git commit` maupun `git push` yang dilakukan (tetap bersih di branch `fix/audit-p0`).
- Semua unit test (`pytest`, 67 tes) lulus tanpa kegagalan.
- Skrip diagnostik `live_search_check.py` telah dieksekusi secara nyata dan hasilnya dicatat secara faktual.
- Laporan komprehensif dalam Bahasa Indonesia telah disusun pada `FIX-P3-1B-LAPORAN.md`.
