# Modul Chat EPIONA

Direktori ini menampung elemen-elemen pesan percakapan dan form input.

## Komponen:
1. `ChatBubble.tsx`: Gelembung pesan pengguna (sebelah kanan dengan pratinjau lampiran, tombol salin, regenerate, sunting pesan) dan pesan asisten (sebelah kiri dengan rendering Markdown bersih, diagram inline, dan pill sitasi interaktif).
2. `ChatInputForm.tsx`: Textarea input responsif yang mendukung mode `hero` (di tengah layar saat chat baru) dan mode `bottom` (di bawah layar saat diskusi berlangsung), dilengkapi integrasi mikrofon suara (Web Speech API) dan pengunggah lampiran multi-berkas.
