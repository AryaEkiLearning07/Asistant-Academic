import fitz  # PyMuPDF
import uuid
import hashlib
from pathlib import Path
from typing import Dict, Any, List, Union
from app.config import FIGURES_DIR, THUMBNAILS_DIR, PAGES_DIR, JWT_SECRET, OCR_ENABLED

class PdfDocumentParser:
    """Parser dokumen PDF berbasis PyMuPDF yang mempertahankan nomor halaman, memotong gambar grafik, membuat thumbnail, mengekstrak tabel terstruktur, dan OCR opsional."""

    @staticmethod
    def _file_token(doc_id: str) -> str:
        """Token acak deterministik berbasis secret HMAC/SHA-256 agar nama file tidak bisa ditebak."""
        return hashlib.sha256(f"{doc_id}:{JWT_SECRET}".encode("utf-8")).hexdigest()[:12]

    @staticmethod
    def _extract_page_tables_structured(plumber_page, page_num: int) -> str:
        """Ekstraksi tabel menggunakan pdfplumber menjadi format teks markdown terstruktur."""
        try:
            tables = plumber_page.extract_tables()
            if not tables:
                return ""
            table_md_blocks = []
            for tbl_idx, tbl in enumerate(tables):
                clean_rows = []
                for row in tbl:
                    if not row or not any(row):
                        continue
                    clean_rows.append([str(cell or "").strip().replace("\n", " ") for cell in row])
                if clean_rows:
                    headers = clean_rows[0]
                    headers = [h if h else f"Col{i+1}" for i, h in enumerate(headers)]
                    header_line = "| " + " | ".join(headers) + " |"
                    separator_line = "| " + " | ".join(["---"] * len(headers)) + " |"
                    row_lines = ["| " + " | ".join(r) + " |" for r in clean_rows[1:]]
                    tbl_text = "\n".join([header_line, separator_line] + row_lines)
                    table_md_blocks.append(f"[Tabel {tbl_idx + 1} Halaman {page_num}]\n{tbl_text}")
            return "\n\n".join(table_md_blocks)
        except Exception:
            return ""

    @staticmethod
    def _ocr_page_if_needed(page, page_num: int) -> str:
        """OCR opsional menggunakan pytesseract jika halaman tidak memuat teks dan OCR_ENABLED aktif."""
        if not OCR_ENABLED:
            return ""
        try:
            import pytesseract
            from PIL import Image
            import io
            pix = page.get_pixmap(dpi=150)
            img_bytes = pix.tobytes("png")
            img = Image.open(io.BytesIO(img_bytes))
            ocr_text = pytesseract.image_to_string(img).strip()
            return ocr_text
        except Exception:
            return ""

    @staticmethod
    def parse_pdf(file_input: Union[bytes, Path, str], doc_id: str = "") -> Dict[str, Any]:
        """Ekstraksi teks per halaman dengan retensi nomor halaman fisik 1:1, thumbnail sampul, pemotongan gambar, ekstraksi tabel terstruktur, dan OCR opsional."""
        if isinstance(file_input, bytes):
            doc = fitz.open(stream=file_input, filetype="pdf")
        else:
            doc = fitz.open(str(file_input))

        # Inisialisasi pdfplumber opsional untuk ekstraksi tabel terstruktur
        plumber_doc = None
        try:
            import pdfplumber
            if isinstance(file_input, bytes):
                import io
                plumber_doc = pdfplumber.open(io.BytesIO(file_input))
            else:
                plumber_doc = pdfplumber.open(str(file_input))
        except Exception:
            plumber_doc = None

        total_pages = len(doc)
        pages = []
        figures = []
        doc_prefix = doc_id if doc_id else str(uuid.uuid4())[:8]
        file_sec_token = PdfDocumentParser._file_token(doc_prefix)

        # 1. Render thumbnail halaman 1 (snapshot tampilan fisik halaman pertama dengan token tak tertebak)
        thumbnail_filename = f"thumb_{doc_prefix}_{file_sec_token}.png"
        if total_pages > 0:
            try:
                page0 = doc[0]
                pix = page0.get_pixmap(dpi=110)
                thumb_path = THUMBNAILS_DIR / thumbnail_filename
                pix.save(str(thumb_path))
            except Exception:
                thumbnail_filename = ""


        # 2. Analisis frekuensi bounding box gambar di seluruh halaman (deteksi latar belakang slide / watermark berulang)
        from collections import Counter
        bbox_frequency = Counter()
        for p_idx in range(total_pages):
            try:
                for img_info in doc[p_idx].get_image_info():
                    b = tuple(round(x, 0) for x in img_info.get("bbox", ()))
                    if len(b) == 4:
                        bbox_frequency[b] += 1
            except Exception:
                pass

        # 3. Iterasi seluruh halaman teks dan ekstraksi potongan gambar riil (Screenshot cerdas)
        for page_idx in range(total_pages):
            page = doc[page_idx]
            page_num = page_idx + 1  # 1-indexed untuk sitasi akademik manusiawi
            text = page.get_text("text").strip()

            # Item E: Ekstraksi tabel pdfplumber ke teks terstruktur
            if plumber_doc and page_idx < len(plumber_doc.pages):
                tbl_structured = PdfDocumentParser._extract_page_tables_structured(
                    plumber_doc.pages[page_idx],
                    page_num
                )
                if tbl_structured:
                    text = f"{text}\n\n{tbl_structured}".strip() if text else tbl_structured

            # Item E: OCR opsional pytesseract jika halaman tanpa teks dan OCR_ENABLED aktif
            if not text:
                ocr_result = PdfDocumentParser._ocr_page_if_needed(page, page_num)
                if ocr_result:
                    text = ocr_result
            
            pages.append({
                "page_number": page_num,
                "text": text
            })

            # Dapatkan luas halaman fisik untuk filtering rasio
            p_rect = page.rect
            p_area = p_rect.width * p_rect.height if p_rect.width and p_rect.height else 1.0

            # Ekstraksi dan pemotongan gambar (kurva, bagan, diagram riil)
            image_info_list = []
            try:
                image_info_list = page.get_image_info()
            except Exception:
                image_info_list = []

            for img_idx, img_meta in enumerate(image_info_list):
                try:
                    bbox = img_meta.get("bbox")
                    if not bbox or len(bbox) != 4:
                        continue
                    b_rect = fitz.Rect(bbox)
                    b_key = tuple(round(x, 0) for x in bbox)

                    # 1. Filter: Elemen berulang pada posisi persis di >= 3 halaman (template background / header / watermark)
                    if bbox_frequency[b_key] >= 3:
                        continue

                    # 2. Filter: Gambar menutupi > 85% seluruh halaman (full-page wallpaper/blank raster)
                    img_area = b_rect.width * b_rect.height
                    if img_area > 0.85 * p_area:
                        continue

                    # 3. Filter: Dimensi terlalu kecil (ikon, bullet point, atau pemisah garis)
                    if b_rect.width < 70 or b_rect.height < 70:
                        continue

                    # 4. Potong gambar persis pada bounding box-nya dengan resolusi tajam (clip area ala Screenshot cerdas)
                    pix = page.get_pixmap(clip=b_rect, dpi=160)
                    if pix.width < 100 or pix.height < 100:
                        continue

                    fig_filename = f"fig_{doc_prefix}_{file_sec_token}_p{page_num}_{img_idx + 1}.png"
                    fig_path = FIGURES_DIR / fig_filename
                    pix.save(str(fig_path))


                    # 5. Ekstraksi Caption Kontekstual Berbasis Kedekatan Geometris (Proximity Captioning)
                    blocks = page.get_text("blocks")
                    nearby_captions = []
                    for b in blocks:
                        b_text = b[4].strip() if len(b) > 4 else ""
                        if not b_text or len(b_text) < 3:
                            continue
                        # Abaikan jika hanya berupa nomor halaman atau kata tunggal seperti "Bab III"
                        if b_text.isdigit() or (len(b_text.splitlines()) == 1 and b_text.lower().startswith("bab ")):
                            continue

                        b_box = fitz.Rect(b[:4])
                        # Blok teks di atas gambar (maksimal jarak 90pt)
                        if b_box.y1 <= b_rect.y0 + 15 and (b_rect.y0 - b_box.y1) < 90:
                            dist = b_rect.y0 - b_box.y1
                            first_line = b_text.splitlines()[0].strip()
                            nearby_captions.append((dist, first_line))
                        # Blok teks di bawah gambar (maksimal jarak 90pt)
                        elif b_box.y0 >= b_rect.y1 - 15 and (b_box.y0 - b_rect.y1) < 90:
                            dist = b_box.y0 - b_rect.y1
                            first_line = b_text.splitlines()[0].strip()
                            nearby_captions.append((dist, first_line))

                    # Urutkan berdasarkan jarak terdekat ke gambar
                    nearby_captions.sort(key=lambda x: x[0])
                    if nearby_captions:
                        caption_snippet = nearby_captions[0][1][:120]
                    else:
                        # Fallback baris pertama dari teks halaman
                        first_line = text.splitlines()[0].strip() if text else ""
                        caption_snippet = first_line[:100] if first_line else f"Gambar pada Halaman {page_num}"

                    figures.append({
                        "page_number": page_num,
                        "figure_index": img_idx + 1,
                        "image_filename": fig_filename,
                        "caption": caption_snippet
                    })
                except Exception:
                    continue

        if plumber_doc:
            try:
                plumber_doc.close()
            except Exception:
                pass

        doc.close()
        return {
            "total_pages": total_pages,
            "pages": pages,
            "figures": figures,
            "thumbnail_filename": thumbnail_filename
        }

    @staticmethod
    def render_page_thumbnail(pdf_path: Path, doc_id: str, page_num: int) -> str:
        """Render thumbnail halaman spesifik beresolusi 72 DPI dan simpan ke THUMBNAILS_DIR untuk sidebar thumbnail Google Drive."""
        token = PdfDocumentParser._file_token(doc_id)
        thumb_filename = f"thumb_{doc_id}_{token}_p{page_num}.png"
        legacy_filename = f"thumb_{doc_id}_p{page_num}.png"
        thumb_path = THUMBNAILS_DIR / thumb_filename
        if thumb_path.exists():
            return thumb_filename
        if (THUMBNAILS_DIR / legacy_filename).exists():
            return legacy_filename
        try:
            if pdf_path.exists():
                doc = fitz.open(str(pdf_path))
                if 1 <= page_num <= len(doc):
                    page = doc[page_num - 1]
                    pix = page.get_pixmap(dpi=72)
                    pix.save(str(thumb_path))
                    doc.close()
                    return thumb_filename
                doc.close()
        except Exception:
            pass
        return ""

    @staticmethod
    def render_page_image(pdf_path: Path, doc_id: str, page_num: int, dpi: int = 150) -> str:
        """Render lembaran fisik halaman dokumen beresolusi tinggi (150 DPI) untuk tampilan kertas lembaran langsung di Workspace."""
        token = PdfDocumentParser._file_token(doc_id)
        page_filename = f"page_{doc_id}_{token}_p{page_num}.png"
        legacy_filename = f"page_{doc_id}_p{page_num}.png"
        page_path = PAGES_DIR / page_filename
        if page_path.exists():
            return page_filename
        if (PAGES_DIR / legacy_filename).exists():
            return legacy_filename
        try:
            if pdf_path.exists():
                doc = fitz.open(str(pdf_path))
                if 1 <= page_num <= len(doc):
                    page = doc[page_num - 1]
                    pix = page.get_pixmap(dpi=dpi)
                    pix.save(str(page_path))
                    doc.close()
                    return page_filename
                doc.close()
        except Exception as e:
            pass
        return ""

    @staticmethod
    def ensure_thumbnail(pdf_path: Path, doc_id: str) -> str:
        """Pastikan thumbnail halaman 1 ada di disk. Jika belum, render langsung dari file PDF."""
        token = PdfDocumentParser._file_token(doc_id)
        thumb_filename = f"thumb_{doc_id}_{token}.png"
        legacy_filename = f"thumb_{doc_id}.png"
        thumb_path = THUMBNAILS_DIR / thumb_filename
        if thumb_path.exists():
            return thumb_filename
        if (THUMBNAILS_DIR / legacy_filename).exists():
            return legacy_filename
        try:
            if pdf_path.exists():
                doc = fitz.open(str(pdf_path))
                if len(doc) > 0:
                    pix = doc[0].get_pixmap(dpi=110)
                    pix.save(str(thumb_path))
                    doc.close()
                    return thumb_filename
                doc.close()
        except Exception:
            pass
        return ""

