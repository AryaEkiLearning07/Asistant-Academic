import logging
import re
from typing import List
from app.academic_service import AcademicRetrieverService

logger = logging.getLogger(__name__)

class SearchRouter:
    """
    Router cerdas untuk:
    1. Mengklasifikasikan apakah pertanyaan membutuhkan penelusuran (search) atau obrolan ringan.
    2. Menulis ulang kueri (query rewriting) menjadi 2-4 kueri terfokus (Bahasa Inggris untuk basis data internasional).
    """

    CONVERSATIONAL_WORDS = {
        "halo", "hai", "hello", "hi", "hey", "hei", "ok", "oke", "sip", "mantap", "makasih", "thanks",
        "terima", "kasih", "yup", "ya", "tidak", "pagi", "siang", "sore", "malam",
        "claudia", "epiona", "bot", "asisten", "assistant"
    }

    CONVERSATIONAL_PHRASES = [
        "siapa kamu", "siapa anda", "kamu siapa", "anda siapa", "perkenalkan dirimu",
        "siapa pembuatmu", "siapa penciptamu", "siapa developermu", "siapa yang membuat",
        "siapa yang menciptakan", "apa kabar", "kamu bisa apa", "apa tugas kamu",
        "tugas kamu apa", "apa itu epiona", "ceritakan tentangmu", "selamat pagi",
        "selamat siang", "selamat sore", "selamat malam", "terima kasih", "makasih banyak"
    ]

    # Pemetaan akronim medis & biomedis untuk ekspansi presisi
    ACRONYM_MAP = {
        "adma": "asymmetric dimethylarginine nitric oxide cardiovascular",
        "sdma": "symmetric dimethylarginine renal function biomarker",
        "cyp450": "cytochrome P450 drug metabolism pharmacokinetics",
        "nsaid": "nonsteroidal anti-inflammatory drugs pharmacology adverse effects",
        "acei": "angiotensin converting enzyme inhibitor pharmacology",
        "arb": "angiotensin receptor blocker pharmacology",
        "dm2": "type 2 diabetes mellitus pharmacotherapy glycemic control",
        "t2dm": "type 2 diabetes mellitus pharmacotherapy",
        "tb": "tuberculosis antitubercular therapy",
        "hiv": "antiretroviral therapy HIV pharmacology",
        "gerd": "gastroesophageal reflux disease proton pump inhibitor",
        "ckd": "chronic kidney disease renal pharmacology",
        "copd": "chronic obstructive pulmonary disease bronchodilator",
        "osi": "OSI 7 layer model computer networking architecture",
    }

    @classmethod
    def needs_search(cls, question: str) -> bool:
        """
        Klasifikasi cepat: apakah pertanyaan pengguna memerlukan penelusuran literatur/web.
        Sapaan murni, pertanyaan identitas, atau obrolan ringan tidak memerlukan pencarian.
        """
        if not question or not question.strip():
            return False

        q_clean = question.strip().lower()
        words = re.findall(r"\b\w+\b", q_clean)

        # Cek frasa obrolan langsung
        for phrase in cls.CONVERSATIONAL_PHRASES:
            if phrase in q_clean and len(words) <= 7:
                return False

        # Jika hanya 1-3 kata dan semuanya kata sapaan umum / nama asisten
        if len(words) <= 3 and all(w in cls.CONVERSATIONAL_WORDS for w in words):
            return False

        # Cek pertanyaan identitas model/asisten
        is_identity_query = (
            any(w in q_clean for w in ["siapa", "kamu", "anda", "epiona", "bot", "ai"])
            and any(w in q_clean for w in ["buat", "bikin", "cipta", "kembang", "program", "lahir"])
        )
        if is_identity_query and len(words) <= 6:
            return False

        # Seluruh pertanyaan faktual, obat, dosis, penyakit, konsep sains, atau mekanisme butuh search
        return True

    @classmethod
    def rewrite_queries(cls, question: str) -> List[str]:
        """
        Menulis ulang kueri pengguna menjadi 2-4 kueri presisi berbahasa Inggris
        untuk memaksimalkan recall dan precision di repositori PubMed, Semantic Scholar,
        Europe PMC, dan openFDA.
        """
        if not question or not question.strip():
            return []

        q_clean = question.strip()
        q_lower = q_clean.lower()
        generated_queries: List[str] = []

        # 1. Cek pemetaan akronim spesifik
        for acr, expansion in cls.ACRONYM_MAP.items():
            if re.search(rf"\b{acr}\b", q_lower):
                generated_queries.append(expansion)
                break

        # 2. Terjemahkan ke Bahasa Inggris Ilmiah (Lightweight Translator)
        translated_en = AcademicRetrieverService.translate_to_english(q_clean)
        clean_en = re.sub(r"[^\w\s-]", " ", translated_en).lower()

        # Ekstraksi kata kunci penting (hilangkan stopwords pertanyaan)
        stopwords = {
            "what", "is", "are", "the", "a", "an", "of", "for", "in", "to", "does", "do", "how",
            "can", "could", "should", "would", "tell", "me", "about", "explain", "please", "why",
            "which", "when", "where", "safe", "effect", "effects", "drug", "medicine", "medication",
            "and", "or", "on", "with", "during", "patient", "patients", "give", "show"
        }
        tokens = [t for t in clean_en.split() if t not in stopwords and len(t) > 2]
        core_keywords = " ".join(tokens[:5]) if tokens else clean_en[:40]

        # Kueri 1: Kueri primer berbasis entitas utama
        primary_query = core_keywords if core_keywords else clean_en
        if primary_query and primary_query not in generated_queries:
            generated_queries.append(primary_query)

        # Kueri 2: Kueri mekanisme & farmakologi
        mech_terms = []
        if any(w in q_lower for w in ["efek", "samping", "bahaya", "toksik", "adverse", "side effect", "safety"]):
            mech_terms.append("adverse effects safety")
        if any(w in q_lower for w in ["mekanisme", "cara kerja", "mechanism", "action"]):
            mech_terms.append("mechanism of action pharmacology")
        if any(w in q_lower for w in ["dosis", "aturan pakai", "dosage", "dose", "administer"]):
            mech_terms.append("dosage administration clinical")
        if any(w in q_lower for w in ["hamil", "kandungan", "pregnancy", "pregnant", "lactation"]):
            mech_terms.append("pregnancy safety")
        if any(w in q_lower for w in ["anak", "pediatric", "children"]):
            mech_terms.append("pediatric clinical outcomes")
        if any(w in q_lower for w in ["lansia", "geriatric", "elderly"]):
            mech_terms.append("geriatric elderly pharmacology")

        if mech_terms:
            variant_2 = f"{primary_query} {' '.join(mech_terms)}".strip()
            if variant_2 not in generated_queries:
                generated_queries.append(variant_2)
        else:
            variant_2 = f"{primary_query} pharmacology clinical trial"
            if variant_2 not in generated_queries:
                generated_queries.append(variant_2)

        # Kueri 3: Kueri meta-analisis / systematic review / evidence synthesis
        variant_3 = f"{primary_query} systematic review meta-analysis"
        if variant_3 not in generated_queries:
            generated_queries.append(variant_3)

        # Kueri 4: Kueri obat / terapi jika relevan
        if len(generated_queries) < 4:
            variant_4 = f"{primary_query} clinical guidelines therapy"
            if variant_4 not in generated_queries:
                generated_queries.append(variant_4)

        # Batasi antara 2 hingga 4 kueri
        return generated_queries[:4]
