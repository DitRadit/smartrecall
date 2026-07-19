"""
pdf_extractor.py - Ekstraksi teks dari file PDF menggunakan pdfplumber.
Tidak butuh koneksi internet. Murni pemrosesan file lokal.
"""

import logging
import pdfplumber

logger = logging.getLogger("ai-service.pdf_extractor")


class PDFExtractionError(Exception):
    """Dilempar saat file PDF gagal dibuka atau tidak mengandung teks yang bisa diekstrak."""
    pass


def _should_skip_page(text: str, page_number: int) -> bool:
    """
    Menentukan apakah halaman PDF harus dilewati karena terdeteksi sebagai halaman non-materi
    (seperti halaman sampul, hak cipta/disclaimer penerbit, prakata/kata pengantar, atau daftar isi).
    """
    text_lower = text.lower().strip()
    if not text_lower:
        return True

    # 1. Deteksi halaman hak cipta / metadata penerbit / ISBN (hanya pada 15 halaman pertama)
    if page_number <= 15:
        copyright_indicators = [
            "sanksi pelanggaran pasal",
            "sanksi pelanggaran undang-undang",
            "uu no 28 tahun 2014",
            "uu nomor 28 tahun 2014",
            "undang-undang nomor 28 tahun 2014",
            "undang-undang hak cipta",
            "dilarang keras menerjemahkan",
            "dilarang memperbanyak",
            "dilarang mengutip",
            "tanpa izin tertulis dari penerbit",
            "hak cipta dilindungi",
            "all rights reserved",
            "tata letak:",
            "desain cover:",
            "desain sampul:",
            "editor:",
            "penyunting:",
            "isbn:",
            "e-isbn:",
            "anggota ikapi",
            "diterbitkan oleh",
            "www.penerbit",
        ]
        if any(ind in text_lower for ind in copyright_indicators):
            return True

        # 2. Deteksi Kata Pengantar / Prakata / Daftar Isi di halaman awal
        lines = [line.strip() for line in text_lower.split('\n') if line.strip()]
        if lines:
            first_few_lines = " ".join(lines[:3])
            header_indicators = [
                "daftar isi",
                "prakata",
                "kata pengantar",
            ]
            if any(ind in first_few_lines for ind in header_indicators):
                return True

            # 3. Deteksi halaman dengan nomor halaman Romawi di baris pertama/terakhir (i, ii, iii, iv, dst.)
            # Halaman awal (prakata, daftar isi) sering memakai nomor halaman romawi di bagian atas/bawah
            romans = {"i", "ii", "iii", "iv", "v", "vi", "vii", "viii", "ix", "x", "xi", "xii", "xiii", "xiv", "xv"}
            first_line = lines[0].strip().lower()
            last_line = lines[-1].strip().lower()
            if first_line in romans or last_line in romans:
                return True

    # 4. Deteksi Daftar Pustaka / Tentang Penulis (bisa ada di halaman mana saja, biasanya di akhir)
    lines = [line.strip() for line in text_lower.split('\n') if line.strip()]
    if lines:
        first_few_lines = " ".join(lines[:3])
        if any(term in first_few_lines for term in ["daftar pustaka", "tentang penulis", "biodata penulis", "riwayat hidup penulis"]):
            return True

    return False


def extract_text_from_pdf(file_path: str) -> str:
    """
    Ekstrak seluruh teks dari file PDF, halaman demi halaman.

    Args:
        file_path: path lokal ke file PDF yang sudah disimpan di disk.

    Returns:
        Gabungan teks seluruh halaman, dipisahkan dengan newline ganda per halaman.

    Raises:
        PDFExtractionError: jika file tidak bisa dibuka atau tidak ada teks sama sekali.
    """
    pages_text = []

    try:
        with pdfplumber.open(file_path) as pdf:
            if len(pdf.pages) == 0:
                raise PDFExtractionError("File PDF tidak memiliki halaman.")

            for page_number, page in enumerate(pdf.pages, start=1):
                try:
                    text = page.extract_text() or ""
                except Exception as page_err:  # halaman individual boleh gagal tanpa membatalkan semua
                    logger.warning("Gagal ekstrak halaman %s: %s", page_number, page_err)
                    text = ""

                # Lewati jika halaman terdeteksi sebagai halaman non-materi
                if _should_skip_page(text, page_number):
                    logger.info("Halaman %s dilewati karena dideteksi sebagai halaman non-materi.", page_number)
                    continue

                pages_text.append(text.strip())
    except PDFExtractionError:
        raise
    except Exception as e:
        logger.exception("Gagal membuka file PDF: %s", file_path)
        raise PDFExtractionError(f"Gagal membuka/membaca file PDF: {e}") from e

    full_text = "\n\n".join(t for t in pages_text if t)

    if not full_text.strip():
        raise PDFExtractionError(
            "Tidak ada teks yang bisa diekstrak dari PDF ini "
            "(kemungkinan hasil scan/gambar tanpa OCR)."
        )

    return full_text
