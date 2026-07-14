"""
Unit test dasar untuk nlp_processor.py (preprocessing NLP Bahasa Indonesia).
Jalankan dengan: pytest tests/
"""

import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from services.nlp_processor import clean_text, preprocess_for_generation, extract_keywords


def test_clean_text_removes_extra_whitespace():
    dirty = "Ini   teks\t\tdengan   spasi\n\n\n\nberlebih"
    result = clean_text(dirty)
    assert "   " not in result
    assert "\n\n\n" not in result


def test_preprocess_for_generation_truncates_long_text():
    long_text = "kata " * 5000  # jauh lebih panjang dari default max_chars
    result = preprocess_for_generation(long_text, max_chars=100)
    assert len(result) <= 100


def test_extract_keywords_returns_list():
    text = "Sekolah di wilayah 3T mengalami keterbatasan internet dan listrik yang stabil."
    keywords = extract_keywords(text, max_keywords=5)
    assert isinstance(keywords, list)
    assert len(keywords) <= 5
