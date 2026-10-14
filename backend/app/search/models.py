import re
from abc import ABC, abstractmethod
from typing import List, Optional, Literal, Dict, Any
from pydantic import BaseModel, Field

def classify_evidence_level(
    pub_types: Optional[List[str]] = None,
    title: str = "",
    text: str = ""
) -> str:
    """
    Klasifikasi derajat bukti ilmiah EBM (Evidence-Based Medicine).
    1. PRIORITAS UTAMA: Tipe publikasi resmi (MeSH PublicationType / S2 publicationTypes / EuropePMC pubType).
       - Meta-Analysis -> 'meta_analysis'
       - Systematic Review -> 'systematic_review'
       - Review / Scoping Review -> 'review'
       - Practice Guideline / Consensus -> 'guideline'
       - RCT / Clinical Trial -> 'rct'
       - Observational / Cohort / Case-Control -> 'observational'
    2. FALLBACK 1: Deteksi regex eksplisit pada JUDUL (title).
    3. FALLBACK 2: Deteksi regex eksplisit pada ABSTRAK/TEKS (text).
    Default jika tidak terdeteksi spesifik: 'journal'.
    """
    # 1. Prioritas Utama: Evaluasi pub_types resmi dari provider
    if pub_types:
        norm_types = [re.sub(r"[\s_-]+", " ", str(pt).strip().lower()) for pt in pub_types if pt]

        # a. Meta-Analysis
        if any("meta analysis" in pt or "meta-analysis" in pt or "metaanalysis" in pt for pt in norm_types):
            return "meta_analysis"

        # b. Systematic Review
        if any("systematic review" in pt or "systematic literature review" in pt for pt in norm_types):
            return "systematic_review"

        # c. Practice Guideline / Consensus
        if any(
            pt in ("practice guideline", "guideline", "consensus development conference", "consensus")
            or "guideline" in pt
            for pt in norm_types
        ):
            return "guideline"

        # d. Review (Umum / Naratif / Scoping)
        # Evaluasi sebelum RCT agar review tentang RCT tidak salah dilabeli sebagai RCT
        if any(
            pt in ("review", "scoping review", "scientific integrity review")
            or "review" in pt
            for pt in norm_types
        ):
            return "review"

        # e. RCT / Clinical Trial
        if any(
            pt in (
                "randomized controlled trial", "randomised controlled trial",
                "controlled clinical trial", "clinical trial", "pragmatic clinical trial",
                "clinicaltrial", "clinical trial, phase i", "clinical trial, phase ii",
                "clinical trial, phase iii", "clinical trial, phase iv"
            )
            or "randomized" in pt
            or "randomised" in pt
            or "clinical trial" in pt
            for pt in norm_types
        ):
            return "rct"

        # f. Observational / Cohort / Case-Control
        if any(
            pt in (
                "observational study", "cohort studies", "case-control studies",
                "comparative study", "multicenter study"
            )
            or "observational" in pt
            or "cohort" in pt
            for pt in norm_types
        ):
            return "observational"

    # 2. Fallback 1: Cek Judul Publikasi
    if title:
        t_lower = title.lower()
        if re.search(r"\bmeta[- ]analysis\b", t_lower):
            return "meta_analysis"
        if re.search(r"\bsystematic (?:literature )?review\b", t_lower):
            return "systematic_review"
        if re.search(r"\b(?:practice )?guideline|consensus (?:statement|conference)\b", t_lower):
            return "guideline"
        if re.search(r"\b(?:a )?scoping review\b|\bliterature review\b|\bnarrative review\b|\bstate of the art review\b|\bclinical review\b|\bannual review\b", t_lower):
            return "review"
        if re.search(r"\brandomized controlled trial\b|\brandomised controlled trial\b|\bplacebo[- ]controlled\b|\bdouble[- ]blind trial\b|\bclinical trial phase\b", t_lower):
            return "rct"
        if re.search(r"\bcohort study\b|\bobservational study\b|\bcase[- ]control study\b|\bprospective cohort\b|\bretrospective cohort\b", t_lower):
            return "observational"
        if re.search(r"\breview\b", t_lower) and not re.search(r"\btrial\b", t_lower):
            return "review"

    # 3. Fallback 2: Cek Teks Abstrak
    if text:
        txt_lower = text.lower()
        if re.search(r"\bmeta[- ]analysis\b", txt_lower) and not re.search(r"\bprotocol for a meta-analysis\b", txt_lower):
            return "meta_analysis"
        if re.search(r"\bsystematic review\b", txt_lower) and not re.search(r"\bprotocol for a systematic review\b", txt_lower):
            return "systematic_review"
        if re.search(r"\bclinical practice guideline\b|\bpractice guideline\b", txt_lower):
            return "guideline"
        if re.search(r"\brandomized controlled trial\b|\brandomised controlled trial\b", txt_lower):
            return "rct"
        if re.search(r"\bcohort study\b|\bcase[- ]control study\b|\bobservational study\b", txt_lower):
            return "observational"
        if re.search(r"\bthis review (?:aims|summarizes|provides|analyzes)\b|\bwe review\b", txt_lower):
            return "review"

    return "journal"


class SearchResult(BaseModel):
    title: str = Field(description="Judul publikasi, label obat, atau halaman web")
    url: str = Field(description="URL resmi publikasi atau dokumen rujukan")
    snippet: str = Field(description="Abstrak atau ringkasan temuan bukti faktual")
    full_text: Optional[str] = Field(default=None, description="Teks lengkap naskah ilmiah/dokumen jika tersedia")
    source_type: Literal["journal", "label", "web", "document"] = Field(
        default="journal",
        description="Kategori sumber rujukan: journal, label, web, atau document"
    )
    year: Optional[int] = Field(default=None, description="Tahun publikasi")
    authors: List[str] = Field(default_factory=list, description="Daftar nama penulis")
    doi: Optional[str] = Field(default=None, description="Digital Object Identifier (DOI)")
    evidence_level: Optional[str] = Field(
        default=None,
        description="Klasifikasi bukti klinis/EBM (meta_analysis, systematic_review, rct, observational, review, drug_label, web, guideline)"
    )
    journal: Optional[str] = Field(default=None, description="Nama jurnal ilmiah atau basis data penerbit")
    pdf_url: Optional[str] = Field(default=None, description="Tautan langsung unduhan naskah PDF open access")
    score: float = Field(default=0.0, description="Skor gabungan relevansi, bobot bukti ilmiah, dan kebaruan")
    result_id: Optional[int] = Field(default=None, description="Indeks sitasi 1-based [n]")


class BaseSearchProvider(ABC):
    """Antarmuka seragam untuk seluruh penyedia penelusuran literatur dan web."""

    @property
    @abstractmethod
    def name(self) -> str:
        """Nama pengenal unik provider (misal: pubmed, semantic_scholar)."""
        pass

    @abstractmethod
    async def search(self, query: str, limit: int = 5) -> List[SearchResult]:
        """Eksekusi pencarian asinkron dengan pengembalian daftar SearchResult."""
        pass
