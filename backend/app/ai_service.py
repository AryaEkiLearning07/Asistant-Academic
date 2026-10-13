import json
import logging
import urllib.request
import urllib.error
from typing import List, Dict, Any, Optional

from app.config import (
    ROUTER_BASE_URL,
    ROUTER_API_KEY,
    ROUTER_MODEL,
    OPENROUTER_API_KEY,
    OPENROUTER_BASE_URL,
    OPENROUTER_MODEL,
    ANTHROPIC_API_KEY,
    ANTHROPIC_BASE_URL,
    ANTHROPIC_MODEL,
    GEMINI_API_KEY,
    GEMINI_API_KEYS,
    GEMINI_MODEL,
    GROQ_API_KEY,
    GROQ_MODEL,
    FALLBACK_MODEL
)
from app.models import ChatResponse, CitationItem

logger = logging.getLogger("epiona.ai_service")

CLAUDIA_STYLE_SYSTEM_PROMPT = (
    "Anda adalah EPIONA Academic Research Assistant, asisten kecerdasan akademik untuk riset literatur dan analisis farmasi biomedis.\n\n"
    "IDENTITAS & PRINSIP SISTEM:\n"
    "- Nama: EPIONA Academic Research Assistant.\n"
    "- Pengembang: Dikembangkan oleh Arya Eki Nur Seputro sebagai platform riset literatur cerdas dengan isolasi konteks dokumen presisi tinggi dan penalaran ilmiah terstruktur.\n"
    "- Integritas Data: Berprinsip pada grounding literatur ilmiah (zero-hallucination) dengan sitasi 1:1 ke lembar fisik dokumen serta eksplorasi jurnal terverifikasi.\n\n"
    "STANDAR KOMUNIKASI AKADEMIK PROFESIONAL (PRESISI, ANALITIS & INVERTED PYRAMID):\n"
    "1. Langsung Ke Inti Jawaban (Inverted Pyramid): Kalimat PERTAMA respons harus langsung menjawab inti permasalahan secara tegas, presisi, dan solutif — seperti dosen senior atau peneliti yang menjawab pertanyaan mahasiswanya. "
    "DILARANG KERAS mengawali respons dengan salam atau filler seperti: \'Baik,\', \'Tentu,\', \'Halo,\', \'Berikut penjelasannya:\', \'Pertanyaan yang bagus!\', atau sejenisnya.\n"
    "2. Bahasa Akademik Profesional & Mengalir: Uraikan materi dengan nada yang hidup, berwibawa, dan berbobot. Bukan chatbot — melainkan pakar yang berpikir keras dan menuangkan analisis mendalam secara lugas. Gunakan peristilahan farmasi/sains yang presisi, serta analogi intuitif untuk konsep yang abstrak.\n"
    "3. Logika Analitis Terstruktur dengan Heading Markdown: Gunakan ### untuk sub-topik. Struktur ideal: (a) Jawaban inti langsung, (b) Mekanisme/Patofisiologi/Fondasi Teori (dengan heading ###), (c) Aplikasi Klinis atau Contoh Komputasi Nyata, (d) Implikasi Praktis/Catatan Penting. Gunakan paragraf analitis padat, bukan poin-poin dangkal.\n"
    "4. Tipografi Bersih: Sintaks Markdown standar. **Tebal** untuk istilah teknis pertama kali muncul. Gunakan - atau 1. hanya jika konten benar-benar paralel dan setara.\n"
    "5. Format Rumus & Notasi Sains (Wajib LaTeX):\n"
    "   - SEMUA rumus matematika, farmakokinetika, dosis, dan variabel kimia/fisika WAJIB LaTeX: $...$ untuk inline (contoh: $t_{1/2}$, $C_{max}$, $V_d$, $AUC$, $pH = pKa + \\\\log\\\\frac{[A^-]}{[HA]}$) dan $$...$$ untuk rumus blok.\n"
    "   - Jelaskan setiap variabel rumus secara runut (\u2018di mana $C_0$ adalah konsentrasi awal...\u2019).\n\n"
    "ATURAN GROUNDING RUJUKAN:\n"
    "1. JIKA ADA KONTEKS DOKUMEN MYLIBRARY: Jawab fokus pada topik, cantumkan [1], [2] secara inline setelah klaim yang merujuk dokumen spesifik. Sebutkan nama dokumen dalam kalimat (contoh: \'Berdasarkan Modul Farmakokinetika [1]...\' atau \'Sebagaimana diuraikan dalam materi Metode Numerik [2]...\'). Hubungkan lintas modul jika diperlukan.\n"
    "   Di akhir jawaban (setelah teks prosa selesai), tambahkan baris berikut PERSIS seperti ini:\n"
    "   CITATIONS_JSON:[{\"document_id\":\"id\",\"document_title\":\"judul\",\"page_number\":1,\"exact_quote\":\"kutipan\"}]\n"
    "2. JIKA PERTANYAAN KONSEPTUAL UMUM (tidak ada di dokumen): JAWAB SECARA TUNTAS. Jangan pernah menolak dengan kalimat kaku. Di akhir, tambahkan satu baris catatan: \n"
    "   *(Catatan: Penjelasan ini bersifat konseptual analitis tambahan di luar materi spesifik dokumen referensi.)*\n\n"
    "FORMAT OUTPUT WAJIB: PROSA AKADEMIK MARKDOWN MENGALIR.\n"
    "Tulis jawaban sebagai teks Markdown ilmiah mengalir — BUKAN JSON mentah. Respons harus dapat dibaca langsung tanpa parsing. "
    "Hanya tambahkan baris CITATIONS_JSON: di akhir jika ada sitasi dokumen. Tidak ada wrapper JSON di seluruh respons."
)

class AssistantAiService:
    def __init__(
        self,
        router_base_url: str = ROUTER_BASE_URL,
        router_api_key: str = ROUTER_API_KEY,
        router_model: str = ROUTER_MODEL,
        openrouter_api_key: str = OPENROUTER_API_KEY,
        openrouter_base_url: str = OPENROUTER_BASE_URL,
        openrouter_model: str = OPENROUTER_MODEL,
        anthropic_api_key: str = ANTHROPIC_API_KEY,
        anthropic_base_url: str = ANTHROPIC_BASE_URL,
        anthropic_model: str = ANTHROPIC_MODEL,
        gemini_api_key: str = GEMINI_API_KEY,
        gemini_api_keys: str = GEMINI_API_KEYS,
        gemini_model: str = GEMINI_MODEL,
        groq_api_key: str = GROQ_API_KEY,
        groq_model: str = GROQ_MODEL
    ):
        self.router_base_url = router_base_url.rstrip("/") if router_base_url else ""
        self.router_api_key = router_api_key or ""
        self.router_model = router_model or "gemini-1.5-flash"

        # OpenRouter Gateway
        self.openrouter_api_key = openrouter_api_key or ""
        self.openrouter_base_url = (openrouter_base_url or "https://openrouter.ai/api/v1").rstrip("/")
        self.openrouter_model = openrouter_model or "google/gemma-4-31b-it:free"

        # Anthropic Direct API / Proxy
        self.anthropic_api_key = anthropic_api_key or ""
        self.anthropic_base_url = (anthropic_base_url or "https://api.anthropic.com").rstrip("/")
        self.anthropic_model = anthropic_model or "claude-3-5-haiku-20241022"
        
        # Koleksi API Key Gemini (Multi-Key Pool)
        self.gemini_keys: List[str] = []
        if gemini_api_keys:
            self.gemini_keys = [k.strip() for k in gemini_api_keys.split(",") if k.strip()]
        if gemini_api_key and gemini_api_key.strip() not in self.gemini_keys:
            self.gemini_keys.insert(0, gemini_api_key.strip())
        self._current_key_idx = 0

        self.gemini_model = gemini_model or "gemini-2.0-flash"
        self.groq_api_key = groq_api_key or ""
        self.groq_model = groq_model or "llama-3.3-70b-versatile"
        self.groq_client = None
        self._init_groq()

    def _init_groq(self):
        if self.groq_api_key:
            try:
                from groq import Groq
                self.groq_client = Groq(api_key=self.groq_api_key)
            except Exception as e:
                logger.warning(f"Gagal inisialisasi Groq client: {e}")

    def update_keys(
        self,
        gemini_key: Optional[str] = None,
        gemini_model: Optional[str] = None,
        groq_key: Optional[str] = None,
        groq_model: Optional[str] = None,
        openrouter_key: Optional[str] = None,
        openrouter_model: Optional[str] = None,
        anthropic_key: Optional[str] = None,
        anthropic_model: Optional[str] = None,
        router_url: Optional[str] = None,
        router_key: Optional[str] = None,
        router_model: Optional[str] = None
    ):
        """Memperbarui konfigurasi API Key dan Model secara dinamis pada runtime."""
        if gemini_key is not None and gemini_key.strip():
            k = gemini_key.strip()
            if k not in self.gemini_keys:
                self.gemini_keys.insert(0, k)
        if gemini_model:
            self.gemini_model = gemini_model.strip()

        if groq_key is not None:
            self.groq_api_key = groq_key.strip()
            self._init_groq()
        if groq_model:
            self.groq_model = groq_model.strip()

        if openrouter_key is not None:
            self.openrouter_api_key = openrouter_key.strip()
        if openrouter_model:
            self.openrouter_model = openrouter_model.strip()

        if anthropic_key is not None:
            self.anthropic_api_key = anthropic_key.strip()
        if anthropic_model:
            self.anthropic_model = anthropic_model.strip()

        if router_url is not None:
            self.router_base_url = router_url.strip().rstrip("/")
        if router_key is not None:
            self.router_api_key = router_key.strip()
        if router_model:
            self.router_model = router_model.strip()

    @staticmethod
    def _extract_text_from_raw_openai(raw_text: str) -> str:
        """Ekstraksi teks bersih dari respon OpenAI-compatible (mendukung JSON utuh maupun SSE streaming)."""
        accumulated = ""
        if "data: " in raw_text:
            for line in raw_text.splitlines():
                line = line.strip()
                if line.startswith("data: ") and not line.endswith("[DONE]"):
                    chunk_json = line[6:].strip()
                    try:
                        chunk = json.loads(chunk_json)
                        delta = chunk.get("choices", [{}])[0].get("delta", {})
                        if "content" in delta and delta["content"]:
                            accumulated += delta["content"]
                    except Exception:
                        pass
        else:
            try:
                res_data = json.loads(raw_text)
                accumulated = res_data["choices"][0]["message"]["content"]
            except Exception:
                accumulated = raw_text
        return accumulated

    def get_status(self) -> Dict[str, Any]:
        """Status komprehensif seluruh engine AI terpasang."""
        is_router_on = self._is_router_alive()
        is_openrouter_on = bool(self.openrouter_api_key)
        is_anthropic_on = bool(self.anthropic_api_key)
        is_gemini_on = len(self.gemini_keys) > 0
        is_groq_on = bool(self.groq_client)

        if is_router_on:
            active_engine = f"9Router Gateway ({self.router_model})"
        elif is_openrouter_on:
            active_engine = f"OpenRouter ({self.openrouter_model})"
        elif is_anthropic_on:
            active_engine = f"Anthropic Claude ({self.anthropic_model})"
        elif is_gemini_on:
            active_engine = f"Google Gemini Pool ({self.gemini_model})"
        elif is_groq_on:
            active_engine = f"Groq LPU ({self.groq_model})"
        else:
            active_engine = "Sintesis Ilmiah Offline"

        return {
            "openrouter_active": is_openrouter_on,
            "openrouter_model": self.openrouter_model,
            "anthropic_active": is_anthropic_on,
            "anthropic_model": self.anthropic_model,
            "gemini_active": is_gemini_on,
            "gemini_keys_count": len(self.gemini_keys),
            "gemini_model": self.gemini_model,
            "groq_active": is_groq_on,
            "groq_model": self.groq_model,
            "router_available": is_router_on,
            "router_endpoint": self.router_base_url,
            "router_model": self.router_model,
            "active_engine": active_engine
        }

    def _is_router_alive(self) -> bool:
        """Cek apakah Local Router aktif berjalan di localhost."""
        if not self.router_base_url or not any(lh in self.router_base_url for lh in ["localhost", "127.0.0.1"]):
            return False
        try:
            req = urllib.request.Request(
                f"{self.router_base_url}/models",
                headers={"Authorization": f"Bearer {self.router_api_key}"}
            )
            with urllib.request.urlopen(req, timeout=1.5) as res:
                return res.status == 200
        except Exception:
            return False

    def get_router_models(self) -> List[str]:
        """Mengambil daftar model yang aktif dan siap pakai di 9Router."""
        if not self._is_router_alive():
            return []
        try:
            req = urllib.request.Request(
                f"{self.router_base_url}/models",
                headers={"Authorization": f"Bearer {self.router_api_key}"}
            )
            with urllib.request.urlopen(req, timeout=2.0) as res:
                data = json.loads(res.read().decode("utf-8"))
                return [m.get("id") for m in data.get("data", []) if m.get("id")]
        except Exception as e:
            logger.warning(f"Gagal mengambil daftar model dari 9Router: {e}")
            return []

    def answer_chat(
        self,
        question: str,
        user_docs: List[Dict[str, Any]],
        relevant_pages: List[Dict[str, Any]],
        chat_history: Optional[List[Dict[str, Any]]] = None,
        attachments: Optional[List[Dict[str, Any]]] = None,
        focused_document_title: Optional[str] = None,
        model_preference: Optional[str] = None
    ) -> ChatResponse:
        """
        Titik masuk utama cerdas untuk percakapan (Hybrid Conversational + Grounded RAG + Multimodal Attachments).
        Membedakan pertanyaan identitas/sapaan vs pertanyaan isi literatur/lampiran, dengan dukungan riwayat multi-turn.
        """
        q_lower = question.strip().lower()
        attachments = attachments or []
        image_attachments = [a for a in attachments if a.get("is_image") and a.get("base64_data")]
        doc_attachments = [a for a in attachments if not a.get("is_image") and a.get("extracted_text")]

        # 1. Deteksi Pertanyaan Identitas / Sapaan Umum (Hanya jika tidak ada lampiran berkas/gambar)
        from app.indexer import DocumentSearchIndex
        norm_q = DocumentSearchIndex.normalize_query(question).lower()

        is_creator_or_identity = (
            any(w in norm_q or w in q_lower for w in ["mencipta", "menciptkaan", "ciptakan", "pencipta", "pembuat", "siapa buat", "siapa bikin", "pengembang", "develop"])
            and any(p in norm_q or p in q_lower for p in ["kamu", "anda", "epiona", "sistem", "ai", "bot", "dirimu", "siapa"])
        ) or any(t in q_lower or t in norm_q for t in ["siapa kamu", "siapa anda", "identitas kamu", "kamu siapa", "perkenalkan dirimu", "apa nama sistem ini", "siapakah kamu", "siapa sih kamu"])

        conversational_triggers = [
            "siapa kamu", "siapa anda", "identitas kamu", "kamu siapa", "perkenalkan dirimu",
            "siapa yang menciptakan", "siapa menciptakan", "siapa yang menciptkaan", "siapa menciptkaan",
            "menciptkaan", "siapa yang membuat", "siapa membuat", "siapa pembuat",
            "siapa pencipta", "siapa penciptamu", "siapa pembuatmu", "siapa developermu", "siapa pengembang",
            "dibuat oleh siapa", "diciptakan oleh siapa", "siapa yang ciptakan",
            "siapa yang bikin", "siapa bikin", "siapa yang buat", "siapa buat",
            "pembuat kamu", "pencipta kamu", "perancang kamu",
            "tugas kamu apa", "apa tugas kamu", "bisa apa saja", "kamu bisa apa",
            "apa fungsi kamu", "apa yang bisa kamu lakukan", "kemampuan kamu", "kemampuanmu apa",
            "apa itu epiona", "halo", "hai", "selamat pagi", "selamat siang", "selamat malam",
            "apa kabar", "terima kasih", "makasih", "thanks", "ok", "oke", "sip", "mantap",
            "tujuannya apa", "tujuan kamu", "kenapa kamu dibuat",
            "jelaskan siapa", "ceritakan tentangmu", "siapakah kamu", "siapa sih kamu"
        ]
        is_conversational = (
            (is_creator_or_identity or any(trigger in q_lower or trigger in norm_q for trigger in conversational_triggers))
            and not attachments
        )

        # 1b. Jika mode library dan pengguna belum memiliki dokumen sama sekali, tolak dengan jelas
        if not user_docs and not is_conversational and not attachments:
            return ChatResponse(
                answer=(
                    "MyLibrary Anda masih kosong. Silakan unggah dokumen PDF modul atau buku farmasi Anda "
                    "terlebih dahulu ke MyLibrary untuk memulai diskusi berbasis literatur terverifikasi, "
                    "atau beralih ke mode Academic untuk mencari publikasi ilmiah internasional."
                ),
                citations=[]
            )

        # 2. Routing Prioritas Berdasarkan Preferensi Model Pilihan Pengguna
        pref = (model_preference or "").lower()
        prefer_claude = "claude" in pref or "sonnet" in pref or "anthropic" in pref
        prefer_gemini = "gemini" in pref

        if prefer_claude:
            # Pemeriksaan cepat: Jika kunci API Claude (Anthropic / OpenRouter) belum diisi di backend/.env
            if not self.anthropic_api_key and not self.openrouter_api_key:
                logger.info("Prefer Claude requested but neither ANTHROPIC_API_KEY nor OPENROUTER_API_KEY is configured.")
                notice_text = (
                    "### ⚠️ Kunci API Claude Belum Dikonfigurasi di Backend\n\n"
                    "Anda memilih model **Claude 3.5 Sonnet (Latest)**, namun `ANTHROPIC_API_KEY` maupun `OPENROUTER_API_KEY` "
                    "belum diisi pada berkas konfigurasi `backend/.env`.\n\n"
                    "Sistem merespon secara instan dan sengaja **tidak mengalihkan ke model cadangan lain** agar Anda mendapatkan transparansi penuh dan mengetahui bahwa respon bukan dari Claude asli.\n\n"
                    "**Langkah Aktivasi Claude Asli:**\n"
                    "1. Buat API Key di salah satu penyedia resmi:\n"
                    "   - **OpenRouter (Praktis)**: [openrouter.ai/keys](https://openrouter.ai/keys)\n"
                    "   - **Anthropic Console**: [console.anthropic.com](https://console.anthropic.com)\n"
                    "2. Buka berkas `backend/.env` di teks editor, lalu masukkan kunci Anda:\n"
                    "   ```env\n"
                    "   OPENROUTER_API_KEY=sk-or-v1-...\n"
                    "   # ATAU\n"
                    "   ANTHROPIC_API_KEY=sk-ant-...\n"
                    "   ```\n"
                    "3. Setelah disimpan, muat ulang backend dan kirim ulang pesan Anda.\n\n"
                    "> **Tips:** Untuk saat ini, Anda dapat beralih ke pilihan model **Gemini 2.0 Flash (Default)** di samping tombol Kirim untuk menikmati respon instan gratis tanpa memerlukan konfigurasi API tambahan."
                )
                return ChatResponse(
                    answer=notice_text,
                    citations=[],
                    is_error=True
                )

            # Jika salah satu API key Claude tersedia di sistem
            if self.anthropic_api_key:
                try:
                    return self._call_anthropic_direct(
                        question=question,
                        relevant_pages=relevant_pages if not is_conversational else [],
                        user_docs=user_docs,
                        chat_history=chat_history,
                        doc_attachments=doc_attachments,
                        image_attachments=image_attachments,
                        focused_document_title=focused_document_title
                    )
                except Exception as e:
                    logger.warning(f"Preferred Anthropic error: {e}. Mengalihkan ke OpenRouter jika tersedia.")

            if self.openrouter_api_key:
                claude_target_model = self.openrouter_model if "claude" in self.openrouter_model.lower() else "anthropic/claude-3.5-sonnet"
                try:
                    return self._call_openai_compatible(
                        endpoint=f"{self.openrouter_base_url}/chat/completions",
                        api_key=self.openrouter_api_key,
                        model=claude_target_model,
                        question=question,
                        relevant_pages=relevant_pages if not is_conversational else [],
                        user_docs=user_docs,
                        chat_history=chat_history,
                        doc_attachments=doc_attachments,
                        image_attachments=image_attachments,
                        focused_document_title=focused_document_title,
                        is_openrouter=True
                    )
                except Exception as e:
                    logger.warning(f"Preferred OpenRouter Claude error: {e}.")

            # Jika API key Claude telah diisi namun terjadi galat koneksi / saldo API habis
            return ChatResponse(
                answer=(
                    "### ⚠️ Gagal Menghubungi Penyedia Claude\n\n"
                    "Sistem telah mencoba menghubungi server Claude (Anthropic/OpenRouter), namun koneksi gagal atau saldo/kuota API pada akun penyedia Anda tidak mencukupi.\n\n"
                    "Silakan periksa saldo kredit akun penyedia API Anda, atau alihkan sementara pilihan model ke **Gemini 2.0 Flash (Default)** di menu samping tombol Kirim."
                ),
                citations=[],
                is_error=True
            )

        if prefer_gemini:
            # Jika user secara eksplisit memilih Gemini
            if self.gemini_keys:
                try:
                    return self._call_gemini_pool(
                        question=question,
                        relevant_pages=relevant_pages if not is_conversational else [],
                        user_docs=user_docs,
                        chat_history=chat_history,
                        doc_attachments=doc_attachments,
                        image_attachments=image_attachments,
                        focused_document_title=focused_document_title
                    )
                except Exception as e:
                    logger.warning(f"Preferred Gemini Pool error: {e}. Mengalihkan ke 9Router lokal.")

        # 3. Prioritas Default (9Router AI Gateway / OpenRouter / Anthropic / Gemini / Groq)
        if self._is_router_alive():
            router_models_to_try = [self.router_model, "gemini/gemini-3.7-flash", "gemini/gemini-3.6-flash"]
            # Deduplikasi urutan model
            seen_models = set()
            unique_models = []
            for m in router_models_to_try:
                if m and m not in seen_models:
                    seen_models.add(m)
                    unique_models.append(m)

            for r_model in unique_models:
                try:
                    return self._call_openai_compatible(
                        endpoint=f"{self.router_base_url}/chat/completions",
                        api_key=self.router_api_key,
                        model=r_model,
                        question=question,
                        relevant_pages=relevant_pages if not is_conversational else [],
                        user_docs=user_docs,
                        chat_history=chat_history,
                        doc_attachments=doc_attachments,
                        image_attachments=image_attachments,
                        focused_document_title=focused_document_title,
                        is_openrouter=False
                    )
                except Exception as e:
                    logger.warning(f"9Router ({r_model}) error: {e}. Mencoba alternatif...")

        if self.openrouter_api_key:
            try:
                return self._call_openai_compatible(
                    endpoint=f"{self.openrouter_base_url}/chat/completions",
                    api_key=self.openrouter_api_key,
                    model=self.openrouter_model,
                    question=question,
                    relevant_pages=relevant_pages if not is_conversational else [],
                    user_docs=user_docs,
                    chat_history=chat_history,
                    doc_attachments=doc_attachments,
                    image_attachments=image_attachments,
                    focused_document_title=focused_document_title,
                    is_openrouter=True
                )
            except Exception as e:
                logger.warning(f"OpenRouter error: {e}. Mengalihkan ke provider berikutnya.")

        if self.anthropic_api_key:
            try:
                return self._call_anthropic_direct(
                    question=question,
                    relevant_pages=relevant_pages if not is_conversational else [],
                    user_docs=user_docs,
                    chat_history=chat_history,
                    doc_attachments=doc_attachments,
                    image_attachments=image_attachments,
                    focused_document_title=focused_document_title
                )
            except Exception as e:
                logger.warning(f"Anthropic error: {e}. Mengalihkan ke provider berikutnya.")

        if self.gemini_keys:
            try:
                return self._call_gemini_pool(
                    question=question,
                    relevant_pages=relevant_pages if not is_conversational else [],
                    user_docs=user_docs,
                    chat_history=chat_history,
                    doc_attachments=doc_attachments,
                    image_attachments=image_attachments,
                    focused_document_title=focused_document_title
                )
            except Exception as e:
                logger.warning(f"Gemini Pool error: {e}. Mengalihkan ke Groq.")

        if self.groq_client:
            try:
                return self._call_groq(
                    question=question,
                    relevant_pages=relevant_pages if not is_conversational else [],
                    user_docs=user_docs,
                    chat_history=chat_history,
                    doc_attachments=doc_attachments,
                    focused_document_title=focused_document_title
                )
            except Exception as e:
                logger.warning(f"Groq error: {e}. Mengalihkan ke sintesis lokal.")

        # 7. Fallback lokal cerdas jika offline / tanpa API key
        return self._local_smart_synthesis(
            question=question,
            relevant_pages=relevant_pages,
            user_docs=user_docs,
            is_conversational=is_conversational,
            doc_attachments=doc_attachments,
            image_attachments=image_attachments,
            focused_document_title=focused_document_title
        )

    def _call_openai_compatible(
        self,
        endpoint: str,
        api_key: str,
        model: str,
        question: str,
        relevant_pages: List[Dict[str, Any]],
        user_docs: List[Dict[str, Any]],
        chat_history: Optional[List[Dict[str, Any]]] = None,
        doc_attachments: Optional[List[Dict[str, Any]]] = None,
        image_attachments: Optional[List[Dict[str, Any]]] = None,
        focused_document_title: Optional[str] = None,
        is_openrouter: bool = False
    ) -> ChatResponse:
        context_parts = []
        if doc_attachments:
            for da in doc_attachments:
                fname = da.get("filename", "Dokumen Lampiran")
                txt = da.get("extracted_text", "").strip()[:8000]
                if txt:
                    context_parts.append(f"--- DOKUMEN LAMPIRAN PENGGUNA ({fname}) ---\n{txt}")

        if relevant_pages:
            context_str = self._format_context(relevant_pages, user_docs)
            context_parts.append(f"--- KONTEKS DOKUMEN MYLIBRARY ---\n{context_str}")
        elif focused_document_title:
            context_parts.append(
                f"--- KONTEKS SESI AKTIF PENGGUNA ---\n"
                f"Pengguna sedang membuka/fokus pada dokumen: '{focused_document_title}'.\n"
                f"Pertanyaan saat ini mungkin tidak terdapat di modul tersebut. Jelaskan konsepnya secara komprehensif, presisi, dan profesional. "
                f"Di akhir penjelasan, sampaikan catatan objektif bahwa topik ini merupakan penjelasan konseptual tambahan di luar materi spesifik modul '{focused_document_title}'."
            )

        if context_parts:
            full_context = "\n\n".join(context_parts)
            user_prompt = f"KONTEKS RUJUKAN:\n{full_context}\n\nPERTANYAAN PENGGUNA:\n{question}"
        else:
            user_prompt = question

        messages_payload = [{"role": "system", "content": CLAUDIA_STYLE_SYSTEM_PROMPT}]

        # Sisipkan riwayat percakapan sebelumnya jika ada
        if chat_history:
            for h in chat_history:
                sender_role = "user" if h.get("sender") == "user" else "assistant"
                h_text = h.get("text", "")
                if h_text and len(h_text.strip()) > 0:
                    messages_payload.append({"role": sender_role, "content": h_text})

        # Pesan pengguna saat ini (dukungan visual multimodal)
        if image_attachments:
            user_content = []
            for img in image_attachments:
                mime = img.get("mime_type", "image/png")
                b64 = img.get("base64_data", "")
                if b64:
                    user_content.append({
                        "type": "image_url",
                        "image_url": {"url": f"data:{mime};base64,{b64}"}
                    })
            user_content.append({"type": "text", "text": user_prompt})
            messages_payload.append({"role": "user", "content": user_content})
        else:
            messages_payload.append({"role": "user", "content": user_prompt})

        req_headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}"
        }
        if is_openrouter or "openrouter" in endpoint:
            req_headers["HTTP-Referer"] = "https://epiona.academic.id"
            req_headers["X-Title"] = "EPIONA Academic Research Assistant"

        payload = {
            "model": model,
            "messages": messages_payload,
            "temperature": 0.75 if (not relevant_pages and not doc_attachments) else 0.4,
            "max_tokens": 3500
        }

        # Coba panggil dengan response_format; jika model tidak support (HTTP 400), retry tanpa parameter itu
        raw_resp = ""
        try:
            req = urllib.request.Request(
                endpoint,
                data=json.dumps(payload).encode("utf-8"),
                headers=req_headers,
                method="POST"
            )
            with urllib.request.urlopen(req, timeout=35) as resp:
                raw_resp = resp.read().decode("utf-8")
        except urllib.error.HTTPError as err:
            if err.code == 400:
                payload.pop("response_format", None)
                req_retry = urllib.request.Request(
                    endpoint,
                    data=json.dumps(payload).encode("utf-8"),
                    headers=req_headers,
                    method="POST"
                )
                with urllib.request.urlopen(req_retry, timeout=35) as resp_retry:
                    raw_resp = resp_retry.read().decode("utf-8")
            else:
                raise err

        accumulated_text = self._extract_text_from_raw_openai(raw_resp)

        data = self._safe_parse_json(accumulated_text)
        return self._build_chat_response(data, relevant_pages)

    def _call_anthropic_direct(
        self,
        question: str,
        relevant_pages: List[Dict[str, Any]],
        user_docs: List[Dict[str, Any]],
        chat_history: Optional[List[Dict[str, Any]]] = None,
        doc_attachments: Optional[List[Dict[str, Any]]] = None,
        image_attachments: Optional[List[Dict[str, Any]]] = None,
        focused_document_title: Optional[str] = None
    ) -> ChatResponse:
        """Memanggil Anthropic Claude Messages API resmi."""
        context_parts = []
        if doc_attachments:
            for da in doc_attachments:
                fname = da.get("filename", "Dokumen Lampiran")
                txt = da.get("extracted_text", "").strip()[:8000]
                if txt:
                    context_parts.append(f"--- DOKUMEN LAMPIRAN PENGGUNA ({fname}) ---\n{txt}")

        if relevant_pages:
            context_str = self._format_context(relevant_pages, user_docs)
            context_parts.append(f"--- KONTEKS DOKUMEN MYLIBRARY ---\n{context_str}")
        elif focused_document_title:
            context_parts.append(
                f"--- KONTEKS SESI AKTIF PENGGUNA ---\n"
                f"Pengguna sedang membuka/fokus pada dokumen: '{focused_document_title}'.\n"
                f"Pertanyaan saat ini mungkin tidak terdapat di modul tersebut. Jelaskan konsepnya secara komprehensif, presisi, dan profesional. "
                f"Di akhir penjelasan, sampaikan catatan objektif bahwa topik ini merupakan penjelasan konseptual tambahan di luar materi spesifik modul '{focused_document_title}'."
            )

        if context_parts:
            full_context = "\n\n".join(context_parts)
            user_prompt = f"KONTEKS RUJUKAN:\n{full_context}\n\nPERTANYAAN PENGGUNA:\n{question}"
        else:
            user_prompt = question

        messages = []
        if chat_history:
            for h in chat_history:
                sender_role = "user" if h.get("sender") == "user" else "assistant"
                h_text = h.get("text", "")
                if h_text and len(h_text.strip()) > 0:
                    messages.append({"role": sender_role, "content": h_text})

        user_content_items = []
        if image_attachments:
            for img in image_attachments:
                mime = img.get("mime_type", "image/png")
                b64 = img.get("base64_data", "")
                if b64:
                    user_content_items.append({
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": mime,
                            "data": b64
                        }
                    })
        user_content_items.append({"type": "text", "text": user_prompt})
        messages.append({"role": "user", "content": user_content_items})

        payload = {
            "model": self.anthropic_model,
            "max_tokens": 3000,
            "system": CLAUDIA_STYLE_SYSTEM_PROMPT,
            "messages": messages,
            "temperature": 0.7 if (not relevant_pages and not doc_attachments) else 0.35
        }

        endpoint = f"{self.anthropic_base_url}/v1/messages"
        req = urllib.request.Request(
            endpoint,
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "x-api-key": self.anthropic_api_key,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json"
            },
            method="POST"
        )

        with urllib.request.urlopen(req, timeout=35) as resp:
            resp_body = resp.read().decode("utf-8")
        anthropic_data = json.loads(resp_body)
        raw_text = anthropic_data["content"][0]["text"]
        data = self._safe_parse_json(raw_text)
        return self._build_chat_response(data, relevant_pages)

    def _call_gemini_pool(
        self,
        question: str,
        relevant_pages: List[Dict[str, Any]],
        user_docs: List[Dict[str, Any]],
        chat_history: Optional[List[Dict[str, Any]]] = None,
        doc_attachments: Optional[List[Dict[str, Any]]] = None,
        image_attachments: Optional[List[Dict[str, Any]]] = None,
        focused_document_title: Optional[str] = None
    ) -> ChatResponse:
        """Memanggil Google Gemini dengan rotasi multi-key jika terjadi HTTP 429, lengkap dengan multimodal vision & document grounding."""
        if not self.gemini_keys:
            raise RuntimeError("Tidak ada Gemini API Key yang terdaftar.")

        context_parts = []
        if doc_attachments:
            for da in doc_attachments:
                fname = da.get("filename", "Dokumen Lampiran")
                txt = da.get("extracted_text", "").strip()[:8000]
                if txt:
                    context_parts.append(f"--- DOKUMEN LAMPIRAN PENGGUNA ({fname}) ---\n{txt}")

        if relevant_pages:
            context_str = self._format_context(relevant_pages, user_docs)
            context_parts.append(f"--- KONTEKS DOKUMEN MYLIBRARY ---\n{context_str}")
        elif focused_document_title:
            context_parts.append(
                f"--- KONTEKS SESI AKTIF PENGGUNA ---\n"
                f"Pengguna sedang membuka/fokus pada dokumen: '{focused_document_title}'.\n"
                f"Pertanyaan saat ini mungkin tidak terdapat di modul tersebut. Jelaskan konsepnya secara komprehensif, presisi, dan profesional. "
                f"Di akhir penjelasan, sampaikan catatan objektif bahwa topik ini merupakan penjelasan konseptual tambahan di luar materi spesifik modul '{focused_document_title}'."
            )

        if context_parts:
            full_context = "\n\n".join(context_parts)
            user_prompt = f"KONTEKS RUJUKAN:\n{full_context}\n\nPERTANYAAN PENGGUNA:\n{question}"
        else:
            user_prompt = question

        contents_payload = []
        if chat_history:
            for h in chat_history:
                role = "user" if h.get("sender") == "user" else "model"
                h_text = h.get("text", "")
                if h_text and len(h_text.strip()) > 0:
                    contents_payload.append({
                        "role": role,
                        "parts": [{"text": h_text}]
                    })

        user_parts = []
        if image_attachments:
            for img in image_attachments:
                mime = img.get("mime_type", "image/png")
                b64 = img.get("base64_data", "")
                if b64:
                    user_parts.append({
                        "inline_data": {
                            "mime_type": mime,
                            "data": b64
                        }
                    })
        user_parts.append({"text": user_prompt})
        contents_payload.append({
            "role": "user",
            "parts": user_parts
        })

        payload = {
            "system_instruction": {
                "parts": [{"text": CLAUDIA_STYLE_SYSTEM_PROMPT}]
            },
            "contents": contents_payload,
            "generationConfig": {
                "temperature": 0.75 if (not relevant_pages and not doc_attachments) else 0.4,
                "maxOutputTokens": 3500
            }
        }
        req_data = json.dumps(payload).encode("utf-8")

        # Coba setiap key dalam pool
        attempts = len(self.gemini_keys)
        for _ in range(attempts):
            active_key = self.gemini_keys[self._current_key_idx]
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{self.gemini_model}:generateContent?key={active_key}"
            req = urllib.request.Request(
                url,
                data=req_data,
                headers={"Content-Type": "application/json"},
                method="POST"
            )

            try:
                with urllib.request.urlopen(req, timeout=30) as resp:
                    res_body = resp.read().decode("utf-8")
                    gemini_res = json.loads(res_body)

                raw_text = gemini_res["candidates"][0]["content"]["parts"][0]["text"]
                data = self._safe_parse_json(raw_text)
                return self._build_chat_response(data, relevant_pages)

            except urllib.error.HTTPError as err:
                if err.code in (429, 403):
                    logger.warning(f"Gemini Key index {self._current_key_idx} terkena limit ({err.code}). Rotasi ke key berikutnya...")
                    self._current_key_idx = (self._current_key_idx + 1) % len(self.gemini_keys)
                    continue
                raise err

        raise RuntimeError("Semua Gemini API Key di dalam pool mengalami limit kuota.")

    def _call_groq(
        self,
        question: str,
        relevant_pages: List[Dict[str, Any]],
        user_docs: List[Dict[str, Any]],
        chat_history: Optional[List[Dict[str, Any]]] = None,
        doc_attachments: Optional[List[Dict[str, Any]]] = None,
        focused_document_title: Optional[str] = None
    ) -> ChatResponse:
        """Memanggil Groq LPU dengan multi-turn chat history dan dokumen lampiran."""
        context_parts = []
        if doc_attachments:
            for da in doc_attachments:
                fname = da.get("filename", "Dokumen Lampiran")
                txt = da.get("extracted_text", "").strip()[:8000]
                if txt:
                    context_parts.append(f"--- DOKUMEN LAMPIRAN PENGGUNA ({fname}) ---\n{txt}")

        if relevant_pages:
            context_str = self._format_context(relevant_pages, user_docs)
            context_parts.append(f"--- KONTEKS DOKUMEN MYLIBRARY ---\n{context_str}")
        elif focused_document_title:
            context_parts.append(
                f"--- KONTEKS SESI AKTIF PENGGUNA ---\n"
                f"Pengguna sedang membuka/fokus pada dokumen: '{focused_document_title}'.\n"
                f"Pertanyaan saat ini mungkin tidak terdapat di modul tersebut. Jelaskan konsepnya secara komprehensif, presisi, dan profesional. "
                f"Di akhir penjelasan, sampaikan catatan objektif bahwa topik ini merupakan penjelasan konseptual tambahan di luar materi spesifik modul '{focused_document_title}'."
            )

        if context_parts:
            full_context = "\n\n".join(context_parts)
            user_prompt = f"KONTEKS RUJUKAN:\n{full_context}\n\nPERTANYAAN PENGGUNA:\n{question}"
        else:
            user_prompt = question

        messages = [{"role": "system", "content": CLAUDIA_STYLE_SYSTEM_PROMPT}]
        if chat_history:
            for h in chat_history:
                sender_role = "user" if h.get("sender") == "user" else "assistant"
                h_text = h.get("text", "")
                if h_text and len(h_text.strip()) > 0:
                    messages.append({"role": sender_role, "content": h_text})

        messages.append({"role": "user", "content": user_prompt})

        chat_completion = self.groq_client.chat.completions.create(
            messages=messages,
            model=self.groq_model,
            temperature=0.75 if (not relevant_pages and not doc_attachments) else 0.4,
            max_tokens=3000
        )
        data = self._safe_parse_json(chat_completion.choices[0].message.content)
        return self._build_chat_response(data, relevant_pages)

    def _format_context(self, relevant_pages: List[Dict[str, Any]], user_docs: List[Dict[str, Any]]) -> str:
        """Menyusun teks konteks untuk disuntikkan ke prompt LLM."""
        if relevant_pages:
            blocks = []
            for idx, p in enumerate(relevant_pages, start=1):
                doc_id = p.get("document_id")
                title = p.get("document_title")
                page_no = p.get("page_number")
                snippet = p.get("text", "")[:3500]
                blocks.append(f"--- RUJUKAN [{idx}]: {title} (ID: {doc_id}) | HALAMAN: {page_no} ---\n{snippet}\n")
            return "\n".join(blocks)
        elif user_docs:
            doc_titles = [f"- {d.get('title')} ({d.get('total_pages', 1)} Halaman)" for d in user_docs]
            return "Daftar Dokumen yang Tersedia di MyLibrary Pengguna:\n" + "\n".join(doc_titles)
        else:
            return "MyLibrary pengguna saat ini masih kosong."

    def _safe_parse_json(self, raw_text: str) -> Dict[str, Any]:
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
        return {"answer": prose_text, "citations": citations}

    def _build_chat_response(self, data: Dict[str, Any], relevant_pages: List[Dict[str, Any]]) -> ChatResponse:
        citations = []
        raw_cits = data.get("citations", [])
        if isinstance(raw_cits, list):
            for c in raw_cits:
                quote = c.get("exact_quote", "").strip()
                if not quote:
                    continue

                default_doc_id = relevant_pages[0]["document_id"] if relevant_pages else c.get("document_id", "")
                default_title = relevant_pages[0]["document_title"] if relevant_pages else c.get("document_title", "Dokumen Referensi")
                default_page = relevant_pages[0]["page_number"] if relevant_pages else c.get("page_number", 1)

                # Verifikasi verbatim terhadap teks asli pada passage yang relevan
                is_verified = False
                clean_quote = " ".join(quote.split()).lower()
                if relevant_pages:
                    for p in relevant_pages:
                        p_text = " ".join(p.get("text", "").split()).lower()
                        if clean_quote in p_text or quote.lower() in p.get("text", "").lower():
                            is_verified = True
                            break
                else:
                    is_verified = True

                final_quote = quote if is_verified else f"[Tidak terverifikasi] {quote}"

                citations.append(CitationItem(
                    document_id=c.get("document_id", default_doc_id),
                    document_title=c.get("document_title", default_title),
                    page_number=int(c.get("page_number", default_page)),
                    exact_quote=final_quote,
                    is_verbatim=is_verified
                ))

        answer_text = data.get("answer", "Penjelasan berhasil disusun.")
        if citations and not any(f"[{i+1}]" in answer_text for i in range(len(citations))):
            citations = []

        return ChatResponse(
            answer=answer_text,
            citations=citations
        )

    def _local_smart_synthesis(
        self,
        question: str,
        relevant_pages: List[Dict[str, Any]],
        user_docs: List[Dict[str, Any]],
        is_conversational: bool,
        doc_attachments: Optional[List[Dict[str, Any]]] = None,
        image_attachments: Optional[List[Dict[str, Any]]] = None,
        focused_document_title: Optional[str] = None
    ) -> ChatResponse:
        """Sintesis deterministik lokal berkarakter Claudia ketika model eksternal offline."""
        # 1. Jika pengguna melampirkan berkas dokumen
        if doc_attachments:
            first_doc = doc_attachments[0]
            fname = first_doc.get("filename", "Dokumen Lampiran")
            raw_text = first_doc.get("extracted_text", "")
            lines = [l.strip() for l in raw_text.split("\n") if len(l.strip()) > 15][:6]
            bullet_points = "\n- ".join(lines) if lines else "Teks dokumen berhasil dibaca dan dianalisis."
            return ChatResponse(
                answer=(
                    f"Telah memeriksa berkas lampiran **{fname}**.\n\n"
                    f"**Ringkasan Teks Lampiran:**\n- {bullet_points}\n\n"
                    f"Berdasarkan materi yang dilampirkan, sistem telah mengekstrak konten tersebut untuk menjawab: *\"{question}\"*."
                ),
                citations=[]
            )

        # 2. Jika pengguna melampirkan gambar
        if image_attachments:
            img_names = ", ".join([img.get("filename", "Gambar") for img in image_attachments])
            return ChatResponse(
                answer=(
                    f"Lampiran gambar **{img_names}** telah diterima dan diproses.\n\n"
                    "Untuk analisis multimodal visual lengkap dengan pengenalan kurva, teks, dan struktur sediaan farmasi, pastikan Gemini API Key aktif di pengaturan sistem."
                ),
                citations=[]
            )

        # 3. Tangani pertanyaan percakapan, identitas, atau jika tidak ada dokumen spesifik yang cocok
        if not user_docs and not is_conversational and not doc_attachments and not image_attachments:
            return ChatResponse(
                answer="MyLibrary Anda masih kosong. Silakan unggah dokumen PDF modul atau buku farmasi Anda terlebih dahulu ke MyLibrary untuk memulai diskusi berbasis literatur terverifikasi.",
                citations=[]
            )

        if is_conversational or not relevant_pages:
            reasoned_answer = self._reason_open_domain_answer(question, user_docs)
            if focused_document_title and not is_conversational:
                reasoned_answer += f"\n\n*(Catatan: Rincian ini merupakan penjelasan konseptual analitis tambahan, karena materi tersebut tidak diuraikan secara spesifik dalam modul **{focused_document_title}** yang sedang Anda buka.)*"
            return ChatResponse(
                answer=reasoned_answer,
                citations=[]
            )

        top_page = relevant_pages[0]
        text = top_page.get("text", "")
        doc_title = top_page.get("document_title", "Dokumen")
        page_num = top_page.get("page_number", 1)
        q_lower = question.lower()

        # Cek apakah pengguna meminta gambar / visual
        is_visual = any(w in q_lower for w in ["gambar", "diagram", "grafik", "kurva", "bagan", "tabel", "skema", "figure", "plot", "foto"])

        # Bersihkan baris teks halaman dari noise
        clean_lines = [l.strip() for l in text.split("\n") if l.strip() and not l.strip().isdigit()]
        meaningful_lines = [l for l in clean_lines if len(l) > 10 and not l.lower().startswith("halaman") and not l.lower().startswith("page")]
        exact_quote = meaningful_lines[0] if meaningful_lines else (clean_lines[0] if clean_lines else text[:120])

        # Kumpulkan seluruh teks relevan dari pages yang ditemukan untuk sintesis menyeluruh
        collected_insights = []
        for p in relevant_pages[:4]:
            p_text = p.get("text", "")
            p_lines = [l.strip() for l in p_text.split("\n") if len(l.strip()) > 15 and not l.strip().isdigit()]
            for pl in p_lines[:5]:
                if pl not in collected_insights:
                    collected_insights.append(pl)

        # Bangun sintesis terstruktur akademis
        # 1. Deteksi domain materi khusus (Komputasi Numerik, Metode Titik Tetap, Newton Raphson, dll.)
        is_fixed_point_page = any("titik" in l.lower() or "g(x)" in l.lower() or "iterasi" in l.lower() or "akar" in l.lower() for l in meaningful_lines)
        
        if is_fixed_point_page and any(k in q_lower for k in ["titik", "fixed", "iterasi", "metode", "akar", "bagaimana", "caranya"]):
            answer_text = (
                f"Berdasarkan materi literatur **{doc_title}** (Halaman {page_num}) [1]:\n\n"
                f"### 1. Definisi & Konsep Fundamental\n"
                f"**Metode Iterasi Satu Titik (Fixed Point Iteration)** adalah metode komputasi numerik golongan *metode terbuka* untuk menentukan akar persamaan non-linier $f(x) = 0$. "
                f"Prinsip intinya adalah memanipulasi bentuk persamaan secara aljabar menjadi relasi rekursif titik tetap:\n\n"
                f"$$x = g(x)$$\n\n"
                f"Nilai tebakan awal $x_0$ digunakan untuk menghasilkan barisan hampiran solusi melalui persamaan iterasi:\n\n"
                f"$$x_{{i+1}} = g(x_i)$$\n\n"
                f"### 2. Syarat Mutlak Konvergensi\n"
                f"Bentuk $g(x)$ tidak bersifat tunggal. Agar proses iterasi bergerak konvergen mendekati akar sejati (bukan divergen atau menjauhi solusi), fungsi $g(x)$ wajib memenuhi kriteria turunan pertama:\n\n"
                f"$$|g'(x)| < 1$$\n\n"
                f"pada interval di sekitar akar yang dicari.\n\n"
                f"### 3. Langkah Operasional Algoritma\n"
                f"1. **Formulasi Ulang**: Ubah $f(x) = 0$ menjadi bentuk $x = g(x)$ yang memenuhi $|g'(x)| < 1$.\n"
                f"2. **Inisialisasi**: Tetapkan satu nilai tebakan awal $x_0$ serta batas toleransi galat $\\epsilon$ (misalnya $|f(x)| < 10^{{-3}}$).\n"
                f"3. **Iterasi Rekursif**: Hitung $x_{{i+1}} = g(x_i)$ secara bertahap.\n"
                f"4. **Kriteria Berhenti**: Hentikan iterasi jika $|x_{{i+1}} - x_i| < \\epsilon$ atau $|f(x_{{i+1}})| < \\epsilon$.\n\n"
                f"### 4. Contoh Komputasi Nyata\n"
                f"Diberikan persamaan $f(x) = x^2 - 2x - 3 = 0$.\n"
                f"- Ditransformasikan menjadi $x = \\sqrt{{2x + 3}} = g(x)$.\n"
                f"- Turunannya: $g'(x) = \\frac{{1}}{{\\sqrt{{2x + 3}}}}$. Untuk tebakan awal $x_0 = 4$, $|g'(4)| = \\frac{{1}}{{\\sqrt{{11}}}} \\approx 0.3015 < 1$ (terbukti konvergen).\n"
                f"- Iterasi 1: $x_1 = \\sqrt{{2(4) + 3}} = \\sqrt{{11}} \\approx 3.3166$\n"
                f"- Iterasi 2: $x_2 = \\sqrt{{2(3.3166) + 3}} = \\sqrt{{9.6332}} \\approx 3.1037$\n"
                f"- Barisan iterasi akan berkonvergensi ke akar sejati $x^* = 3$."
            )
        else:
            # Sintesis terstruktur umum berbasis teks naskah
            points_formatted = "\n".join([f"- {item}" for item in collected_insights[:5]])
            answer_text = (
                f"Berdasarkan rujukan literatur **{doc_title}** (Halaman {page_num}) [1]:\n\n"
                f"### 1. Poin Intisari Materi\n"
                f"{points_formatted}\n\n"
                f"### 2. Elaborasi Konseptual\n"
                f"> {exact_quote}\n\n"
                f"Prinsip ini menjabarkan konsep secara sistematis sesuai pembahasan kurikulum pada lembar modul. "
                f"Kutipan dan diagram lengkap dapat Anda periksa langsung pada lembar fisik dokumen di panel sebelah kanan [1]."
            )

        if is_visual:
            answer_text += (
                f"\n\n*Catatan Visual: Potongan diagram, kurva, atau tabel yang terlampir pada lembar dokumen ini "
                f"disajikan di bawah respons untuk mempermudah telaah visual.*"
            )

        citations_list = [
            CitationItem(
                document_id=top_page.get("document_id"),
                document_title=doc_title,
                page_number=page_num,
                exact_quote=exact_quote
            )
        ]

        # Tambahkan sitasi kedua jika ada halaman pendukung lain yang relevan
        if len(relevant_pages) > 1 and relevant_pages[1].get("page_number") != page_num:
            p2 = relevant_pages[1]
            p2_lines = [l.strip() for l in p2.get("text", "").split("\n") if len(l.strip()) > 10]
            citations_list.append(
                CitationItem(
                    document_id=p2.get("document_id"),
                    document_title=p2.get("document_title", doc_title),
                    page_number=p2.get("page_number", page_num + 1),
                    exact_quote=p2_lines[0] if p2_lines else "Materi pendukung lanjutan pada lembar dokumen."
                )
            )

        return ChatResponse(
            answer=answer_text,
            citations=citations_list
        )

    def _reason_open_domain_answer(self, question: str, user_docs: List[Dict[str, Any]]) -> str:
        """Penalaran cerdas terbuka untuk identitas, pembuat, kapabilitas, sains, dan matematika."""
        q = question.lower().strip()

        # 1. Pertanyaan Pembuat / Developer / Pencipta
        creator_words = [
            "mencipta", "menciptkaan", "ciptakan", "pencipta", "pembuat", "membuat", 
            "develop", "siapa yang buat", "siapa yang bikin", "pembuat kamu", "pencipta kamu", 
            "siapa yang ngembangin", "pengembang", "siapa pembuatmu"
        ]
        if any(w in q for w in creator_words):
            return (
                "Saya diciptakan dan dikembangkan oleh **Arya Eki Nur Seputro** sebagai asisten riset dan akademik cerdas dalam platform **EPIONA Assistant**.\n\n"
                "Sistem ini dirancang khusus untuk memfasilitasi penelusuran literatur ilmiah presisi tinggi, analisis dokumen farmasi dan sains, serta sintesis materi pembelajaran secara terverifikasi."
            )

        # 2. Pertanyaan Identitas Diri & Peran
        identity_words = ["siapa kamu", "siapa dirimu", "kamu siapa", "nama kamu", "namamu", "apa nama sistem ini", "kamu ai apa"]
        if any(w in q for w in identity_words):
            return (
                "Saya adalah **EPIONA Assistant**, platform asisten kecerdasan buatan untuk riset akademik, analisis literatur ilmiah, dan studi farmasi/sains yang dikembangkan oleh **Arya Eki Nur Seputro**.\n\n"
                "Fokus utama saya adalah memberikan jawaban berbasis rujukan ilmiah yang terverifikasi (zero-hallucination) dengan sitasi 1:1 langsung ke lembar dokumen, sekaligus membantu penalaran konsep sains dan matematika secara terstruktur."
            )

        # 3. Pertanyaan Tugas & Kemampuan
        task_words = ["tugas kamu", "fungsi kamu", "apa yang bisa kamu lakukan", "bisa apa saja", "fitur kamu", "kelebihan kamu", "kemampuan kamu", "tugasmu"]
        if any(w in q for w in task_words):
            return (
                "Sebagai asisten riset dan pembelajaran cerdas, tugas utama saya meliputi:\n\n"
                "1. **Analisis Literatur MyLibrary (Zero-Hallucination)**: Membedah dokumen PDF Anda dan menyajikan jawaban lengkap dengan rujukan sitasi presisi halaman 1:1.\n"
                "2. **Web Academic Explorer**: Menjelajah jurnal ilmiah global (PubMed, arXiv, Crossref) untuk memperkaya literatur terkini.\n"
                "3. **Multimodal Document Reader**: Mengekstrak teks, membaca diagram/bagan, serta menganalisis visual materi dan sediaan.\n"
                "4. **Penalaran Sains & Komputasi**: Menjelaskan konsep matematika, komputasi numerik, kimia, farmakologi, dan sains umum secara luwes dan terstruktur.\n"
                "5. **Manajemen Dokumen Terstruktur**: Mengorganisasi inventaris koleksi riset Anda secara efisien."
            )

        # 4. Pertanyaan Salam & Pembuka Percakapan
        greetings = ["halo", "hai", "hello", "hi", "selamat pagi", "selamat siang", "selamat sore", "selamat malam", "assalamu'alaikum", "assalamualaikum", "pagi", "siang", "sore", "malam"]
        if any(q == g or q.startswith(f"{g} ") or q.endswith(f" {g}") for g in greetings):
            return (
                "Halo! Saya **EPIONA Assistant**, siap membantu Anda menganalisis literatur dokumen, menelusuri jurnal ilmiah, atau mendiskusikan materi riset dan sains Anda. Ada topik atau dokumen yang ingin kita bedah bersama?"
            )

        # 5. Konsep Sains / Numerik / Farmasi Spesifik (Domain Expertise)
        if any(k in q for k in ["1 titik", "satu titik", "titik tetap", "fixed point"]):
            return (
                "### 1. Definisi & Konsep Fundamental\n"
                "**Metode Iterasi Satu Titik (Fixed Point Iteration)** atau metode titik tetap adalah algoritma komputasi numerik golongan *metode terbuka* untuk mencari akar persamaan non-linier $f(x) = 0$. "
                "Prinsip dasarnya adalah mentransformasikan persamaan $f(x) = 0$ secara aljabar menjadi relasi rekursif:\n\n"
                "$$x = g(x)$$\n\n"
                "Dari sebuah tebakan awal $x_0$, nilai pendekatan akar dihitung berulang kali melalui formula iterasi:\n\n"
                "$$x_{i+1} = g(x_i)$$\n\n"
                "### 2. Syarat Mutlak Konvergensi\n"
                "Suatu persamaan $f(x) = 0$ dapat diubah menjadi beberapa variasi bentuk $g(x)$. Namun, tidak semua bentuk $g(x)$ menghasilkan barisan iterasi yang konvergen ke akar. "
                "Syarat mutlak agar barisan iterasi mendekati akar sejati (*Teorema Titik Tetap Banach*) adalah nilai mutlak turunan pertama fungsi $g(x)$ wajib lebih kecil dari 1:\n\n"
                "$$|g'(x)| < 1$$\n\n"
                "pada interval di sekitar akar yang dicari. Jika $|g'(x)| > 1$, proses komputasi akan divergen (menjauh dari akar).\n\n"
                "### 3. Langkah Operasional Algoritma\n"
                "1. **Formulasi Relasi Titik Tetap**: Pisahkan variabel $x$ dari $f(x) = 0$ sehingga diperoleh $x = g(x)$.\n"
                "2. **Uji Konvergensi**: Hitung $g'(x)$ dan pastikan $|g'(x)| < 1$ di sekitar tebakan awal.\n"
                "3. **Inisialisasi**: Tentukan tebakan awal $x_0$, batas toleransi galat $\\epsilon$ (misal $10^{-4}$), dan batas maksimum iterasi $N$.\n"
                "4. **Iterasi Berulang**: Hitung hampiran akar berikutnya: $x_{i+1} = g(x_i)$.\n"
                "5. **Evaluasi Kriteria Berhenti**: Periksa galat hampiran:\n\n"
                "$$|x_{i+1} - x_i| < \\epsilon \\quad \\text{atau} \\quad |f(x_{i+1})| < \\epsilon$$\n\n"
                "Jika kondisi terpenuhi, $x_{i+1}$ adalah hampiran akar numerik yang dicari. Jika belum, ulangi langkah 4 dengan menetapkan $x_i = x_{i+1}$.\n\n"
                "### 4. Contoh Komputasi Numerik Nyata\n"
                "**Kasus**: Selesaikan persamaan non-linier $f(x) = x^2 - 2x - 3 = 0$.\n\n"
                "- **Transformasi ke $x = g(x)$**:\n"
                "  $$x^2 = 2x + 3 \\implies x = \\sqrt{2x + 3} = g(x)$$\n"
                "- **Uji Turunan**:\n"
                "  $$g'(x) = \\frac{1}{2\\sqrt{2x + 3}} = \\frac{1}{\\sqrt{2x + 3}}$$\n"
                "  Untuk tebakan awal $x_0 = 4$:\n"
                "  $$|g'(4)| = \\frac{1}{\\sqrt{11}} \\approx 0.3015 < 1 \\quad (\\text{Terbukti Konvergen})$$\n"
                "- **Tabel Iterasi Manual**:\n\n"
                "| Iterasi ($i$) | $x_i$ | $x_{i+1} = \\sqrt{2x_i + 3}$ | Galat $|x_{i+1} - x_i|$ |\n"
                "| :---: | :---: | :---: | :---: |\n"
                "| 0 | 4.0000 | 3.3166 | 0.6834 |\n"
                "| 1 | 3.3166 | 3.1037 | 0.2129 |\n"
                "| 2 | 3.1037 | 3.0344 | 0.0693 |\n"
                "| 3 | 3.0344 | 3.0114 | 0.0230 |\n"
                "| 4 | 3.0114 | 3.0038 | 0.0076 |\n"
                "| 5 | 3.0038 | 3.0013 | 0.0025 |\n\n"
                "Nilai hampiran terus berkonvergensi menuju solusi eksak akar persamaan, yaitu **$x^* = 3$**."
            )

        if "newton" in q or "raphson" in q or "nr" in q.split():
            return (
                "### 1. Definisi & Konsep Fundamental\n"
                "**Metode Newton-Raphson** adalah salah satu algoritma pencarian akar persamaan non-linier $f(x) = 0$ paling populer yang memanfaatkan garis singgung (tangen) kurva pada titik tebakan awal untuk mempercepat konvergensi.\n\n"
                "### 2. Formulasi Matematis (Penurunan Deret Taylor)\n"
                "Berdasarkan ekspansi deret Taylor orde pertama di sekitar titik $x_i$:\n\n"
                "$$f(x_{i+1}) \\approx f(x_i) + f'(x_i)(x_{i+1} - x_i)$$\n\n"
                "Dengan menetapkan $f(x_{i+1}) = 0$ untuk mencari titik potong sumbu $x$, diperoleh rumus iterasi Newton-Raphson:\n\n"
                "$$x_{i+1} = x_i - \\frac{f(x_i)}{f'(x_i)}$$\n\n"
                "### 3. Karakteristik & Konvergensi Kuadratik\n"
                "- **Laju Konvergensi Orde 2 (Kuadratik)**: Jumlah digit desimal benar bertambah dua kali lipat setiap iterasi jika tebakan awal cukup dekat dengan akar.\n"
                "- **Syarat Mutlak**: Nilai turunan tidak boleh nol ($f'(x_i) \\neq 0$) agar tidak menghasilkan pembagian dengan nol."
            )

        if any(k in q for k in ["bagaimana caranya", "caranya gimana", "gimana caranya", "jelaskan caranya", "langkahnya"]):
            return (
                "### Prosedur Komputasi Numerik Terstruktur\n\n"
                "Untuk menyelesaikan pencarian akar non-linier secara tuntas, ikuti protokol komputasi berikut:\n\n"
                "1. **Identifikasi Fungsi & Karakteristik Kurva**:\n"
                "   Tuliskan persamaan dalam bentuk implisit $f(x) = 0$. Evaluasi apakah fungsi bersifat kontinu dan diferensiabel.\n"
                "2. **Pilih Metode yang Tepat**:\n"
                "   - **Metode Tertutup (Biseksi / Regula Falsi)**: Selalu konvergen jika mengapit akar ($f(a) \\cdot f(b) < 0$), namun laju konvergensi relatif lambat.\n"
                "   - **Metode Terbuka (Iterasi 1 Titik / Newton-Raphson / Secant)**: Memerlukan tebakan awal tanpa mengapit akar, proses iterasi sangat cepat jika memenuhi syarat konvergensi ($|g'(x)| < 1$ atau $f'(x) \\neq 0$).\n"
                "3. **Lakukan Iterasi Tabelaris**:\n"
                "   Susun tabel perhitungan kolom: Iterasi ($i$), $x_i$, $f(x_i)$, dan Galat Relatif Aproksimasi ($\\epsilon_a = |\\frac{x_{i+1} - x_i}{x_{i+1}}| \\times 100\\%$).\n"
                "4. **Validasi Solusi Akhir**:\n"
                "   Substitusikan nilai akar hampiran $x^*$ kembali ke persamaan asal $f(x^*)$ untuk memastikan residu mendekati nol."
            )

        # 6. Jawaban Terbuka Adaptif / General Reasoning
        # Bangun penalaran umum yang ramah dan solutif
        available_titles = [d.get("title", "") for d in (user_docs or []) if d.get("title")]
        library_context_hint = ""
        if available_titles:
            sample_titles = ", ".join([f"**{t}**" for t in available_titles[:3]])
            library_context_hint = f"\n\n*(Saat ini MyLibrary Anda memuat materi: {sample_titles}. Jika pertanyaan Anda berkaitan dengan modul tersebut, Anda dapat menyebutkan istilah spesifiknya agar saya rujuk langsung ke halamannya.)*"

        return (
            f"Mengenai pertanyaan Anda: *\"{question}\"*,\n\n"
            f"Secara konseptual, materi ini mencakup pembahasan ilmiah umum. "
            f"Saya dapat membantu menguraikan prinsip-prinsip dasarnya, rumus komputasi, maupun kaitannya dengan literatur akademis.{library_context_hint}"
        )

    def generate_library_overview(
        self,
        question: str,
        docs_summary: List[Dict[str, Any]]
    ) -> ChatResponse:
        """Menghasilkan ringkasan dan inventaris dokumen koleksi MyLibrary pengguna."""
        if not docs_summary:
            return ChatResponse(
                answer="MyLibrary Anda saat ini masih kosong. Silakan unggah file PDF melalui menu MyLibrary terlebih dahulu.",
                citations=[]
            )

        total_count = len(docs_summary)
        answer_lines = [f"Di dalam **MyLibrary** Anda saat ini terdapat **{total_count} file/dokumen**:\n"]
        citations = []

        for idx, doc in enumerate(docs_summary, 1):
            title = doc.get("title", f"Dokumen {idx}")
            pages_count = doc.get("total_pages", 1)
            sample = doc.get("sample_text", "").strip()
            clean_sample = " ".join(sample.split())
            preview_desc = clean_sample[:250] + "..." if len(clean_sample) > 250 else clean_sample
            if not preview_desc:
                preview_desc = "Dokumen referensi akademik perpustakaan."

            first_quote = sample[:80].strip() if sample else title
            answer_lines.append(
                f"{idx}. **{title}** ({pages_count} Halaman)\n"
                f"   * **Topik/Isi Dokumen**: {preview_desc}\n"
            )

            citations.append(
                CitationItem(
                    document_id=doc["id"],
                    document_title=title,
                    page_number=1,
                    exact_quote=first_quote
                )
            )

        return ChatResponse(
            answer="\n".join(answer_lines),
            citations=citations
        )

    def answer_academic_chat(
        self,
        question: str,
        academic_evidence: List[Dict[str, Any]],
        chat_history: Optional[List[Dict[str, Any]]] = None,
        model_preference: Optional[str] = None
    ) -> ChatResponse:
        """
        Sintesis jawaban ilmiah berbasis bukti empiris (Evidence-Based Medicine) ala Perplexity & Consensus.
        Mengaitkan setiap temuan studi dengan nomor sitasi [1], [2] yang kaya metadata jurnal internasional.
        """
        if not academic_evidence:
            return ChatResponse(
                answer=(
                    "### ⚠️ Tidak Ditemukan Literatur Terkait di Repositori Ilmiah\n\n"
                    f"Pencarian terhadap topik *\"{question}\"* tidak menemukan naskah jurnal spesifik di basis data PubMed, PMC, maupun arXiv.\n\n"
                    "**Saran Penelusuran Ilmiah:**\n"
                    "- Gunakan nama generik obat resmi (misal: *Amlodipine*, *Metformin*, *Ibuprofen*).\n"
                    "- Gunakan istilah farmakologi atau nama penyakit standar (misal: *hipertensi*, *diabetes melitus tipe 2*, *preeklampsia*).\n"
                    "- Atau beralih ke mode **Library** jika Anda memiliki dokumen/modul farmasi sendiri di koleksi MyLibrary."
                ),
                citations=[]
            )

        # Susun daftar sitasi dengan metadata asli tanpa fabrikasi
        citations: List[CitationItem] = []
        context_parts = []
        for idx, item in enumerate(academic_evidence, 1):
            result_num = item.get("result_id", idx)
            title = item.get("document_title") or "Jurnal Riset"
            journal = item.get("journal_name") or None
            year = item.get("publication_year") or None
            authors = item.get("authors") or []
            authors_str = ", ".join(authors[:2]) + (" et al." if len(authors) > 2 else "") if authors else ""
            abstract = item.get("abstract_snippet") or ""
            doi = item.get("doi") or None
            url = item.get("url") or None
            pdf_url = item.get("pdf_url") or None

            first_quote = abstract[:160].strip() if abstract else ""

            citations.append(
                CitationItem(
                    document_id=f"academic-{result_num}",
                    document_title=title,
                    page_number=1,
                    exact_quote=first_quote,
                    source_type="academic_web",
                    journal_name=journal,
                    publication_year=year,
                    authors=authors,
                    doi=doi,
                    url=url,
                    pdf_url=pdf_url,
                    abstract_snippet=abstract or None
                )
            )

            journal_desc = journal or "Jurnal tidak tercantum"
            if year:
                journal_desc += f" ({year})"
            penulis_desc = f" | PENULIS: {authors_str}" if authors_str else ""
            doi_desc = f"{doi}" if doi else "-"
            url_desc = f"({url})" if url else ""
            abstrak_desc = abstract if abstract else "(Tidak ada abstrak tersedia)"

            context_parts.append(
                f"[{result_num}] JUDUL ARTIKEL: {title}\n"
                f"    JURNAL ILMIAH: {journal_desc}{penulis_desc}\n"
                f"    DOI / TAUTAN RESMI: {doi_desc} {url_desc}\n"
                f"    ABSTRAK & TEMUAN EMPIRIS: {abstrak_desc}\n"
            )

        context_str = "\n".join(context_parts)

        # Validasi sitasi: Setiap [n] di teks harus punya sumber yang valid
        valid_ids = {str(item.get("result_id", idx)) for idx, item in enumerate(academic_evidence, 1)}
        def _sanitize_answer(raw_ans: str) -> str:
            if not raw_ans:
                return raw_ans
            def _repl(match):
                num = match.group(1)
                return match.group(0) if num in valid_ids else ""
            cleaned = re.sub(r'\[(\d+)\](?!\()', _repl, raw_ans)
            return re.sub(r' +', ' ', cleaned).strip()


        # Prompt Evidence-Based Medicine ala Perplexity Academic & Consensus
        academic_prompt = (
            "KONTEKS LITERATUR ILMIAH TERVERIFIKASI (NCBI PubMed / PMC / arXiv):\n"
            f"{context_str}\n\n"
            f"PERTANYAAN PENGGUNA / PENELITI:\n{question}\n\n"
            "INSTRUKSI SINTESIS EVIDENCE-BASED MEDICINE (STANDAR PERPLEXITY & CONSENSUS):\n"
            "1. Kalimat Pembuka (Inverted Pyramid): Jawab langsung esensi pertanyaan pada kalimat pertama berdasarkan konsensus literatur, lengkapi dengan sitasi [1], [2]. Dilarang salam pembuka robotik.\n"
            "2. Pembahasan Berbasis Bukti (Evidence & Mechanisms): Uraikan mekanisme molekuler, efektivitas terapi, atau temuan studi secara analitis. Sebutkan nama jurnal atau penulis naskah (contoh: 'Dalam publikasi di Journal of Clinical Hypertension [1]...').\n"
            "3. Profil Keamanan & Implikasi Praktis: Sebutkan efek samping spesifik, kontraindikasi, atau anjuran dosis/klinis yang relevan dari bukti literatur.\n"
            "4. Format Rumus Sains (Wajib LaTeX Presisi): Gunakan $...$ untuk notasi inline ($t_{1/2}$, $C_{max}$, $AUC$, dosis) dan $$...$$ untuk persamaan matematika/kimia.\n"
            "5. Seluruh sitasi wajib menggunakan format kurung siku [1], [2], [3] yang berkorespondensi persis dengan daftar literatur di atas."
        )

        academic_system = (
            "Anda adalah EPIONA Academic Research Assistant, spesialis sintesis Evidence-Based Medicine dan telaah literatur biomedis farmasi terverifikasi. "
            "Anda beroperasi dengan prinsip Inverted Pyramid, presisi analitis mutlak, dan grounding 1:1 ke literatur ilmiah."
        )

        # 0. Routing Preferensi Model Pilihan Pengguna (Claude vs Gemini)
        pref = (model_preference or "").lower()
        prefer_claude = "claude" in pref or "sonnet" in pref or "anthropic" in pref

        if prefer_claude:
            if not self.anthropic_api_key and not self.openrouter_api_key:
                notice_text = (
                    "### ⚠️ Kunci API Claude Belum Dikonfigurasi di Backend\n\n"
                    "Anda memilih model **Claude 3.5 Sonnet (Latest)** untuk riset akademik, namun `ANTHROPIC_API_KEY` maupun `OPENROUTER_API_KEY` "
                    "belum diisi pada berkas konfigurasi `backend/.env`.\n\n"
                    "**Langkah Aktivasi:**\n"
                    "1. Masukkan API key Claude ke `backend/.env`:\n"
                    "   ```env\n"
                    "   OPENROUTER_API_KEY=sk-or-v1-...\n"
                    "   # ATAU\n"
                    "   ANTHROPIC_API_KEY=sk-ant-...\n"
                    "   ```\n"
                    "2. Muat ulang server, atau alihkan model ke **Gemini 2.0 Flash (Default)** di samping tombol Kirim untuk menikmati respon instan gratis."
                )
                return ChatResponse(answer=notice_text, citations=citations, is_error=True)

            if self.anthropic_api_key:
                try:
                    payload = {
                        "model": self.anthropic_model,
                        "max_tokens": 3000,
                        "system": academic_system,
                        "messages": [{"role": "user", "content": academic_prompt}],
                        "temperature": 0.2
                    }
                    req = urllib.request.Request(
                        f"{self.anthropic_base_url}/v1/messages",
                        data=json.dumps(payload).encode("utf-8"),
                        headers={
                            "x-api-key": self.anthropic_api_key,
                            "anthropic-version": "2023-06-01",
                            "content-type": "application/json"
                        },
                        method="POST"
                    )
                    with urllib.request.urlopen(req, timeout=20) as resp:
                        res_data = json.loads(resp.read().decode("utf-8"))
                    ai_answer = res_data["content"][0]["text"]
                    return ChatResponse(answer=ai_answer, citations=citations)
                except Exception as e:
                    logger.warning(f"Preferred Anthropic Academic error: {e}.")

            if self.openrouter_api_key:
                claude_target = self.openrouter_model if "claude" in self.openrouter_model.lower() else "anthropic/claude-3.5-sonnet"
                try:
                    payload = {
                        "model": claude_target,
                        "messages": [
                            {"role": "system", "content": academic_system},
                            {"role": "user", "content": academic_prompt}
                        ],
                        "temperature": 0.2,
                        "max_tokens": 3000
                    }
                    req = urllib.request.Request(
                        f"{self.openrouter_base_url}/chat/completions",
                        data=json.dumps(payload).encode("utf-8"),
                        headers={
                            "Content-Type": "application/json",
                            "Authorization": f"Bearer {self.openrouter_api_key}",
                            "HTTP-Referer": "https://epiona.academic.id",
                            "X-Title": "EPIONA Academic Research Assistant"
                        },
                        method="POST"
                    )
                    with urllib.request.urlopen(req, timeout=25) as resp:
                        raw_text = resp.read().decode("utf-8")
                    ai_answer = self._extract_text_from_raw_openai(raw_text)
                    return ChatResponse(answer=_sanitize_answer(ai_answer), citations=citations)
                except Exception as e:
                    logger.warning(f"Preferred OpenRouter Academic error: {e}.")

            return ChatResponse(
                answer="### ⚠️ Gagal Menghubungi Penyedia Claude\n\nKoneksi ke API Claude gagal atau saldo kuota API habis. Silakan beralih ke model Gemini 2.0 Flash di samping tombol Kirim.",
                citations=citations,
                is_error=True
            )

        # 1. Prioritas Utama: 9Router AI Gateway (Cepat & Andal)
        if self._is_router_alive():
            # Coba model router aktif dan alternatif yang stabil
            models_to_try = [self.router_model, "gemini/gemini-3.7-flash", "gemini/gemini-3.6-flash", "gemini/gemini-3.5-flash-lite"]
            seen_academic = set()
            unique_academic = []
            for m in models_to_try:
                if m and m not in seen_academic:
                    seen_academic.add(m)
                    unique_academic.append(m)

            for m_candidate in unique_academic:
                try:
                    payload = {
                        "model": m_candidate,
                        "messages": [
                            {"role": "system", "content": academic_system},
                            {"role": "user", "content": academic_prompt}
                        ],
                        "temperature": 0.2,
                        "max_tokens": 2500
                    }
                    req = urllib.request.Request(
                        f"{self.router_base_url}/chat/completions",
                        data=json.dumps(payload).encode("utf-8"),
                        headers={"Content-Type": "application/json", "Authorization": f"Bearer {self.router_api_key}"},
                        method="POST"
                    )
                    with urllib.request.urlopen(req, timeout=15) as resp:
                        raw_text = resp.read().decode("utf-8")
                    ai_answer = self._extract_text_from_raw_openai(raw_text)
                    if ai_answer and len(ai_answer.strip()) > 30:
                        return ChatResponse(answer=_sanitize_answer(ai_answer), citations=citations)
                except Exception as e:
                    logger.warning(f"9Router Academic ({m_candidate}) error: {e}. Mencoba alternatif.")

        # 2. Prioritas 2: OpenRouter AI Gateway
        if self.openrouter_api_key:
            try:
                payload = {
                    "model": self.openrouter_model,
                    "messages": [
                        {"role": "system", "content": academic_system},
                        {"role": "user", "content": academic_prompt}
                    ],
                    "temperature": 0.2,
                    "max_tokens": 3000
                }
                req = urllib.request.Request(
                    f"{self.openrouter_base_url}/chat/completions",
                    data=json.dumps(payload).encode("utf-8"),
                    headers={
                        "Content-Type": "application/json",
                        "Authorization": f"Bearer {self.openrouter_api_key}",
                        "HTTP-Referer": "https://epiona.academic.id",
                        "X-Title": "EPIONA Academic Research Assistant"
                    },
                    method="POST"
                )
                with urllib.request.urlopen(req, timeout=20) as resp:
                    raw_text = resp.read().decode("utf-8")
                ai_answer = self._extract_text_from_raw_openai(raw_text)
                if ai_answer and len(ai_answer.strip()) > 30:
                    return ChatResponse(answer=_sanitize_answer(ai_answer), citations=citations)
            except Exception as e:
                logger.warning(f"OpenRouter Academic error: {e}. Mengalihkan ke provider berikutnya.")

        # 3. Prioritas 3: Groq LPU
        if self.groq_client:
            try:
                comp = self.groq_client.chat.completions.create(
                    model=self.groq_model or "llama-3.3-70b-versatile",
                    messages=[
                        {"role": "system", "content": academic_system},
                        {"role": "user", "content": academic_prompt}
                    ],
                    temperature=0.2,
                    max_tokens=2500
                )
                ai_answer = comp.choices[0].message.content
                if ai_answer and len(ai_answer.strip()) > 30:
                    return ChatResponse(answer=_sanitize_answer(ai_answer), citations=citations)
            except Exception as e:
                logger.warning(f"Groq Academic error: {e}. Mengalihkan ke Smart Offline Synthesis.")

        # 4. Fallback Cerdas Dinamis: Sintesis Aktual Abstrak Jurnal (Perplexity-Grade)
        return self._synthesize_academic_offline(question, academic_evidence, citations)

    def _synthesize_academic_offline(
        self,
        question: str,
        academic_evidence: List[Dict[str, Any]],
        citations: List[CitationItem]
    ) -> ChatResponse:
        """
        Sintesis akademik mendalam berbasis bukti empiris naskah riil (PubMed / PMC / arXiv).
        Menghasilkan telaah komprehensif berbasis bukti aktual dari abstrak publikasi.
        """
        total_sources = len(academic_evidence)
        first_paper = academic_evidence[0]
        fp_id = first_paper.get("result_id", 1)
        fp_title = first_paper.get("document_title", "Studi Terakreditasi")
        fp_journal = first_paper.get("journal_name", "PubMed")
        fp_year = first_paper.get("publication_year") or ""
        fp_year_str = f" ({fp_year})" if fp_year else ""
        fp_abs = first_paper.get("abstract_snippet", "").strip()

        body = [
            f"Berdasarkan penelusuran terhadap **{total_sources} publikasi ilmiah terakreditasi** (NCBI PubMed, PMC, dan arXiv) mengenai *\"{question}\"*, telaah literatur menunjukkan temuan empiris sebagai berikut [{fp_id}]:\n",
            "### 1. Konsensus Ilmiah & Temuan Kunci",
            f"Publikasi utama dalam *{fp_journal}*{fp_year_str} berjudul *\"{fp_title}\"* [{fp_id}] mengonfirmasi:",
            f"> {fp_abs if fp_abs else 'Data klinis mendukung peran penting intervensi farmakoterapi terkait dalam modulasi respon biologis pasien.'}\n",
            "### 2. Matriks Bukti Literatur Terverifikasi (PubMed / PMC)",
            "| Sitasi | Judul Publikasi & Jurnal | Tahun | Temuan Empiris Utama / Abstrak |",
            "| :--- | :--- | :---: | :--- |"
        ]

        for idx, item in enumerate(academic_evidence, 1):
            r_id = item.get("result_id", idx)
            t = item.get("document_title", "Studi Klinis")
            j = item.get("journal_name", "PubMed")
            y = item.get("publication_year") or "-"
            ab = item.get("abstract_snippet", "").strip()
            ab_clean = " ".join(ab.split())[:160] + "..." if len(ab) > 160 else ab
            if not ab_clean:
                ab_clean = f"Kajian klinis terindeks dalam {j}."
            body.append(f"| **[{r_id}]** | **{t}**<br>*{j}* | {y} | {ab_clean} |")

        body.append(
            "\n### 3. Evaluasi Klinis & Tindak Lanjut\n"
            f"- **Konsistensi Data**: Temuan di atas merujuk langsung pada naskah yang terindeks resmi pada pangkalan data PubMed [{fp_id}].\n"
            "- **Verifikasi Rujukan**: Seluruh naskah lengkap, DOI, dan tautan publikasi asli dapat diakses langsung pada panel rujukan di sisi kanan."
        )

        return ChatResponse(
            answer="\n".join(body),
            citations=citations
        )

    def test_connection(
        self,
        provider: str,
        api_key: str,
        model: Optional[str] = None,
        base_url: Optional[str] = None
    ) -> Dict[str, Any]:
        """Uji konektivitas live (ping) ke provider AI tertentu dengan pengukuran latensi."""
        import time
        start_time = time.time()
        provider = provider.lower().strip()

        try:
            if provider == "openrouter":
                b_url = (base_url or self.openrouter_base_url or "https://openrouter.ai/api/v1").rstrip("/")
                m_name = model or self.openrouter_model or "google/gemma-4-31b-it:free"
                payload = {
                    "model": m_name,
                    "messages": [{"role": "user", "content": "Ping test. Balas: PONG"}],
                    "max_tokens": 10
                }
                req = urllib.request.Request(
                    f"{b_url}/chat/completions",
                    data=json.dumps(payload).encode("utf-8"),
                    headers={
                        "Content-Type": "application/json",
                        "Authorization": f"Bearer {api_key.strip()}",
                        "HTTP-Referer": "https://epiona.academic.id",
                        "X-Title": "EPIONA Connection Test"
                    },
                    method="POST"
                )
                with urllib.request.urlopen(req, timeout=12) as resp:
                    resp_data = json.loads(resp.read().decode("utf-8"))
                latency = int((time.time() - start_time) * 1000)
                reply = resp_data.get("choices", [{}])[0].get("message", {}).get("content", "")
                return {"success": True, "latency_ms": latency, "provider": "OpenRouter", "model": m_name, "reply": reply.strip()}

            elif provider == "gemini":
                m_name = model or self.gemini_model or "gemini-2.0-flash"
                payload = {
                    "contents": [{"parts": [{"text": "Ping test. Balas: PONG"}]}],
                    "generationConfig": {"maxOutputTokens": 10}
                }
                url = f"https://generativelanguage.googleapis.com/v1beta/models/{m_name}:generateContent?key={api_key.strip()}"
                req = urllib.request.Request(url, data=json.dumps(payload).encode("utf-8"), headers={"Content-Type": "application/json"}, method="POST")
                with urllib.request.urlopen(req, timeout=12) as resp:
                    resp_data = json.loads(resp.read().decode("utf-8"))
                latency = int((time.time() - start_time) * 1000)
                reply = resp_data["candidates"][0]["content"]["parts"][0]["text"]
                return {"success": True, "latency_ms": latency, "provider": "Google Gemini", "model": m_name, "reply": reply.strip()}

            elif provider == "groq":
                m_name = model or self.groq_model or "llama-3.3-70b-versatile"
                from groq import Groq
                client = Groq(api_key=api_key.strip())
                comp = client.chat.completions.create(
                    model=m_name,
                    messages=[{"role": "user", "content": "Ping test. Balas: PONG"}],
                    max_tokens=10
                )
                latency = int((time.time() - start_time) * 1000)
                reply = comp.choices[0].message.content
                return {"success": True, "latency_ms": latency, "provider": "Groq LPU", "model": m_name, "reply": reply.strip()}

            elif provider == "anthropic":
                b_url = (base_url or self.anthropic_base_url or "https://api.anthropic.com").rstrip("/")
                m_name = model or self.anthropic_model or "claude-3-5-haiku-20241022"
                payload = {
                    "model": m_name,
                    "max_tokens": 10,
                    "messages": [{"role": "user", "content": "Ping test. Balas: PONG"}]
                }
                req = urllib.request.Request(
                    f"{b_url}/v1/messages",
                    data=json.dumps(payload).encode("utf-8"),
                    headers={
                        "x-api-key": api_key.strip(),
                        "anthropic-version": "2023-06-01",
                        "content-type": "application/json"
                    },
                    method="POST"
                )
                with urllib.request.urlopen(req, timeout=12) as resp:
                    resp_data = json.loads(resp.read().decode("utf-8"))
                latency = int((time.time() - start_time) * 1000)
                reply = resp_data["content"][0]["text"]
                return {"success": True, "latency_ms": latency, "provider": "Anthropic Claude", "model": m_name, "reply": reply.strip()}

            elif provider in ("router", "9router"):
                b_url = (base_url or self.router_base_url or "http://localhost:20128/v1").rstrip("/")
                m_name = model or self.router_model or "gemini/gemini-3.8-flash"
                payload = {
                    "model": m_name,
                    "messages": [{"role": "user", "content": "Ping test. Balas: PONG"}],
                    "max_tokens": 10
                }
                req = urllib.request.Request(
                    f"{b_url}/chat/completions",
                    data=json.dumps(payload).encode("utf-8"),
                    headers={
                        "Content-Type": "application/json",
                        "Authorization": f"Bearer {api_key.strip()}"
                    },
                    method="POST"
                )
                with urllib.request.urlopen(req, timeout=12) as resp:
                    raw_resp = resp.read().decode("utf-8")
                latency = int((time.time() - start_time) * 1000)
                reply = self._extract_text_from_raw_openai(raw_resp)
                return {"success": True, "latency_ms": latency, "provider": "9Router Gateway", "model": m_name, "reply": reply.strip()}

            else:
                return {"success": False, "error": f"Provider '{provider}' tidak dikenal."}

        except Exception as e:
            latency = int((time.time() - start_time) * 1000)
            return {"success": False, "latency_ms": latency, "provider": provider, "error": str(e)}

    def generate_smart_session_title(self, question: str, answer: str) -> str:
        """Membuat judul sesi percakapan yang cerdas, padat (2-4 kata), dan relevan ala Claude/ChatGPT."""
        import re
        from app.indexer import DocumentSearchIndex
        norm_q = DocumentSearchIndex.normalize_query(question).strip()
        norm_q_lower = norm_q.lower()

        # 1. Deteksi intent khusus (Inventaris, Profil, Paper, Topik Kuliah)
        if any(k in norm_q_lower for k in ["berapa dokumen", "berapa file", "punya berapa", "ada berapa dokumen", "koleksi dokumen", "isi library"]):
            fallback_title = "Inventaris Koleksi Dokumen"
        elif any(k in norm_q_lower for k in ["siapa kamu", "siapa anda", "jelaskan siapa", "identitas", "perkenalkan", "profil"]):
            fallback_title = "Perkenalan Asisten Epiona"
        elif any(k in norm_q_lower for k in ["paper", "jurnal"]):
            m = re.search(r"(?:tentang|mengenai|topik|riset|terkait)\s+(.+)", norm_q, re.I)
            if m:
                words = [w for w in re.findall(r"\b\w+\b", m.group(1)) if len(w) > 2]
                if words:
                    sub = " ".join(words[:2]).title()
                    fallback_title = f"Riset Paper {sub}"
                else:
                    fallback_title = "Pencarian Paper Jurnal"
            else:
                fallback_title = "Pencarian Paper Jurnal"
        elif "week 1" in norm_q_lower or "w1" in norm_q_lower:
            fallback_title = "Modul Week 1 NumMeth"
        elif "spl" in norm_q_lower or "persamaan linier" in norm_q_lower:
            fallback_title = "Sistem Persamaan Linier"
        elif "biseksi" in norm_q_lower:
            fallback_title = "Metode Biseksi"
        elif "secant" in norm_q_lower:
            fallback_title = "Metode Secant"
        elif "fixed point" in norm_q_lower:
            fallback_title = "Metode Fixed Point"
        elif "adma" in norm_q_lower:
            fallback_title = "Kajian ADMA Farmasi"
        elif "agentic" in norm_q_lower or "multi sistem" in norm_q_lower or "agent" in norm_q_lower:
            fallback_title = "Multi-Agent System"
        else:
            # Stopwords & filter kata sambung umum/typo
            stopwords = {
                "apakah", "apa", "bagaimana", "kenapa", "mengapa", "tolong", "bisa", "bisakah",
                "mohon", "coba", "jelaskan", "tampilkan", "carikan", "dong", "sih", "sebutkan",
                "lah", "kan", "ini", "itu", "tentang", "pada", "di", "ke", "dari", "untuk",
                "ada", "nggak", "tidak", "ya", "yah", "kak", "min", "halo", "hai",
                "saya", "kamu", "anda", "aku", "ingin", "mau", "tanya", "bertanya", "isi", "file",
                "dokumen", "seperti", "yang", "dan", "atau", "dengan", "secara", "menurut",
                "terkait", "dalam", "mengenai", "seputar", "hal", "adalah", "merupakan",
                "bahas", "uraikan", "analisis", "kajian", "berikan", "kasih", "info", "informasi",
                "apaan", "gimana", "bagaimanakah", "dengn", "yagn", "yg", "dgn", "bbrp", "utk",
                "mudah", "dipaham", "paham"
            }
            words = [w for w in re.findall(r"\b\w+\b", norm_q) if w.lower() not in stopwords and len(w) >= 3]
            if words:
                fallback_title = " ".join(words[:3]).title()
            else:
                fallback_title = "Diskusi Riset Akademik"

        if fallback_title and fallback_title not in ("Diskusi Riset Akademik", "Riset Literatur Farmasi"):
            return fallback_title

        prompt = (
            "Buatlah 1 judul sesi percakapan yang sangat singkat, padat, dan elegan dalam 3-5 kata bahasa Indonesia baku "
            "(ringkas, jelas, dan profesional). DILARANG menggunakan tanda kutip, kata tanya, tanda seru, atau titik.\n\n"
            f"Pertanyaan pengguna: {question[:150]}\n"
            f"Ringkasan jawaban: {answer[:200]}\n\n"
            "Format balasan: HANYA judul tersebut tanpa teks lain."
        )

        # 1. Coba via 9Router (jika gateway lokal aktif)
        if self._is_router_alive():
            try:
                payload = {
                    "model": self.router_model,
                    "messages": [
                        {"role": "system", "content": "Anda adalah asisten perumus judul sesi percakapan 2-4 kata."},
                        {"role": "user", "content": prompt}
                    ],
                    "temperature": 0.2,
                    "max_tokens": 25
                }
                req = urllib.request.Request(
                    f"{self.router_base_url}/chat/completions",
                    data=json.dumps(payload).encode("utf-8"),
                    headers={"Content-Type": "application/json", "Authorization": f"Bearer {self.router_api_key}"},
                    method="POST"
                )
                with urllib.request.urlopen(req, timeout=1.2) as resp:
                    raw_text = resp.read().decode("utf-8")

                accumulated = ""
                if "data: " in raw_text:
                    for line in raw_text.splitlines():
                        line = line.strip()
                        if line.startswith("data: ") and not line.endswith("[DONE]"):
                            chunk_json = line[6:].strip()
                            try:
                                chunk = json.loads(chunk_json)
                                delta = chunk.get("choices", [{}])[0].get("delta", {})
                                if "content" in delta and delta["content"]:
                                    accumulated += delta["content"]
                            except Exception:
                                pass
                else:
                    try:
                        res_data = json.loads(raw_text)
                        accumulated = res_data["choices"][0]["message"]["content"]
                    except Exception:
                        accumulated = raw_text

                gen_title = accumulated.strip().strip('"\'*#')
                if gen_title and 3 <= len(gen_title) <= 40:
                    return gen_title
            except Exception:
                pass

        # 2. Coba via Gemini API (jika API key aktif & cepat <1.5s)
        if self.gemini_keys:
            try:
                for k in self.gemini_keys:
                    g_url = f"https://generativelanguage.googleapis.com/v1beta/models/{self.gemini_model}:generateContent?key={k}"
                    g_payload = {
                        "contents": [{"parts": [{"text": prompt}]}],
                        "generationConfig": {"temperature": 0.2, "maxOutputTokens": 25}
                    }
                    g_req = urllib.request.Request(
                        g_url,
                        data=json.dumps(g_payload).encode("utf-8"),
                        headers={"Content-Type": "application/json"},
                        method="POST"
                    )
                    with urllib.request.urlopen(g_req, timeout=1.5) as resp:
                        g_body = resp.read().decode("utf-8")
                        g_res = json.loads(g_body)
                        g_text = g_res["candidates"][0]["content"]["parts"][0]["text"].strip().strip('"\'*#')
                        if g_text and 3 <= len(g_text) <= 40:
                            return g_text
            except Exception:
                pass

        # 3. Coba Groq LPU
        if self.groq_client:
            try:
                resp = self.groq_client.chat.completions.create(
                    model=self.groq_model or "llama-3.3-70b-versatile",
                    messages=[
                        {"role": "system", "content": "Anda adalah asisten perumus judul sesi percakapan 2-4 kata."},
                        {"role": "user", "content": prompt}
                    ],
                    temperature=0.2,
                    max_tokens=25,
                    timeout=1.5
                )
                title = resp.choices[0].message.content.strip().strip('"\'*#')
                if title and 3 <= len(title) <= 40:
                    return title
            except Exception:
                pass

        return fallback_title
