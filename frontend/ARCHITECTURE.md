# Arsitektur Frontend Modular EPIONA Assistant

Dokumen ini menjelaskan struktur arsitektur sistem frontend [EPIONA Research Assistant](file:///E:/epiona-assistant/frontend). Seluruh komponen telah direfaktor secara ketat ke dalam modul-modul independen dan terisolasi dengan batas prop standar (~300 baris per sub-komponen) agar model AI maupun developer baru dapat memahami seluruh aliran data tanpa perlu membaca ribuan baris kode sumber sekaligus.

---

## 1. Peta Pohon Modul & Direktori

```text
E:\epiona-assistant\frontend\
├── app\
│   └── page.tsx                    # Root Orchestrator murni (state global, auth, routing)
├── types\
│   └── index.ts                    # Antarmuka TypeScript bersama (Entity models, DTO, Props)
├── components\
│   ├── auth\
│   │   ├── AuthScreen.tsx          # Layar login & pendaftaran akun multi-tenant
│   │   └── README.md
│   ├── sidebar\
│   │   ├── LeftSidebar.tsx         # Sidebar navigasi sesi & percakapan
│   │   └── README.md
│   ├── dashboard\
│   │   ├── DashboardView.tsx       # Tampilan beranda & kartu modul utama
│   │   └── README.md
│   ├── library\
│   │   ├── LibraryView.tsx         # Manajemen dokumen PDF MyLibrary
│   │   ├── FileFormatIcon.tsx      # Ikon resmi Adobe PDF, Word, Excel, PPT
│   │   └── README.md
│   ├── workspace\
│   │   ├── WorkspaceView.tsx       # Container interaksi chat & split-pane viewer
│   │   ├── SourcesAccordionPopover.tsx # Popover rujukan bukti ilmiah Perplexity-style
│   │   ├── EvidenceViewerPanel.tsx # Viewer panel kanan (PDF & web academic)
│   │   └── README.md
│   ├── chat\
│   │   ├── ChatBubble.tsx          # Gelembung chat user (kanan) & assistant (kiri)
│   │   ├── ChatInputForm.tsx       # Input form chat (Hero Centered & Bottom Sticky)
│   │   └── README.md
│   ├── admin\
│   │   ├── AdminConsoleView.tsx    # Admin & Dev Console (4 tab pengawasan VPS)
│   │   └── README.md
│   └── modals\
│       ├── DocumentPreviewModal.tsx    # Iframe viewer popup dokumen
│       ├── UserChatInspectorModal.tsx  # Audit verbatim transkrip pengguna
│       ├── ProfileSettingsModal.tsx    # Pengaturan akun, preferensi tema, ringkasan
│       ├── ConfirmDialogModal.tsx      # Dialog konfirmasi & alert bawaan platform
│       └── README.md
```

---

## 2. Aliran Data & State Global (Orchestration Flow)

1. **Root Orchestrator (`app/page.tsx`)**:
   - Menyimpan `currentUser`, `currentNav` (`dashboard` | `workspace` | `library` | `admin`), dan `theme` (`light` | `dark`).
   - Menyimpan `messages`, `chatSessions`, dan `documents`.
   - Mengarahkan aksi API (`/api/v1/chat`, `/api/v1/documents`, `/api/v1/auth`, `/api/v1/admin`) ke komponen anak melalui props eksplisit.

2. **Workspace & Claude-Style Chat Flow**:
   - **Hero Centered Input**: Ketika percakapan baru dibuka (`messages.length === 0`), kotak input utama berada di tengah layar secara lapang (layaknya Claude Desktop).
   - **Transisi Dinamis**: Begitu pesan pertama dikirim pengguna, tampilan otomatis beralih ke stream percakapan penuh dan input box berpindah menjadi *bottom sticky productivity bar*.
   - **Dual-Pane Evidence Viewer**: Mengklik sitasi nomor `[1]` atau kutipan naskah akan membuka lembaran fisik PDF atau *Academic Evidence Viewer* di split-pane sebelah kanan secara responsif tanpa tumpang-tindih.

3. **Multi-Tenant Security & Role-Based Access**:
   - Sesi pengguna diisolasi via token otentikasi.
   - Hak akses Super Admin diverifikasi di UI maupun backend FastAPI. Tab `Admin & Dev Center` hanya aktif dan terlihat untuk akun ber-role admin (`admin@epiona.my.id`).
