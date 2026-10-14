from abc import ABC, abstractmethod
from typing import List, Optional, Literal, Dict, Any
from pydantic import BaseModel, Field

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
