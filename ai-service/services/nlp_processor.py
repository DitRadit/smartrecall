"""
nlp_processor.py - Preprocessing NLP Bahasa Indonesia menggunakan Sastrawi.

Tanggung jawab:
- Membersihkan teks hasil ekstraksi PDF (whitespace, karakter aneh)
- Stopword removal & stemming ringan sebagai preprocessing sebelum teks
  dikirim ke NVIDIA NIM API (membantu memangkas token & noise)

Catatan: preprocessing ini TIDAK menggantikan teks asli yang dikirim ke LLM
untuk generate konten (LLM tetap butuh teks yang natural, bukan hasil stem
mentah). Fungsi stem/stopword di sini terutama dipakai untuk keperluan
analisis kata kunci / ringkasan pendukung, bukan untuk merusak teks asli.
"""

import re
import logging

from Sastrawi.Stemmer.StemmerFactory import StemmerFactory
from Sastrawi.StopWordRemover.StopWordRemoverFactory import StopWordRemoverFactory

logger = logging.getLogger("ai-service.nlp_processor")

_stemmer = StemmerFactory().create_stemmer()
_stopword_remover = StopWordRemoverFactory().create_stop_word_remover()


def clean_text(raw_text: str) -> str:
    """Membersihkan whitespace berlebih dan karakter kontrol dari teks hasil ekstraksi PDF."""
    text = raw_text.replace("\x00", " ")
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def remove_stopwords(text: str) -> str:
    """Menghapus stopword Bahasa Indonesia menggunakan Sastrawi."""
    return _stopword_remover.remove(text)


def stem_text(text: str) -> str:
    """Melakukan stemming Bahasa Indonesia menggunakan Sastrawi."""
    return _stemmer.stem(text)


def extract_keywords(text: str, max_keywords: int = 20) -> list[str]:
    """
    Ekstraksi kata kunci sederhana: stopword removal + stemming + frequency count.
    Dipakai sebagai metadata tambahan (misal untuk tagging materi), bukan pengganti teks asli.
    """
    no_stopwords = remove_stopwords(text.lower())
    stemmed = stem_text(no_stopwords)

    words = re.findall(r"[a-zA-Z]{3,}", stemmed)
    freq: dict[str, int] = {}
    for w in words:
        freq[w] = freq.get(w, 0) + 1

    sorted_words = sorted(freq.items(), key=lambda kv: kv[1], reverse=True)
    return [w for w, _ in sorted_words[:max_keywords]]


def preprocess_for_generation(raw_text: str, max_chars: int = 12000) -> str:
    """
    Preprocessing utama sebelum teks dikirim ke NVIDIA NIM API.
    Hanya membersihkan teks & memotong panjang (bukan stemming) supaya
    konteks yang dikirim ke LLM tetap natural dan enak dibaca.
    """
    cleaned = clean_text(raw_text)
    if len(cleaned) > max_chars:
        logger.info("Teks dipotong dari %s ke %s karakter sebelum dikirim ke LLM", len(cleaned), max_chars)
        cleaned = cleaned[:max_chars]
    return cleaned
