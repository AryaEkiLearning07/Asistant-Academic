import logging
import re
from typing import List, Set, Dict, Optional
from app.academic_service import AcademicRetrieverService

logger = logging.getLogger(__name__)

class SearchRouter:
    """
    Router cerdas untuk:
    1. Mengklasifikasikan apakah pertanyaan membutuhkan penelusuran (search) atau obrolan ringan.
    2. Mengekstrak entitas obat (drug entity extraction) dengan fallback non-LLM (kamus & regex).
    3. Menerjemahkan pertanyaan ke Bahasa Inggris Ilmiah dengan fallback non-LLM (kamus ID->EN).
    4. Menulis ulang kueri (query rewriting) menjadi 2-4 kueri terfokus yang mempertahankan
       entitas obat kunci untuk pencarian multi-provider berpresisi tinggi.
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

    # Kamus entitas obat baku (Bahasa Indonesia & Internasional)
    KNOWN_DRUGS: Set[str] = {
        "warfarin", "aspirin", "clopidogrel", "rivaroxaban", "apixaban", "dabigatran", "heparin", "enoxaparin",
        "amlodipine", "nifedipine", "diltiazem", "verapamil", "lisinopril", "ramipril", "captopril", "enalapril",
        "losartan", "valsartan", "candesartan", "telmisartan", "bisoprolol", "metoprolol", "atenolol", "propranolol",
        "carvedilol", "furosemide", "spironolactone", "hydrochlorothiazide", "metformin", "insulin", "glimepiride",
        "gliclazide", "empagliflozin", "dapagliflozin", "sitagliptin", "vildagliptin", "acarbose", "pioglitazone",
        "atorvastatin", "simvastatin", "rosuvastatin", "pravastatin", "fenofibrate", "gemfibrozil", "ezetimibe",
        "paracetamol", "acetaminophen", "ibuprofen", "ketorolac", "meloxicam", "celecoxib", "diclofenac",
        "naproxen", "indomethacin", "tramadol", "morphine", "codeine", "fentanyl", "amoxicillin", "ampicillin",
        "ciprofloxacin", "levofloxacin", "moxifloxacin", "azithromycin", "erythromycin", "clarithromycin",
        "doxycycline", "gentamycin", "vancomycin", "ceftriaxone", "cefotaxime", "cefixime", "meropenem",
        "omeprazole", "lansoprazole", "pantoprazole", "esomeprazole", "ranitidine", "famotidine", "sucralfate",
        "dexamethasone", "methylprednisolone", "prednisone", "hydrocortisone", "triamcinolone", "budesonide",
        "fluticasone", "diazepam", "alprazolam", "lorazepam", "clonazepam", "midazolam", "sertraline",
        "fluoxetine", "escitalopram", "amitriptyline", "haloperidol", "risperidone", "quetiapine", "olanzapine",
        "sildenafil", "tadalafil", "allopurinol", "febuxostat", "colchicine", "methotrexate", "cyclosporine",
        "tacrolimus", "ibrutinib", "mefenamic acid"
    }

    # Pemetaan alias nama obat lokal/spesifik ke nama generik internasional
    DRUG_ALIASES: Dict[str, str] = {
        "asam mefenamat": "mefenamic acid",
        "asam asetilsalisilat": "aspirin",
        "parasetamol": "paracetamol",
        "asetaminofen": "acetaminophen",
        "amoksisilin": "amoxicillin",
        "ampisilin": "ampicillin",
        "siprofloksasin": "ciprofloxacin",
        "levofloksasin": "levofloxacin",
        "moksifloksasin": "moxifloxacin",
        "azitromisin": "azithromycin",
        "eritromisin": "erythromycin",
        "doksisiklin": "doxycycline",
        "gentamisin": "gentamycin",
        "vankomisin": "vancomycin",
        "seftriakson": "ceftriaxone",
        "sefotaksim": "cefotaxime",
        "sefiksim": "cefixime",
        "omeprasol": "omeprazole",
        "lansoprasol": "lansoprazole",
        "pantoprasol": "pantoprazole",
        "deksametason": "dexamethasone",
        "metilprednisolon": "methylprednisolone",
        "prednison": "prednisone",
        "klindamisin": "clindamycin",
        "simpastatin": "simvastatin",
        "atorpastatin": "atorvastatin",
    }

    # Suffix pola farmakologis obat (Stemming / Pattern Matching)
    DRUG_SUFFIX_PATTERN = re.compile(
        r"\b[a-z]{3,}(?:statin|olol|pril|sartan|dipine|prazole|tidine|floxacin|cillin|mycin|cycline|xaban|parin|mab|nib|asone|olone|zepam|zolam|gliflozin|gliptin|triptan)\b",
        re.IGNORECASE
    )

    # Kamus Fallback Terjemahan Non-LLM (Frasa Medis ID -> EN)
    MEDICAL_PHRASES_MAP: Dict[str, str] = {
        "efek samping": "adverse effects",
        "efek sampingan": "adverse effects",
        "reaksi merugikan": "adverse reactions",
        "cara kerja": "mechanism of action",
        "aturan pakai": "dosage administration",
        "tata laksana": "clinical management",
        "ibu hamil": "pregnancy",
        "wanita hamil": "pregnancy",
        "pasien hamil": "pregnancy",
        "orang tua": "elderly",
        "usia lanjut": "elderly geriatric",
        "gangguan fungsi ginjal": "renal impairment",
        "gangguan ginjal": "renal impairment",
        "gagal ginjal": "renal failure",
        "gagal jantung": "heart failure",
        "tekanan darah tinggi": "hypertension",
        "tekanan darah": "blood pressure",
        "gula darah tinggi": "hyperglycemia",
        "gula darah": "blood glucose",
        "kencing manis": "diabetes mellitus",
        "diabetes melitus tipe 2": "type 2 diabetes mellitus",
        "diabetes melitus": "diabetes mellitus",
        "diabetes tipe 2": "type 2 diabetes",
        "radang sendi": "arthritis",
        "batu ginjal": "kidney stones",
        "risiko perdarahan": "bleeding risk",
        "risiko pendarahan": "bleeding risk",
        "bahaya perdarahan": "bleeding risk",
    }

    # Kamus Fallback Terjemahan Non-LLM (Kata Satuan Medis ID -> EN)
    MEDICAL_WORDS_MAP: Dict[str, str] = {
        "interaksi": "interaction",
        "dengan": "with",
        "dan": "and",
        "risiko": "risk",
        "bahaya": "risk",
        "perdarahan": "bleeding",
        "pendarahan": "bleeding",
        "darah": "blood",
        "ginjal": "renal",
        "hati": "hepatic",
        "jantung": "cardiac",
        "paru": "pulmonary",
        "otak": "cerebral",
        "lansia": "elderly",
        "anak": "pediatric",
        "anak-anak": "pediatric",
        "bayi": "infant",
        "hamil": "pregnancy",
        "kehamilan": "pregnancy",
        "menyusui": "lactation",
        "kontraindikasi": "contraindication",
        "indikasi": "indication",
        "dosis": "dosage",
        "efektivitas": "efficacy",
        "keamanan": "safety",
        "mekanisme": "mechanism",
        "toksisitas": "toxicity",
        "penyakit": "disease",
        "infeksi": "infection",
        "peradangan": "inflammation",
        "inflamasi": "inflammation",
        "nyeri": "pain",
        "pencegahan": "prevention",
        "pengobatan": "treatment",
        "terapi": "therapy",
        "farmakologi": "pharmacology",
        "versus": "versus",
        "lawan": "versus",
        "dibandingkan": "compared to",
        "pada": "in",
        "untuk": "for",
        "antara": "between",
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
    def extract_drug_entities(cls, text: str) -> List[str]:
        """
        Mengekstrak entitas nama obat secara deterministik (non-LLM fallback):
        1. Cek pemetaan alias obat lokal (misal 'asam mefenamat' -> 'mefenamic acid').
        2. Cek kamus obat baku KNOWN_DRUGS.
        3. Cek pola akhiran farmakologis (suffix regex: -statin, -olol, -pril, dll).
        Mengembalikan daftar nama obat unik dalam urutan kemunculannya.
        """
        if not text:
            return []

        t_lower = text.lower()
        detected: List[str] = []
        seen = set()

        def add_drug(drug_name: str):
            clean_name = drug_name.strip().lower()
            if clean_name and clean_name not in seen:
                seen.add(clean_name)
                detected.append(clean_name)

        # 1. Deteksi alias multi-kata / kata spesifik terlebih dahulu
        for alias, standard_name in cls.DRUG_ALIASES.items():
            if re.search(rf"\b{re.escape(alias)}\b", t_lower):
                add_drug(standard_name)

        # 2. Tokenisasi kata
        tokens = re.findall(r"\b[a-zA-Z0-9-]+\b", t_lower)
        for token in tokens:
            if token in cls.KNOWN_DRUGS:
                add_drug(token)
            elif cls.DRUG_SUFFIX_PATTERN.match(token):
                add_drug(token)

        return detected

    @classmethod
    def translate_to_english_fallback(cls, text: str) -> str:
        """
        Menerjemahkan kueri ke bahasa Inggris ilmiah:
        1. Coba penerjemah endpoint cepat via AcademicRetrieverService.
        2. Jika offline / gagal / mengembalikan teks Indonesia, gunakan kamus frasa dan kata medis lokal.
        """
        if not text or not text.strip():
            return ""

        raw_translated = AcademicRetrieverService.translate_to_english(text)

        # Deteksi apakah hasil terjemahan masih memuat kata-kata kunci bahasa Indonesia
        indonesian_markers = [
            "interaksi", "perdarahan", "pendarahan", "dengan", "dan", "risiko", "ginjal",
            "lansia", "hamil", "menyusui", "dosis", "fungsi", "gangguan", "efek", "samping"
        ]
        has_id_markers = any(re.search(rf"\b{m}\b", raw_translated.lower()) for m in indonesian_markers)

        # Jika masih ada istilah Indonesia atau penerjemah tidak mengubah teks asli
        if has_id_markers or raw_translated.strip().lower() == text.strip().lower():
            processed = text.lower()
            # Ganti frasa medis dulu
            for phr, trans in cls.MEDICAL_PHRASES_MAP.items():
                processed = re.sub(rf"\b{re.escape(phr)}\b", trans, processed)
            # Ganti kata satuan
            tokens = re.findall(r"\b[a-zA-Z0-9-]+\b", processed)
            replaced_tokens = []
            for tok in tokens:
                if tok in cls.MEDICAL_WORDS_MAP:
                    replaced_tokens.append(cls.MEDICAL_WORDS_MAP[tok])
                elif tok in cls.DRUG_ALIASES:
                    replaced_tokens.append(cls.DRUG_ALIASES[tok])
                else:
                    replaced_tokens.append(tok)
            return " ".join(replaced_tokens).strip()

        return raw_translated.strip()

    @classmethod
    def rewrite_queries(cls, question: str) -> List[str]:
        """
        Menulis ulang kueri pengguna menjadi 2-4 kueri presisi berbahasa Inggris ilmiah.
        Wajib mengekstrak entitas obat dan menyertakannya di SEMUA variasi kueri untuk
        menjamin relevansi dan mencegah hasil menyimpang.
        """
        if not question or not question.strip():
            return []

        q_clean = question.strip()
        q_lower = q_clean.lower()
        generated_queries: List[str] = []

        # 1. Cek akronim medis spesifik
        for acr, expansion in cls.ACRONYM_MAP.items():
            if re.search(rf"\b{acr}\b", q_lower):
                generated_queries.append(expansion)
                break

        # 2. Ekstraksi entitas obat
        detected_drugs = cls.extract_drug_entities(q_clean)

        # 3. Terjemahkan ke Bahasa Inggris Ilmiah (dengan fallback kamus lokal)
        translated_en = cls.translate_to_english_fallback(q_clean)
        clean_en = re.sub(r"[^\w\s-]", " ", translated_en).lower()

        # Stopwords pertanyaan umum bahasa Inggris
        stopwords = {
            "what", "is", "are", "the", "a", "an", "of", "for", "in", "to", "does", "do", "how",
            "can", "could", "should", "would", "tell", "me", "about", "explain", "please", "why",
            "which", "when", "where", "safe", "drug", "medicine", "medication", "patient", "patients",
            "give", "show", "antara", "pada", "dan", "dengan"
        }
        tokens = [t for t in clean_en.split() if t not in stopwords and len(t) > 2]

        if detected_drugs:
            # Pastikan semua entitas obat berada di posisi terdepan
            drug_str = " ".join(detected_drugs)
            other_terms = [t for t in tokens if t not in detected_drugs]
            context_str = " ".join(other_terms[:4])

            # Kueri 1: Kueri primer (entitas obat + konteks klinis penting)
            q1 = f"{drug_str} {context_str}".strip()
            if q1 not in generated_queries:
                generated_queries.append(q1)

            # Kueri 2: Kueri efek merugikan / interaksi / farmakologi
            if any(w in q_lower for w in ["interaksi", "interaction"]):
                q2 = f"{drug_str} drug interaction adverse effects"
            elif any(w in q_lower for w in ["efek", "samping", "bahaya", "toksik", "adverse", "side effect", "safety"]):
                q2 = f"{drug_str} adverse effects safety"
            elif any(w in q_lower for w in ["dosis", "aturan pakai", "dosage", "dose", "administer"]):
                q2 = f"{drug_str} dosage administration"
            elif any(w in q_lower for w in ["ginjal", "renal", "kidney"]):
                q2 = f"{drug_str} renal impairment pharmacokinetics"
            elif any(w in q_lower for w in ["hamil", "pregnancy", "menyusui", "lactation"]):
                q2 = f"{drug_str} pregnancy safety lactation"
            else:
                q2 = f"{drug_str} pharmacology clinical trial"

            if q2 not in generated_queries:
                generated_queries.append(q2)

            # Kueri 3: Kueri sintesis bukti (systematic review / meta-analysis)
            topic_hint = "bleeding" if any(w in q_lower for w in ["darah", "perdarahan", "pendarahan", "bleeding"]) else "clinical"
            q3 = f"{drug_str} {topic_hint} systematic review meta-analysis"
            if q3 not in generated_queries:
                generated_queries.append(q3)

            # Kueri 4: Kueri pedoman klinis / luaran keselamatan
            q4 = f"{drug_str} clinical guidelines safety outcomes"
            if len(generated_queries) < 4 and q4 not in generated_queries:
                generated_queries.append(q4)

        else:
            # Tidak ada entitas obat eksplisit: kueri topik ilmiah umum
            core_keywords = " ".join(tokens[:5]) if tokens else clean_en[:40]
            if core_keywords and core_keywords not in generated_queries:
                generated_queries.append(core_keywords)

            v2 = f"{core_keywords} pharmacology clinical trial"
            if v2 not in generated_queries:
                generated_queries.append(v2)

            v3 = f"{core_keywords} systematic review meta-analysis"
            if v3 not in generated_queries:
                generated_queries.append(v3)

            v4 = f"{core_keywords} clinical guidelines therapy"
            if len(generated_queries) < 4 and v4 not in generated_queries:
                generated_queries.append(v4)

        return generated_queries[:4]
