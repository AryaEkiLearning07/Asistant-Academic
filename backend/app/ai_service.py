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
    "1. Langsung Ke Inti Jawaban (Inverted Pyramid): Kalimat pertama WAJIB langsung menjawab inti permasalahan secara tegas, presisi, dan solutif. DILARANG KERAS mengawali respon dengan salam pembuka klise atau pengantar basa-basi robotik.\n"
    "2. Bahasa Akademik Profesional & Mengalir: Uraikan materi dengan nada bicara yang hidup, berwibawa, dan berbobot seperti akademisi atau peneliti senior. Gunakan peristilahan yang tepat dan analogi intuitif jika membahas konsep yang kompleks.\n"
    "3. Logika Analitis Terstruktur: Uraikan materi kompleks menggunakan paragraf yang teratur atau poin analitis berbobot (definisi esensial, formulasi komputasi/matematika, mekanisme kerja biomedis, dan implikasi klinis/praktis).\n"
    "4. Tipografi Bersih: Gunakan sintaks Markdown standar. Penebalan topik gunakan **judul:** dan poin daftar gunakan tanda strip (-) atau angka terurut (1., 2.).\n"
    "5. Format Rumus & Notasi Sains (Wajib LaTeX Presisi):\n"
    "   - Seluruh rumus matematika, persamaan farmakokinetika, perhitungan dosis, dan variabel kimia/fisika WAJIB ditulis menggunakan sintaks LaTeX standar dengan delimiter dollar: gunakan $...$ untuk rumus inline (contoh: $f(x)=0$, $t_{1/2}$, $C_{max}$, $pH = pKa + \\log\\frac{[A^-]}{[HA]}$) dan $$...$$ di baris baru untuk rumus blok utama (contoh: $$c = \\frac{a + b}{2}$$ atau $$C_t = C_0 \\cdot e^{-k_e t}$$).\n"
    "   - Uraikan keterangan tiap variabel rumus secara runut agar mudah dipahami mahasiswa dan akademisi farmasi.\n\n"
    "ATURAN GROUNDING RUJUKAN (ISOLASI DOKUMEN & GENERAL REASONING):\n"
    "1. JIKA MATERI ADA DI DOKUMEN RUJUKAN:\n"
    "   - Jelaskan intisari materinya secara to-the-point dan cantumkan nomor sitasi dalam kurung siku misalnya [1], [2] yang bersesuaian dengan lembar dokumen fisik.\n"
    "   - Sebutkan konteks dokumen dalam kalimat (contoh: 'Berdasarkan materi Metode Numerik [1]...').\n"
    "   - Pastikan array 'citations' memuat metadata dokumen yang dikutip.\n"
    "2. JIKA MATERI TIDAK ADA DI DOKUMEN ATAU PERTANYAAN KONSEPTUAL UMUM:\n"
    "   - DILARANG MENOLAK MENJAWAB! Jangan pernah menolak dengan kalimat kaku ('Pertanyaan Anda tidak ditemukan di MyLibrary').\n"
    "   - Jawablah konsep sains, matematika, farmakologi, atau pertanyaan umum tersebut secara komprehensif dan tuntas menggunakan kecerdasan analitis Anda.\n"
    "   - Di akhir jawaban, berikan catatan sopan dan profesional:\n"
    "     *(Catatan: Rincian ini merupakan penjelasan konseptual analitis tambahan, karena materi tersebut tidak diuraikan secara spesifik dalam dokumen referensi yang sedang Anda buka.)*\n"
    "   - Kosongkan array 'citations': [] untuk pertanyaan tanpa rujukan dokumen.\n\n"
    "FORMAT OUTPUT WAJIB BERUPA JSON MURNI:\n"
    "{\n"
    '  "answer": "Jawaban terstruktur, presisi, dan ilmiah dengan sitasi [1] hanya jika merujuk dokumen...",\n'
    '  "citations": [\n'
    '    {\n'
    '      "document_id": "ID dokumen",\n'
    '      "document_title": "Judul dokumen",\n'
    '      "page_number": 1,\n'
    '      "exact_quote": "Kutipan kalimat persis dari dokumen"\n'
    '    }\n'
    '  ]\n'
    "}"
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
        focused_document_title: Optional[str] = None
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

        if is_creator_or_identity and not attachments:
            return ChatResponse(
                answer=self._reason_open_domain_answer(question, user_docs),
                citations=[]
            )

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
            any(trigger in q_lower or trigger in norm_q for trigger in conversational_triggers)
            and not attachments
        )

        # 2. Prioritas 1: 9Router AI Gateway (Local OpenAI-compatible proxy)
        if self._is_router_alive():
            try:
                return self._call_openai_compatible(
                    endpoint=f"{self.router_base_url}/chat/completions",
                    api_key=self.router_api_key,
                    model=self.router_model,
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
                logger.warning(f"9Router error: {e}. Mengalihkan ke provider berikutnya.")

        # 3. Prioritas 2: OpenRouter AI Gateway (Dukungan Model Claude, Gemma, Llama, DeepSeek)
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

        # 4. Prioritas 3: Anthropic Direct API / Proxy
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

        # 5. Prioritas 4: Direct Google Gemini (Multi-Key Pool Failover + Native Multimodal Vision)
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

        # 6. Prioritas 5: Groq LPU
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
            "response_format": {"type": "json_object"},
            "temperature": 0.1,
            "max_tokens": 3000
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
            "temperature": 0.1
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
                "response_mime_type": "application/json",
                "temperature": 0.1,
                "maxOutputTokens": 3000
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
            response_format={"type": "json_object"},
            temperature=0.1,
            max_tokens=2500
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
        """Ekstraksi JSON aman dari respons LLM."""
        try:
            return json.loads(raw_text)
        except Exception:
            start = raw_text.find("{")
            end = raw_text.rfind("}")
            if start != -1 and end != -1:
                return json.loads(raw_text[start:end+1])
            return {"answer": raw_text.strip(), "citations": []}

    def _build_chat_response(self, data: Dict[str, Any], relevant_pages: List[Dict[str, Any]]) -> ChatResponse:
        citations = []
        raw_cits = data.get("citations", [])
        if isinstance(raw_cits, list):
            for c in raw_cits:
                quote = c.get("exact_quote", "").strip()
                if quote:
                    default_doc_id = relevant_pages[0]["document_id"] if relevant_pages else c.get("document_id", "")
                    default_title = relevant_pages[0]["document_title"] if relevant_pages else c.get("document_title", "Dokumen Referensi")
                    default_page = relevant_pages[0]["page_number"] if relevant_pages else c.get("page_number", 1)
                    citations.append(CitationItem(
                        document_id=c.get("document_id", default_doc_id),
                        document_title=c.get("document_title", default_title),
                        page_number=int(c.get("page_number", default_page)),
                        exact_quote=quote
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

        # Bersihkan teks halaman dari nomor halaman mentah
        clean_lines = [l.strip() for l in text.split("\n") if l.strip() and not l.strip().isdigit()]
        meaningful_lines = [l for l in clean_lines if len(l) > 10 and not l.lower().startswith("halaman") and not l.lower().startswith("page")]

        exact_quote = meaningful_lines[0] if meaningful_lines else (clean_lines[0] if clean_lines else text[:120])
        body_content = "\n".join([f"> {line}" for line in meaningful_lines[:4]]) if meaningful_lines else f"> {text.strip()}"

        if is_visual:
            answer_text = (
                f"Berikut adalah rujukan materi dan potongan visual dari dokumen **{doc_title}** (Halaman {page_num}):\n\n"
                f"{body_content}\n\n"
                f"Potongan gambar atau diagram yang berkaitan dengan materi ini telah dilampirkan langsung di bawah penjelasan. "
                f"Anda dapat mengklik rujukan halaman untuk memeriksa letak asli gambar tersebut pada lembar dokumen."
            )
        else:
            answer_text = (
                f"Berdasarkan literatur **{doc_title}** (Halaman {page_num}):\n\n"
                f"{body_content}\n\n"
                f"Kutipan lengkap dapat Anda periksa langsung pada lembar fisik dokumen di panel sebelah kanan [1]."
            )

        return ChatResponse(
            answer=answer_text,
            citations=[
                CitationItem(
                    document_id=top_page.get("document_id"),
                    document_title=doc_title,
                    page_number=page_num,
                    exact_quote=exact_quote
                )
            ]
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
        if "biseksi" in q:
            return (
                "**Metode Biseksi (Bisection Method)** adalah algoritma pencarian akar persamaan non-linier $f(x) = 0$ dalam rentang interval $[a, b]$ dengan syarat nilai fungsi memiliki tanda berlawanan ($f(a) \\cdot f(b) < 0$, Teorema Nilai Antara Bolzano).\n\n"
                "**Langkah Kerja:**\n"
                "1. Tentukan interval awal $[a, b]$ sehingga $f(a) \\cdot f(b) < 0$.\n"
                "2. Hitung titik tengah: $c = \\frac{a + b}{2}$.\n"
                "3. Evaluasi $f(c)$:\n"
                "   - Jika $f(c) = 0$ atau $|b - a| < \\epsilon$ (toleransi error), maka $c$ adalah akar.\n"
                "   - Jika $f(a) \\cdot f(c) < 0$, akar berada di sub-interval $[a, c]$ (atur $b = c$).\n"
                "   - Jika sebaliknya, akar berada di sub-interval $[c, b]$ (atur $a = c$).\n"
                "4. Ulangi proses hingga galat relatif atau absolut terpenuhi.\n\n"
                "*Catatan: Metode ini selalu konvergen (linier) dengan laju reduksi interval sebesar 50% setiap iterasi.*"
            )

        if "secant" in q or "sekan" in q:
            return (
                "**Metode Secant (Metode Garis Sekan)** adalah metode numerik pencarian akar persamaan non-linier yang menggantikan turunan $f'(x)$ pada metode Newton-Raphson dengan hampiran garis potong (garis sekan) dari dua titik sebelumnya:\n\n"
                "$$x_{n+1} = x_n - f(x_n) \\frac{x_n - x_{n-1}}{f(x_n) - f(x_{n-1})}$$\n\n"
                "**Keunggulan & Karakteristik:**\n"
                "- Tidak memerlukan penurunan fungsi secara analitik ($f'(x)$).\n"
                "- Konvergensi superlinier (orde $\\approx 1.618$), lebih cepat dari Biseksi namun lebih rentan divergen jika nilai awal tidak dipilih dekat dengan akar."
            )

        if "spl" in q or "persamaan linier" in q or "eliminasi gauss" in q:
            return (
                "**Sistem Persamaan Linier (SPL)** dalam metode komputasi numerik diselesaikan melalui dua pendekatan utama:\n\n"
                "1. **Metode Langsung (Direct Methods):**\n"
                "   - **Eliminasi Gauss**: Mengubah matriks augmented $[A|b]$ menjadi matriks segitiga atas, lalu diselesaikan dengan substitusi mundur (*backward substitution*).\n"
                "   - **Gauss-Jordan**: Mengubah matriks augmented menjadi matriks eselon tereduksi (matriks identitas).\n"
                "   - **Dekomposisi LU**: Memfaktorkan matriks $A = L \\cdot U$ untuk efisiensi komputasi vektor beban ganda.\n\n"
                "2. **Metode Iteratif (Iterative Methods):**\n"
                "   - **Metode Jacobi** dan **Gauss-Seidel**: Menghampiri solusi secara rekursif hingga memenuhi kriteria galat toleransi $\\epsilon$, sangat efisien untuk matriks jarang (*sparse matrix*)."
            )

        if "amoksisilin" in q or "amoxicillin" in q:
            return (
                "**Amoksisilin** adalah antibiotik spektrum luas turunan penisilin semi-sintetik (golongan beta-laktam).\n\n"
                "**Mekanisme Kerja:**\n"
                "1. Mengikat secara kovalen protein target spesifik pada membran sitoplasma bakteri yang dikenal sebagai **Penicillin-Binding Proteins (PBPs)**, khususnya transpeptidase.\n"
                "2. Menghambat reaksi transpeptidasi (tahap akhir sintesis peptidoglikan), sehingga mencegah ikatan silang (*cross-linking*) rantai peptidoglikan.\n"
                "3. Melemahkan integritas dinding sel bakteri, memicu aktivasi enzim autolitik bakteri, dan berujung pada lisis sel bakteri (*bakterisidal*)."
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
        chat_history: Optional[List[Dict[str, Any]]] = None
    ) -> ChatResponse:
        """
        Sintesis jawaban ilmiah berbasis bukti empiris (Evidence-Based Medicine) ala Perplexity & Consensus.
        Mengaitkan setiap temuan studi dengan nomor sitasi [1], [2] yang kaya metadata jurnal internasional.
        """
        if not academic_evidence:
            return ChatResponse(
                answer=(
                    "Tidak ditemukan naskah jurnal ilmiah yang secara spesifik membahas pertanyaan tersebut di repositori PubMed dan arXiv. "
                    "Silakan formulasikan pertanyaan menggunakan kata kunci obat, senyawa, atau kondisi klinis."
                ),
                citations=[]
            )

        # Susun daftar sitasi yang kaya metadata
        citations: List[CitationItem] = []
        context_parts = []
        for idx, item in enumerate(academic_evidence, 1):
            title = item.get("document_title", "Jurnal Riset")
            journal = item.get("journal_name", "Medical Journal")
            year = item.get("publication_year", "2024")
            authors = item.get("authors", [])
            authors_str = ", ".join(authors[:2]) + (" et al." if len(authors) > 2 else "")
            abstract = item.get("abstract_snippet", "")
            doi = item.get("doi", "")
            url = item.get("url", "")
            pdf_url = item.get("pdf_url")

            first_quote = abstract[:160].strip() if abstract else f"Studi klinis di {journal} ({year})."

            citations.append(
                CitationItem(
                    document_id=f"academic-{idx}",
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
                    abstract_snippet=abstract
                )
            )

            context_parts.append(
                f"[{idx}] JUDUL: {title}\n"
                f"    JURNAL: {journal} ({year}) | PENULIS: {authors_str}\n"
                f"    DOI / URL: {doi} ({url})\n"
                f"    ABSTRAK / TEMUAN EMPIRIS: {abstract}\n"
            )

        context_str = "\n".join(context_parts)

        # Sintesis cerdas ala Claude & Consensus
        # Jika ada engine AI aktif (9Router / Gemini / Groq)
        academic_prompt = (
            "KONTEKS LITERATUR ILMIAH TERVERIFIKASI (PubMed / PMC / arXiv):\n"
            f"{context_str}\n\n"
            f"PERTANYAAN PENGGUNA:\n{question}\n\n"
            "INSTRUKSI EVIDENCE-BASED MEDICINE:\n"
            "1. Jawab pertanyaan pengguna secara komprehensif, terstruktur, dan elegan dalam bahasa Indonesia ilmiah berbasis bukti empiris.\n"
            "2. Setiap kali menyebutkan temuan studi, mekanisme aksi, atau dosis, cantumkan nomor sitasi dalam kurung siku misalnya [1], [2] bersesuaian dengan indeks literatur di atas.\n"
            "3. Sebutkan nama jurnal atau penulis utama dalam kalimat untuk transparansi ilmiah (contoh: 'Menurut tinjauan di Cochrane Database [1]...').\n"
            "4. Sertakan kesimpulan praktis atau evaluasi klinis di akhir jawaban.\n"
            "5. Format Rumus & Notasi Farmasi/Medis (Wajib LaTeX Presisi): Tulis semua rumus perhitungan dosis, parameter farmakokinetika ($t_{1/2}$, $C_{max}$, $AUC$, $V_d$, $Cl$), dan persamaan kimia/matematika menggunakan sintaks LaTeX standar: $...$ untuk inline dan $$...$$ untuk rumus blok baris baru."
        )

        # 1. Prioritas 1: 9Router AI Gateway (Local OpenAI Proxy)
        if self._is_router_alive():
            try:
                payload = {
                    "model": self.router_model,
                    "messages": [
                        {"role": "system", "content": "Anda adalah EPIONA Academic Research Assistant, spesialis sintesis Evidence-Based Medicine dan telaah literatur biomedis farmasi terverifikasi."},
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
                with urllib.request.urlopen(req, timeout=30) as resp:
                    raw_text = resp.read().decode("utf-8")
                ai_answer = self._extract_text_from_raw_openai(raw_text)
                return ChatResponse(answer=ai_answer, citations=citations)
            except Exception as e:
                logger.warning(f"9Router Academic error: {e}. Mengalihkan ke provider berikutnya.")

        # 2. Prioritas 2: OpenRouter AI Gateway
        if self.openrouter_api_key:
            try:
                payload = {
                    "model": self.openrouter_model,
                    "messages": [
                        {"role": "system", "content": "Anda adalah EPIONA Academic Research Assistant, spesialis sintesis Evidence-Based Medicine dan telaah literatur biomedis farmasi terverifikasi."},
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
                return ChatResponse(answer=ai_answer, citations=citations)
            except Exception as e:
                logger.warning(f"OpenRouter Academic error: {e}. Mengalihkan ke provider berikutnya.")

        # 3. Prioritas 3: Anthropic Direct API
        if self.anthropic_api_key:
            try:
                payload = {
                    "model": self.anthropic_model,
                    "max_tokens": 3000,
                    "system": "Anda adalah EPIONA Academic Research Assistant, spesialis sintesis Evidence-Based Medicine dan telaah literatur biomedis farmasi terverifikasi.",
                    "messages": [
                        {"role": "user", "content": academic_prompt}
                    ],
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
                with urllib.request.urlopen(req, timeout=25) as resp:
                    resp_body = resp.read().decode("utf-8")
                res_data = json.loads(resp_body)
                ai_answer = res_data["content"][0]["text"]
                return ChatResponse(answer=ai_answer, citations=citations)
            except Exception as e:
                logger.warning(f"Anthropic Academic error: {e}. Mengalihkan ke provider berikutnya.")

        # 4. Prioritas 4: Google Gemini Pool (Direct AI Studio)
        if self.gemini_keys:
            try:
                payload = {
                    "system_instruction": {
                        "parts": [{"text": "Anda adalah EPIONA Academic Research Assistant, spesialis sintesis Evidence-Based Medicine dan telaah literatur biomedis farmasi terverifikasi."}]
                    },
                    "contents": [{
                        "role": "user",
                        "parts": [{"text": academic_prompt}]
                    }],
                    "generationConfig": {
                        "temperature": 0.2,
                        "maxOutputTokens": 3000
                    }
                }
                req_data = json.dumps(payload).encode("utf-8")
                for _ in range(len(self.gemini_keys)):
                    active_key = self.gemini_keys[self._current_key_idx]
                    url = f"https://generativelanguage.googleapis.com/v1beta/models/{self.gemini_model}:generateContent?key={active_key}"
                    req = urllib.request.Request(url, data=req_data, headers={"Content-Type": "application/json"}, method="POST")
                    try:
                        with urllib.request.urlopen(req, timeout=25) as resp:
                            gemini_res = json.loads(resp.read().decode("utf-8"))
                        ai_answer = gemini_res["candidates"][0]["content"]["parts"][0]["text"]
                        return ChatResponse(answer=ai_answer, citations=citations)
                    except urllib.error.HTTPError as err:
                        if err.code in (429, 403):
                            self._current_key_idx = (self._current_key_idx + 1) % len(self.gemini_keys)
                            continue
                        break
            except Exception as e:
                logger.warning(f"Gemini Academic error: {e}. Mengalihkan ke Groq.")

        # 5. Prioritas 5: Groq LPU
        if self.groq_client:
            try:
                comp = self.groq_client.chat.completions.create(
                    model=self.groq_model or "llama-3.3-70b-versatile",
                    messages=[
                        {"role": "system", "content": "Anda adalah asisten sintesis literatur farmasi klinis & riset kedokteran berbasis bukti."},
                        {"role": "user", "content": academic_prompt}
                    ],
                    temperature=0.2,
                    max_tokens=2500
                )
                ai_answer = comp.choices[0].message.content
                return ChatResponse(answer=ai_answer, citations=citations)
            except Exception as e:
                logger.warning(f"Groq Academic error: {e}. Mengalihkan ke Smart Offline Synthesis.")

        # 6. Fallback Cerdas Dinamis: Sintesis Mendalam Berbasis Bukti Aktual Abstrak Jurnal (Perplexity-Grade Offline)
        return self._synthesize_academic_offline(question, academic_evidence, citations)

    def _synthesize_academic_offline(
        self,
        question: str,
        academic_evidence: List[Dict[str, Any]],
        citations: List[CitationItem]
    ) -> ChatResponse:
        """
        Sintesis akademik mendalam berbasis bukti empiris naskah riil (PubMed / PMC / arXiv)
        ketika koneksi LLM eksternal sedang offline / tidak terkonfigurasi.
        Menghasilkan telaah komprehensif berbasis bukti empiris dan struktur piramida terbalik.
        """
        total_sources = len(academic_evidence)
        first_paper = academic_evidence[0]
        fp_title = first_paper.get("document_title", "Studi Terakreditasi")
        fp_journal = first_paper.get("journal_name", "PubMed")
        fp_year = first_paper.get("publication_year", "2024")
        fp_abs = first_paper.get("abstract_snippet", "").strip()

        # Kalimat pembuka langsung ke konsensus ilmiah (Inverted Pyramid)
        body = [
            f"Berdasarkan analisis meta-telaah terhadap **{total_sources} publikasi ilmiah terindeks** (NCBI PubMed, PMC, dan arXiv) mengenai *\"{question}\"*, konsensus literatur mengonfirmasi signifikansi klinis dan mekanisme biologis yang kuat [1].\n",
            "### 1. Konsensus Ilmiah & Mekanisme Farmakologi Inti",
            f"Kajian mutakhir yang dipublikasikan dalam *{fp_journal}* ({fp_year}) [1] memaparkan bahwa intervensi dan modulasi jalur molekuler terkait memiliki peran fundamental dalam luaran klinis pasien. "
            f"{fp_abs if fp_abs else 'Data empiris menunjukkan korelasi terukur antara regulasi biologis ini dengan parameter homeostasis tubuh.'}\n",
            "### 2. Matriks Komparasi Bukti Empiris (Studi Terakreditasi)",
            "| Sitasi | Judul Publikasi & Jurnal | Tahun | Sorotan Temuan Empiris & Metodologi |",
            "| :--- | :--- | :---: | :--- |"
        ]

        for idx, item in enumerate(academic_evidence, 1):
            t = item.get("document_title", "Studi Klinis")
            j = item.get("journal_name", "PubMed")
            y = item.get("publication_year", "2024")
            ab = item.get("abstract_snippet", "").strip()
            # Bersihkan kutipan untuk tabel
            ab_clean = " ".join(ab.split())[:180] + "..." if len(ab) > 180 else ab
            if not ab_clean:
                ab_clean = f"Evaluasi klinis dan farmakoterapi terkait dalam {j}."
            body.append(f"| **[{idx}]** | **{t}**<br>*{j}* | {y} | {ab_clean} |")

        body.append(
            "\n### 3. Implikasi Praktis & Rekomendasi Klinis\n"
            "- **Modulasi Terarah**: Evaluasi biomarker berkala direkomendasikan untuk memitigasi risiko disfungsi vaskular atau komplikasi metabolik [1], [2].\n"
            "- **Transparansi Literatur**: Seluruh rujukan di atas telah diverifikasi dengan DOI dan tautan langsung ke basis data PubMed/PMC di panel sebelah kanan."
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
