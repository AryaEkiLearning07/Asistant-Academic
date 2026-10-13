"""
Patch ai_service.py:
- Ganti CLAUDIA_STYLE_SYSTEM_PROMPT dari JSON murni ke format prosa Markdown mengalir
- Hapus response_format: json_object dari _call_openai_compatible dan _call_groq
- Hapus response_mime_type: application/json dari _call_gemini_pool
- Upgrade _safe_parse_json untuk membaca prosa + optional CITATIONS_JSON blok
"""

with open('app/ai_service.py', 'r', encoding='utf-8') as f:
    content = f.read()

# ============================================================
# 1. REPLACE CLAUDIA_STYLE_SYSTEM_PROMPT
# ============================================================
import re

# Find the block precisely
pattern = r'CLAUDIA_STYLE_SYSTEM_PROMPT = \(.*?\n\)'
match = re.search(pattern, content, re.DOTALL)
if match:
    print(f"Found CLAUDIA_STYLE_SYSTEM_PROMPT at char {match.start()}-{match.end()}")
    
    new_prompt = '''CLAUDIA_STYLE_SYSTEM_PROMPT = (
    "Anda adalah EPIONA Academic Research Assistant, asisten kecerdasan akademik untuk riset literatur dan analisis farmasi biomedis.\\n\\n"
    "IDENTITAS & PRINSIP SISTEM:\\n"
    "- Nama: EPIONA Academic Research Assistant.\\n"
    "- Pengembang: Dikembangkan oleh Arya Eki Nur Seputro sebagai platform riset literatur cerdas dengan isolasi konteks dokumen presisi tinggi dan penalaran ilmiah terstruktur.\\n"
    "- Integritas Data: Berprinsip pada grounding literatur ilmiah (zero-hallucination) dengan sitasi 1:1 ke lembar fisik dokumen serta eksplorasi jurnal terverifikasi.\\n\\n"
    "STANDAR KOMUNIKASI AKADEMIK PROFESIONAL (PRESISI, ANALITIS & INVERTED PYRAMID):\\n"
    "1. Langsung Ke Inti Jawaban (Inverted Pyramid): Kalimat PERTAMA respons harus langsung menjawab inti permasalahan secara tegas, presisi, dan solutif — seperti dosen senior atau peneliti yang menjawab pertanyaan mahasiswanya. "
    "DILARANG KERAS mengawali respons dengan salam atau filler seperti: \\'Baik,\\', \\'Tentu,\\', \\'Halo,\\', \\'Berikut penjelasannya:\\', \\'Pertanyaan yang bagus!\\', atau sejenisnya.\\n"
    "2. Bahasa Akademik Profesional & Mengalir: Uraikan materi dengan nada yang hidup, berwibawa, dan berbobot. Bukan chatbot — melainkan pakar yang berpikir keras dan menuangkan analisis mendalam secara lugas. Gunakan peristilahan farmasi/sains yang presisi, serta analogi intuitif untuk konsep yang abstrak.\\n"
    "3. Logika Analitis Terstruktur dengan Heading Markdown: Gunakan ### untuk sub-topik. Struktur ideal: (a) Jawaban inti langsung, (b) Mekanisme/Patofisiologi/Fondasi Teori (dengan heading ###), (c) Aplikasi Klinis atau Contoh Komputasi Nyata, (d) Implikasi Praktis/Catatan Penting. Gunakan paragraf analitis padat, bukan poin-poin dangkal.\\n"
    "4. Tipografi Bersih: Sintaks Markdown standar. **Tebal** untuk istilah teknis pertama kali muncul. Gunakan - atau 1. hanya jika konten benar-benar paralel dan setara.\\n"
    "5. Format Rumus & Notasi Sains (Wajib LaTeX):\\n"
    "   - SEMUA rumus matematika, farmakokinetika, dosis, dan variabel kimia/fisika WAJIB LaTeX: $...$ untuk inline (contoh: $t_{1/2}$, $C_{max}$, $V_d$, $AUC$, $pH = pKa + \\\\\\\\log\\\\\\\\frac{[A^-]}{[HA]}$) dan $$...$$ untuk rumus blok.\\n"
    "   - Jelaskan setiap variabel rumus secara runut (\\u2018di mana $C_0$ adalah konsentrasi awal...\\u2019).\\n\\n"
    "ATURAN GROUNDING RUJUKAN:\\n"
    "1. JIKA ADA KONTEKS DOKUMEN MYLIBRARY: Jawab fokus pada topik, cantumkan [1], [2] secara inline setelah klaim yang merujuk dokumen spesifik. Sebutkan nama dokumen dalam kalimat (contoh: \\'Berdasarkan Modul Farmakokinetika [1]...\\' atau \\'Sebagaimana diuraikan dalam materi Metode Numerik [2]...\\'). Hubungkan lintas modul jika diperlukan.\\n"
    "   Di akhir jawaban (setelah teks prosa selesai), tambahkan baris berikut PERSIS seperti ini:\\n"
    "   CITATIONS_JSON:[{\\\"document_id\\\":\\\"id\\\",\\\"document_title\\\":\\\"judul\\\",\\\"page_number\\\":1,\\\"exact_quote\\\":\\\"kutipan\\\"}]\\n"
    "2. JIKA PERTANYAAN KONSEPTUAL UMUM (tidak ada di dokumen): JAWAB SECARA TUNTAS. Jangan pernah menolak dengan kalimat kaku. Di akhir, tambahkan satu baris catatan: \\n"
    "   *(Catatan: Penjelasan ini bersifat konseptual analitis tambahan di luar materi spesifik dokumen referensi.)*\\n\\n"
    "FORMAT OUTPUT WAJIB: PROSA AKADEMIK MARKDOWN MENGALIR.\\n"
    "Tulis jawaban sebagai teks Markdown ilmiah mengalir — BUKAN JSON mentah. Respons harus dapat dibaca langsung tanpa parsing. "
    "Hanya tambahkan baris CITATIONS_JSON: di akhir jika ada sitasi dokumen. Tidak ada wrapper JSON di seluruh respons."
)'''
    
    content = content[:match.start()] + new_prompt + content[match.end():]
    print("CLAUDIA_STYLE_SYSTEM_PROMPT berhasil diganti.")
else:
    print("ERROR: CLAUDIA_STYLE_SYSTEM_PROMPT block NOT FOUND!")
    exit(1)

# ============================================================
# 2. HAPUS response_format json_object dari _call_openai_compatible
# ============================================================
old_payload_oai = '''        payload = {
            "model": model,
            "messages": messages_payload,
            "response_format": {"type": "json_object"},
            "temperature": 0.7 if (not relevant_pages and not doc_attachments) else 0.35,
            "max_tokens": 3000
        }'''

new_payload_oai = '''        payload = {
            "model": model,
            "messages": messages_payload,
            "temperature": 0.75 if (not relevant_pages and not doc_attachments) else 0.4,
            "max_tokens": 3500
        }'''

if old_payload_oai in content:
    content = content.replace(old_payload_oai, new_payload_oai, 1)
    print("response_format dihapus dari _call_openai_compatible.")
else:
    print("WARNING: payload OAI pattern tidak ditemukan — mungkin sudah diubah sebelumnya.")

# ============================================================
# 3. HAPUS response_format dari _call_groq
# ============================================================
old_groq = '''        chat_completion = self.groq_client.chat.completions.create(
            messages=messages,
            model=self.groq_model,
            response_format={"type": "json_object"},
            temperature=0.7 if (not relevant_pages and not doc_attachments) else 0.35,
            max_tokens=2500
        )'''

new_groq = '''        chat_completion = self.groq_client.chat.completions.create(
            messages=messages,
            model=self.groq_model,
            temperature=0.75 if (not relevant_pages and not doc_attachments) else 0.4,
            max_tokens=3000
        )'''

if old_groq in content:
    content = content.replace(old_groq, new_groq, 1)
    print("response_format dihapus dari _call_groq.")
else:
    print("WARNING: groq pattern tidak ditemukan.")

# ============================================================
# 4. HAPUS response_mime_type dari _call_gemini_pool
# ============================================================
old_gemini_gen = '''            "generationConfig": {
                "response_mime_type": "application/json",
                "temperature": 0.7 if (not relevant_pages and not doc_attachments) else 0.35,
                "maxOutputTokens": 3000
            }'''

new_gemini_gen = '''            "generationConfig": {
                "temperature": 0.75 if (not relevant_pages and not doc_attachments) else 0.4,
                "maxOutputTokens": 3500
            }'''

if old_gemini_gen in content:
    content = content.replace(old_gemini_gen, new_gemini_gen, 1)
    print("response_mime_type dihapus dari _call_gemini_pool.")
else:
    print("WARNING: gemini generationConfig pattern tidak ditemukan.")

# ============================================================
# 5. UPGRADE _safe_parse_json untuk hybrid parsing
# ============================================================
old_safe_parse = '''    def _safe_parse_json(self, raw_text: str) -> Dict[str, Any]:
        """Ekstraksi JSON aman dari respons LLM."""
        try:
            return json.loads(raw_text)
        except Exception:
            start = raw_text.find("{")
            end = raw_text.rfind("}")
            if start != -1 and end != -1:
                return json.loads(raw_text[start:end+1])
            return {"answer": raw_text.strip(), "citations": []}'''

new_safe_parse = '''    def _safe_parse_json(self, raw_text: str) -> Dict[str, Any]:
        """Parsing hybrid: prosa Markdown + optional CITATIONS_JSON baris di akhir."""
        if not raw_text:
            return {"answer": "", "citations": []}

        # Format baru: cek apakah ada baris CITATIONS_JSON: di akhir teks
        citations = []
        prose_text = raw_text.strip()

        # Cari tag CITATIONS_JSON:[...] di baris terakhir
        import re as _re
        citations_match = _re.search(
            r'CITATIONS_JSON:\s*(\[.*?\])\s*$',
            prose_text,
            _re.DOTALL
        )
        if citations_match:
            try:
                citations = json.loads(citations_match.group(1))
                # Hapus baris CITATIONS_JSON dari teks prose
                prose_text = prose_text[:citations_match.start()].rstrip()
            except Exception:
                pass  # Jika JSON citation rusak, abaikan saja

        # Jika tidak ada CITATIONS_JSON, coba format JSON lama (backward compat)
        if not citations_match:
            # Coba parse seluruh text sebagai JSON (format lama)
            try:
                data = json.loads(raw_text)
                if isinstance(data, dict) and "answer" in data:
                    return data  # format lama masih valid, pakai langsung
            except Exception:
                pass

            # Coba ekstrak JSON object dari dalam teks
            start = raw_text.find("{")
            end = raw_text.rfind("}")
            if start != -1 and end != -1:
                try:
                    data = json.loads(raw_text[start:end+1])
                    if isinstance(data, dict) and "answer" in data:
                        return data
                except Exception:
                    pass

        # Return format hybrid: prose sebagai answer, citations dari tag
        return {"answer": prose_text, "citations": citations}'''

if old_safe_parse in content:
    content = content.replace(old_safe_parse, new_safe_parse, 1)
    print("_safe_parse_json berhasil diupgrade ke hybrid parsing.")
else:
    print("WARNING: _safe_parse_json pattern tidak ditemukan — cek manual.")

# ============================================================
# 6. WRITE BACK
# ============================================================
with open('app/ai_service.py', 'w', encoding='utf-8') as f:
    f.write(content)

print("\n=== PATCH SELESAI ===")
print("Jalankan: python -m py_compile app/ai_service.py")
