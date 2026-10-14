# LAPORAN REDESIGN UI EPIONA ASSISTANT: PERPLEXITY & CLAUDE DENSE RESEARCH INTERFACE

**Tanggal:** 14 Oktober 2026  
**Repositori:** Epiona Assistant (`frontend`)  
**Branch:** `fix/audit-p0`  
**Status Git:** Sesuai instruksi mutlak, **TIDAK ada commit maupun push ke Git**.  
**Kepatuhan Backend:** **Nol modifikasi logika backend** (0 baris di `backend/` disentuh).  

---

## 1. Ringkasan Eksekutif

Implementasi redesign antarmuka pengguna (UI/UX) Epiona telah diselesaikan secara tuntas 100% mengacu pada spesifikasi rancangan di berkas [`agy-desain-ui.md`](agy-desain-ui.md) dan instruksi penugasan [`agy-prompt-desain.txt`](agy-prompt-desain.txt).

Tampilan Epiona kini mengadopsi estetika tenang, padat, profesional, dan berbobot ala **Perplexity** dan **Claude**, menghilangkan seluruh aksen gradien neon, border glow, badge dekoratif berlebih, atau template "AI slop". Seluruh token desain telah terstandarisasi, hierarki teks diperjelas, kolom chat dipatok pada rasio optimal 760px, serta komponen sumber, sitasi, dan panel dokumen terhubung langsung dengan pemancaran data SSE (`event: "sources"`) dari backend.

---

## 2. Resolusi 5 Masalah Utama Antarmuka

| Masalah Sebelumnya | Solusi Redesign Terpasang |
|---|---|
| **1. Ketiadaan Sumber Jelas & Jawaban "Tidak Ditemukan" Bertele-tele** | Kartu sumber horizontal (`SourceCards`, 200×72px) tampil di atas respon. State tidak ditemukan dirender oleh komponen `NoResult` kompak dengan aksi 1-klik ("Cari di Akademik", "Cari di Web", "Unggah dokumen"). |
| **2. Hierarki Lemah & Timestamp Berulang yang Mengganggu** | Bubble user menggunakan `surface-2` dengan `max-w-[80%]` dan `rounded-lg` (14px). Timestamp monospace dihapus; waktu kirim hanya muncul secara elegan saat bubble di-hover. Teks jawaban asisten berukuran 16px dengan line-height 1.7. |
| **3. Aksen Teal Glow Dipakai Berlebihan** | Seluruh box-shadow neon dan glow dihilangkan. Aksen teal murni dibatasi hanya untuk: tombol kirim aktif, mode grounding aktif, hover sitasi chip, dan ring fokus input. |
| **4. Toggle Mode Kecil & Terpisah dari Model** | Kontrol segmented mode terpadu (`ModeSegmented`) berukuran tinggi 28px ditempatkan berdampingan di baris kontrol komposer bersama pemilih model (`ModelSelect`) dan tombol kirim 32×32px. Placeholder komposer otomatis beradaptasi dengan mode aktif. |
| **5. Ruang Kosong Atas & Kolom Baca Terlalu Sempit** | Kolom chat dipatok maksimal 760px (`px-6`) untuk kenyamanan membaca optimal. Sidebar sumber kanan 400px terintegrasi responsif (docked pada layar ≥1280px dan drawer geser pada <1280px). Aksi jawaban dilengkapi Salin, Regenerasi, Feedback (👍/👎), dan Buka Sumber. |

---

## 3. Sistem Token, Tipografi, & CSS Variables

### 3.1. Pemetaan Token Light & Dark Mode
Token CSS variables telah ditambahkan pada [`frontend/app/globals.css`](frontend/app/globals.css) dan dipetakan ke Tailwind CSS di [`frontend/tailwind.config.ts`](frontend/tailwind.config.ts):

| Token | Light Mode | Dark Mode | Fungsi Penggunaan |
|---|---|---|---|
| `bg` | `#FAFAF9` | `#0F1115` | Latar belakang kanvas aplikasi |
| `surface` | `#FFFFFF` | `#16191F` | Kartu utama, panel samping, modal |
| `surface-2` | `#F3F4F2` | `#1D2128` | Bubble pengguna, chip, kontrol segmented |
| `border` | `#E5E7E3` | `#2A2F37` | Garis batas komponen & divider |
| `text` | `#17191C` | `#E8EAED` | Tipografi utama tingkat kontras AA |
| `text-muted` | `#5F6670` | `#9AA1AB` | Teks sekunder, label, placeholder |
| `accent` | `#0F766E` | `#2DD4BF` | Aksen aktif, tombol aksi utama, fokus |
| `accent-soft` | `#CCFBF1` | `#134E4A` | Background hover sitasi & badge aktif |
| `ev-jurnal` | `#2563EB` | `#60A5FA` | Indikator tingkat bukti jurnal ilmiah |
| `ev-label` | `#7C3AED` | `#A78BFA` | Indikator label resmi (FDA/BPOM) |
| `ev-web` | `#6B7280` | `#9CA3AF` | Indikator bukti referensi web umum |
| `danger` | `#DC2626` | `#F87171` | Status error, tombol batalkan/hapus |

### 3.2. Radius & Bayangan
- **Radius:** `sm: 6px`, `md: 10px`, `lg: 14px`, `pill: 9999px`.
- **Shadow:** Hanya untuk overlay/popover (`0 8px 24px rgba(0,0,0,0.12)`), tanpa glow atau drop-shadow neon.

### 3.3. Tipografi
- **UI:** Inter via `next/font/google` (`--font-inter`).
- **Jawaban Opsional:** Source Serif 4 (`font-answer-serif`).
- **Kode / Dosis:** JetBrains Mono via `next/font/google` (`--font-mono`).
- **Skala Teks:** 12px (caption/meta), 14px (UI kontrol), 16px (isi jawaban, line-height 1.7), 18px (subjudul), 24px (judul section), 32px (display).

---

## 4. Daftar Komponen yang Dibuat & Diperbarui

### 4.1. Komponen Baru (`frontend/components/chat/` & `workspace/`)
1. **[`Composer.tsx`](frontend/components/chat/Composer.tsx):**
   - Area pengetikan autogrow dari tinggi 56px hingga 240px.
   - Border radius `lg` (14px) dengan ring fokus `ring-2 ring-accent/20`.
   - Baris bawah terpadu 36px:
     - Kiri: Tombol lampiran (`Plus`, 16px) dan tombol suara (`Mic`, 16px).
     - Kanan: Kontrol segmented mode (`ModeSegmented`), pemilih model (`ModelSelect`), dan tombol kirim 32×32px.
   - State tombol kirim: Disabled (`bg-surface-2 text-text-muted`), Aktif (`bg-accent text-white`), dan Loading (`Square` stop icon untuk menghentikan respon).
   - Placeholder dinamis:
     - Library: *"Tanya dokumen MyLibrary…"*
     - Akademik: *"Cari jurnal PubMed/arXiv…"*
     - Web: *"Cari di web…"*
   - Aksesibilitas keyboard: `Enter` untuk mengirim pesan, `Shift+Enter` untuk baris baru.

2. **[`ModeSegmented.tsx`](frontend/components/chat/ModeSegmented.tsx):**
   - Kontrol tinggi 28px dengan item padding 10px.
   - Ikon Lucide 14px: `Library` (MyLibrary), `GraduationCap` (Akademik), `Globe` (Web).
   - Item aktif: `bg-surface text-text border border-border shadow-xs font-semibold`. Item nonaktif: `text-text-muted hover:text-text`.

3. **[`ModelSelect.tsx`](frontend/components/chat/ModelSelect.tsx):**
   - Dropdown selektor tinggi 28px.
   - Menu seleksi lebar 260px dengan centang pada opsi aktif dan 1 baris deskripsi fungsi:
     - **Otomatis:** *"Penyesuaian cerdas sesuai kompleksitas"*
     - **Cepat:** *"Respon instan, efisien & cepat"* (Gemini 2.0 Flash)
     - **Pro:** *"Penalaran mendalam & analisis formulasi"* (Claude 3.5 Sonnet)
     - **Terbaik:** *"Akurasi riset & sintesis tingkat lanjut"* (Claude 3.5 Sonnet)
   - Nama model teknis hanya dimuat pada tooltip dan metadata sekunder.

4. **[`SearchProgress.tsx`](frontend/components/chat/SearchProgress.tsx):**
   - Indikator progres pencarian 14px di atas jawaban asisten.
   - Transisi visual dari status berjalan (`Loader2` spinner) ke status selesai (`Check` accent).
   - Collapsible: dapat dibuka-tutup setelah seluruh langkah selesai.

5. **[`SourceCards.tsx`](frontend/components/chat/SourceCards.tsx):**
   - Baris scroll horizontal kartu sumber 200×72px di atas jawaban.
   - Radius `md` (10px) berbatas border tipis dengan hover `border-accent-soft`.
   - Memuat: ikon tipe 16px, judul 2 baris (13px, `line-clamp-2`), dan meta 12px (jurnal·tahun atau hal. n).
   - Kartu penutup *"N lainnya"* jika sumber lebih dari 4 rujukan.
   - Mengklik kartu langsung membuka tab rujukan di `SourcePanel`.

6. **[`CitationChip.tsx`](frontend/components/chat/CitationChip.tsx):**
   - Superscript chip `[n]` tinggi 18px, min-width 18px, radius `sm` (6px), ukuran 11px berlatar `surface-2`.
   - Hover mengaktifkan latar `accent-soft` dengan teks `accent`.
   - Popover preview selebar 320px yang menampilkan `EvidenceBadge`, judul dokumen/jurnal, dan potongan kutipan empiris.

7. **[`EvidenceBadge.tsx`](frontend/components/chat/EvidenceBadge.tsx):**
   - Pill badge tinggi 20px, padding horizontal 8px, font 11px semibold.
   - Titik indikator 6px berwarna sesuai kategori bukti:
     - Jurnal: dot `bg-ev-jurnal` (`#2563EB`/`#60A5FA`).
     - Label resmi: dot `bg-ev-label` (`#7C3AED`/`#A78BFA`).
     - Web: dot `bg-ev-web` (`#6B7280`/`#9CA3AF`).

8. **[`MessageActions.tsx`](frontend/components/chat/MessageActions.tsx):**
   - Ikon 16px gaya ghost: Salin (`Copy`), Regenerasi (`RotateCcw`), Feedback (`ThumbsUp` & `ThumbsDown`), dan Buka Sumber (`Layers`).
   - Tampil permanen pada pesan asisten terakhir, dan tampil saat kursor melayang (hover) pada pesan-pesan sebelumnya.

9. **[`NoResult.tsx`](frontend/components/chat/NoResult.tsx):**
   - Kartu informatif kompak dengan ikon `SearchX` dan 1 kalimat ringkas.
   - Tombol pengalihan cepat: *"Cari di Akademik"*, *"Cari di Web"*, dan *"Unggah dokumen"*.

10. **[`EmptyState.tsx`](frontend/components/chat/EmptyState.tsx):**
    - Judul 24px: *"Mau belajar apa hari ini?"*.
    - Komposer terpusat di tengah layar.
    - 4 chip rekomendasi pertanyaan beradius pill (tinggi 32px) yang menyesuaikan secara dinamis dengan mode aktif (Library, Akademik, Web).

11. **[`SourcePanel.tsx`](frontend/components/workspace/SourcePanel.tsx):**
    - Panel rujukan sisi kanan berukuran 400px.
    - Bersifat docked pada layar desktop (≥1280px) dan drawer geser dengan overlay pada layar ponsel/tablet (<1280px).
    - Navigasi keyboard: tombol `Esc` menutup panel secara instan.
    - Tab **Detail Sumber** dan **Daftar Sumber**:
      - **Viewer PDF:** Navigasi per halaman (*"hal. 12 dari 80"*), penyorotan kalimat terkutip dengan warna kuning transparansi 30% (`bg-yellow-400/30`), serta pratinjau lembaran PDF terintegrasi.
      - **Detail Jurnal:** Judul naskah, nama penulis, jurnal·tahun, tautan DOI dilengkapi tombol salin DOI 1-klik, serta intisari abstrak dengan highlight kalimat rujukan.
      - **Detail Web:** Nama domain, judul halaman, cuplikan 3–5 baris, dan tombol *"Buka di Web"*.

### 4.2. Komponen yang Diperbarui
1. **[`ChatBubble.tsx`](frontend/components/chat/ChatBubble.tsx):**
   - Format bubble user: bergeser ke kanan, latar `surface-2`, `max-w-[80%]`, radius `lg` (14px), padding 12×16px, timestamp tersembunyi hingga hover.
   - Format bubble asisten: ukuran font 16px dengan line-height 1.7, merender `SearchProgress`, `SourceCards`, `CitationChip`, `NoResult`, dan `MessageActions`.
2. **[`WorkspaceView.tsx`](frontend/components/workspace/WorkspaceView.tsx):**
   - Mengatur lebar maksimal kolom chat menjadi 760px (`max-w-[760px] mx-auto px-6`).
   - Mengintegrasikan `EmptyState`, `Composer` sticky bawah, dan `SourcePanel` 400px responsif.
3. **[`LibraryView.tsx`](frontend/components/library/LibraryView.tsx):**
   - Menata pustaka dokumen ke dalam grid 3 kolom dengan kartu selebar ~240px.
   - Menampilkan ikon tipe, judul 2 baris, jumlah halaman, dan tanggal pengunggahan.
   - Toolbar penelusuran + filter pill ("Semua", "PDF") + tombol "Unggah".
   - Menampilkan riwayat sesi percakapan dalam baris kompak 40px/baris.
4. **[`app/page.tsx`](frontend/app/page.tsx):**
   - Menghubungkan pemrosesan event SSE `"sources"` dari backend ke objek `SourceItem[]` terstruktur (`id`, `type`, `title`, `meta`, `page`, `doi`, `url`, `snippet`, `highlights`, `authors`, `journal`, `year`).
   - Menyimpan `sources` pada state `Message` asisten.
5. **[`types/index.ts`](frontend/types/index.ts):**
   - Mendefinisikan antarmuka `SourceItem`, `SourceItemType`, `SearchProgressStep`, dan memperbarui tipe `Message` serta preferensi model.

---

## 5. Hubungan Integrasi Backend SSE "sources"

Backend Epiona telah memancarkan event SSE berformat `{"type": "sources", "sources": [...]}` pada endpoint stream obrolan. Frontend kini menghubungkannya secara presisi:

```typescript
if (eventData.type === "sources") {
  const rawSources = eventData.sources || [];
  const parsedSourceItems: SourceItem[] = rawSources.map((s: any, idx: number) => {
    const isAcademic = s.source_type === "academic_web" || s.source_type === "journal" || Boolean(s.journal);
    const isLabel = s.source_type === "label";
    const isWeb = s.source_type === "web";
    const type: SourceItemType = isLabel ? "label" : isAcademic ? "journal" : isWeb ? "web" : "pdf";
    let meta = `hal. ${s.page_number || 1}`;
    if (isAcademic) {
      meta = `${s.journal || "Jurnal"}${s.year ? " · " + s.year : ""}`;
    } else if (isLabel) {
      meta = "Label resmi FDA";
    } else if (isWeb) {
      try {
        meta = s.url ? new URL(s.url).hostname.replace(/^www\./, "") : "Web";
      } catch {
        meta = "Web";
      }
    }
    return {
      id: s.id ? String(s.id) : `source-${idx + 1}`,
      type,
      title: s.title || "Referensi Terverifikasi",
      meta,
      page: s.page_number || 1,
      doi: s.doi,
      url: s.url,
      pdf_url: s.pdf_url,
      snippet: s.snippet || s.full_text || "",
      highlights: s.snippet ? [s.snippet] : [],
      authors: s.authors || [],
      journal: s.journal,
      year: s.year,
      evidence_level: s.evidence_level,
      document_id: s.document_id ? String(s.document_id) : undefined,
    };
  });

  setMessages((prev) =>
    prev.map((m) => (m.id === msgId ? { ...m, sources: parsedSourceItems } : m))
  );
}
```

---

## 6. Verifikasi & Pengujian Empiris

Sesuai instruksi mutlak, pengujian dilakukan langsung di direktori `frontend`:

### 6.1. TypeScript Type Checking (`npx tsc --noEmit`)
```bash
$ npx tsc --noEmit
Exit Code: 0 (No errors)
```
Semua tipe data, props antarmuka, dan definisi generik lulus 100% tanpa komplain compiler.

### 6.2. Production Build (`npm run build`)
```bash
$ npm run build
> epiona-assistant-frontend@1.0.0 build
> next build

   ▲ Next.js 15.5.27

   Creating an optimized production build ...
 ✓ Compiled successfully in 9.2s
   Linting and checking validity of types ...
   Collecting page data ...
   Generating static pages (0/4) ...
   Generating static pages (1/4) 
   Generating static pages (2/4) 
   Generating static pages (3/4) 
 ✓ Generating static pages (4/4)
   Finalizing page optimization ...
   Collecting build traces ...

Route (app)                                 Size  First Load JS
┌ ○ /                                     174 kB         276 kB
└ ○ /_not-found                            996 B         104 kB
+ First Load JS shared by all             103 kB
  ├ chunks/255-ce8c7c75002f810b.js       46.5 kB
  ├ chunks/4bd1b696-c023c6e3521b1417.js  54.2 kB
  └ other shared chunks (total)          1.98 kB

○  (Static)  prerendered as static content
Exit Code: 0
```
Build produksi Next.js teroptimasi 100% sukses tanpa error, tanpa peringatan linting, dan tanpa pemutusan rute.

---

## 7. Status Akhir

1. **Komitmen Git:** Bersih, tidak ada `git commit` maupun `git push` yang dieksekusi.
2. **Keluaran Berkas:** Seluruh komponen redesign terpasang rapi di tempatnya dan laporan didokumentasikan di `FIX-DESAIN-LAPORAN.md`.
3. **Kesiapan Antarmuka:** Antarmuka Epiona kini siap pakai dengan gaya riset tenang, padat, dan otoritatif.
