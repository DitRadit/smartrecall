"""
Unit test dasar untuk pdf_extractor.py.
"""

import sys
import os
import pytest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from services.pdf_extractor import extract_text_from_pdf, PDFExtractionError, _should_skip_page


def test_extract_text_from_nonexistent_file_raises_error():
    with pytest.raises(PDFExtractionError):
        extract_text_from_pdf("/path/yang/tidak/ada.pdf")


def test_should_skip_page_blank():
    assert _should_skip_page("", 1) is True
    assert _should_skip_page("   \n  \t ", 2) is True


def test_should_skip_page_copyright():
    copyright_text = "UU No 28 tahun 2014 tentang Hak Cipta\nSanksi Pelanggaran Pasal 113"
    assert _should_skip_page(copyright_text, 3) is True
    
    publisher_text = "Penerbit CV. Media Sains Indonesia\nAnggota IKAPI"
    assert _should_skip_page(publisher_text, 4) is True


def test_should_skip_page_preface_and_toc():
    preface_text = "PRAKATA\nPuji dan syukur saya panjatkan..."
    assert _should_skip_page(preface_text, 6) is True
    
    toc_text = "DAFTAR ISI\nBab 1 Bilangan Bulat... 1"
    assert _should_skip_page(toc_text, 8) is True


def test_should_skip_page_roman_numerals():
    roman_text = "ii\npenulis menyadari pula bahwa buku ini dapat..."
    assert _should_skip_page(roman_text, 7) is True


def test_should_skip_page_ending_matter():
    references_text = "DAFTAR PUSTAKA\nAbdurahman, Maman. 2011. Dasar-dasar..."
    assert _should_skip_page(references_text, 103) is True
    
    author_text = "Tentang Penulis\nBernadeta Ritawati lahir di..."
    assert _should_skip_page(author_text, 118) is True


def test_should_not_skip_normal_content():
    normal_text = "BAB 1 BILANGAN BULAT & BILANGAN PECAHAN\nA. Bilangan Bulat\nPengertian Bilangan bulat..."
    assert _should_skip_page(normal_text, 12) is False


def test_should_not_skip_copyright_in_later_pages():
    # Jika kata kunci hak cipta muncul di halaman belakang (misalnya bab PPKn tentang Hak Cipta), jangan di-skip.
    civic_lesson_text = "Pembahasan Hak Cipta di Indonesia\nHari ini kita belajar tentang hak cipta..."
    assert _should_skip_page(civic_lesson_text, 25) is False

