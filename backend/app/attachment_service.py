import io
import base64
import logging
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Dict, Any, List, Optional, Tuple
import fitz  # PyMuPDF

logger = logging.getLogger("epiona.attachment_service")

class AttachmentProcessor:
    """Pemroses lampiran dokumen & gambar untuk Grounded Multi-Modal Chat."""

    @staticmethod
    def parse_data_url(data_str: str) -> Tuple[str, Optional[str]]:
        """Memisahkan prefix data URL jika ada (e.g. data:image/png;base64,...) dan mengembalikan (base64_murni, mime_type)."""
        if not data_str:
            return "", None
        data_str = data_str.strip()
        if data_str.startswith("data:") and ";base64," in data_str:
            parts = data_str.split(";base64,", 1)
            mime = parts[0].replace("data:", "").strip()
            return parts[1].strip(), mime
        return data_str, None

    @classmethod
    def process_attachment(cls, filename: str, file_type: str, data_base64: Optional[str]) -> Dict[str, Any]:
        """
        Memproses satu file lampiran:
        - Jika gambar: disiapkan untuk input visual multimodal.
        - Jika dokumen (PDF, Word, TXT): teks diekstrak untuk konteks grounding.
        """
        clean_b64, detected_mime = cls.parse_data_url(data_base64 or "")
        mime = detected_mime or file_type or "application/octet-stream"
        ext = Path(filename).suffix.lower()

        result: Dict[str, Any] = {
            "filename": filename,
            "ext": ext,
            "mime_type": mime,
            "is_image": False,
            "base64_data": clean_b64,
            "extracted_text": "",
            "error": None
        }

        # Cek apakah tipe gambar
        image_extensions = {".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp"}
        if mime.startswith("image/") or ext in image_extensions:
            result["is_image"] = True
            if not mime.startswith("image/"):
                if ext in {".jpg", ".jpeg"}:
                    result["mime_type"] = "image/jpeg"
                elif ext == ".png":
                    result["mime_type"] = "image/png"
                elif ext == ".webp":
                    result["mime_type"] = "image/webp"
                else:
                    result["mime_type"] = "image/png"
            return result

        if not clean_b64:
            result["error"] = "Data berkas kosong."
            return result

        try:
            file_bytes = base64.b64decode(clean_b64)
        except Exception as e:
            result["error"] = f"Gagal mendekode base64: {e}"
            return result

        # 1. Dokumen PDF
        if ext == ".pdf" or mime == "application/pdf":
            try:
                doc = fitz.open(stream=file_bytes, filetype="pdf")
                pages_text = []
                for idx, page in enumerate(doc):
                    page_num = idx + 1
                    t = page.get_text("text").strip()
                    if t:
                        pages_text.append(f"[Halaman {page_num}]\n{t}")
                doc.close()
                result["extracted_text"] = "\n\n".join(pages_text)
                if not result["extracted_text"]:
                    result["extracted_text"] = "[Dokumen PDF ini tidak memuat teks digital / berisi pindaian gambar]."
            except Exception as e:
                logger.error(f"Gagal mengekstrak PDF {filename}: {e}")
                result["error"] = f"Gagal membaca PDF: {e}"

        # 2. Dokumen Word DOCX
        elif ext in {".docx", ".doc"}:
            try:
                with zipfile.ZipFile(io.BytesIO(file_bytes)) as z:
                    if "word/document.xml" in z.namelist():
                        xml_content = z.read("word/document.xml")
                        tree = ET.fromstring(xml_content)
                        ns = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
                        paragraphs = []
                        for p in tree.iter(f"{ns}p"):
                            texts = [t.text for t in p.iter(f"{ns}t") if t.text]
                            if texts:
                                paragraphs.append("".join(texts))
                        result["extracted_text"] = "\n".join(paragraphs)
                    else:
                        result["extracted_text"] = "[Format berkas Word lama .doc biner atau struktur XML tidak standar]."
            except Exception as e:
                logger.error(f"Gagal mengekstrak Word DOCX {filename}: {e}")
                result["error"] = f"Gagal membaca berkas Word: {e}"

        # 3. Teks biasa, CSV, JSON, Markdown
        elif ext in {".txt", ".csv", ".tsv", ".md", ".json", ".log"} or mime.startswith("text/"):
            try:
                result["extracted_text"] = file_bytes.decode("utf-8", errors="replace")
            except Exception as e:
                result["error"] = f"Gagal membaca berkas teks: {e}"

        else:
            # Fallback membaca string teks jika memungkinkan
            try:
                decoded = file_bytes.decode("utf-8", errors="ignore")
                if len(decoded.strip()) > 20:
                    result["extracted_text"] = decoded
                else:
                    result["extracted_text"] = f"[Format berkas {ext} belum didukung untuk ekstraksi teks otomatis]."
            except Exception:
                result["extracted_text"] = f"[Format berkas {ext} tidak dapat diekstrak]."

        return result
