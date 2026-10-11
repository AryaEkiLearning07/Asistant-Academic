# Modul Modal & Dialog EPIONA

Direktori ini menampung dialog modal terisolasi yang dipanggil secara deklaratif tanpa merusak hierarki DOM halaman utama.

## Komponen:
1. `DocumentPreviewModal.tsx`: Layar penuh viewer PDF bawaan browser dengan tombol unduh dan buka di tab terpisah.
2. `UserChatInspectorModal.tsx`: Alat audit transkrip verbatim percakapan pengguna untuk administrator.
3. `ProfileSettingsModal.tsx`: Modal profil akun, ganti mode tema terang/gelap, ringkasan statistik akademik, dan logout.
4. `ConfirmDialogModal.tsx`: Pengganti standar untuk modal konfirmasi penghapusan dan alert sistem (menggantikan `window.confirm` dan `window.alert`).
