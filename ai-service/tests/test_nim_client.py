"""
test_nim_client.py - Test untuk nim_client.py (integrasi Gemini via requests).

Requests di-mock sepenuhnya -- test ini TIDAK memanggil API sungguhan,
supaya tidak butuh API key/koneksi internet dan tidak memakan kuota Gemini.
"""
import pytest
import requests

from services import nim_client


class FakeResponse:
    def __init__(self, status_code, json_data=None):
        self.status_code = status_code
        self._json_data = json_data

    def json(self):
        if self._json_data is not None:
            return self._json_data
        raise ValueError("No JSON data")

    def raise_for_status(self):
        if not (200 <= self.status_code < 300):
            raise requests.exceptions.HTTPError(f"{self.status_code} Error", response=self)


@pytest.fixture(autouse=True)
def set_api_key(monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "test-key-not-real")
    monkeypatch.setenv("GEMINI_MAX_RETRIES", "1")  # percepat test retry


def test_generate_content_parses_json_dan_token_usage(monkeypatch):
    fake_data = {
        "candidates": [
            {
                "content": {
                    "parts": [{"text": '[{"pertanyaan": "Q1", "jawaban": "A1"}]'}]
                }
            }
        ],
        "usageMetadata": {"promptTokenCount": 10, "candidatesTokenCount": 20, "totalTokenCount": 30}
    }
    
    monkeypatch.setattr(requests, "post", lambda *args, **kwargs: FakeResponse(200, fake_data))

    result = nim_client.generate_content("materi contoh", "flashcard")

    assert result["parsed"] == [{"pertanyaan": "Q1", "jawaban": "A1"}]
    assert result["token_usage"] == {"promptTokenCount": 10, "candidatesTokenCount": 20, "totalTokenCount": 30}


def test_generate_content_tanpa_api_key_melempar_nimapierror(monkeypatch):
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    monkeypatch.delenv("NIM_API_KEY", raising=False)

    with pytest.raises(nim_client.NIMAPIError, match="GEMINI_API_KEY tidak ditemukan"):
        nim_client.generate_content("materi", "flashcard")


def test_generate_content_retry_saat_rate_limit_lalu_berhasil(monkeypatch):
    call_count = {"n": 0}

    def fake_post(*args, **kwargs):
        call_count["n"] += 1
        if call_count["n"] == 1:
            return FakeResponse(429)
        fake_data = {
            "candidates": [
                {
                    "content": {
                        "parts": [{"text": '[{"type": "paragraf", "teks": "Ringkasan berhasil setelah retry"}]'}]
                    }
                }
            ],
            "usageMetadata": {"promptTokenCount": 5, "candidatesTokenCount": 10, "totalTokenCount": 15}
        }
        return FakeResponse(200, fake_data)

    monkeypatch.setattr(requests, "post", fake_post)
    monkeypatch.setattr(nim_client.time, "sleep", lambda s: None)  # jangan benar-benar tidur di test

    result = nim_client.generate_content("materi", "rangkuman")

    assert call_count["n"] == 2  # gagal 1x (429), berhasil di percobaan ke-2
    assert result["parsed"] == [{"type": "paragraf", "teks": "Ringkasan berhasil setelah retry"}]


def test_generate_content_error_selain_429_langsung_dilempar_tanpa_retry(monkeypatch):
    call_count = {"n": 0}

    def fake_post(*args, **kwargs):
        call_count["n"] += 1
        return FakeResponse(400)

    monkeypatch.setattr(requests, "post", fake_post)

    with pytest.raises(nim_client.NIMAPIError, match="Gagal menghubungi Gemini API"):
        nim_client.generate_content("materi", "soal")

    assert call_count["n"] == 1  # error non-429 tidak di-retry


def test_generate_content_connection_error_di_retry_habis_melempar_nimapierror(monkeypatch):
    def fake_post(*args, **kwargs):
        raise requests.exceptions.ConnectionError("Connection failed")

    monkeypatch.setattr(requests, "post", fake_post)
    monkeypatch.setattr(nim_client.time, "sleep", lambda s: None)

    with pytest.raises(nim_client.NIMAPIError, match="Gagal menghubungi Gemini API"):
        nim_client.generate_content("materi", "flashcard")


def test_generate_content_response_kosong_melempar_nimapierror(monkeypatch):
    fake_data = {}  # response JSON kosong/tidak lengkap, akan trigger KeyError/IndexError

    monkeypatch.setattr(requests, "post", lambda *args, **kwargs: FakeResponse(200, fake_data))

    with pytest.raises(nim_client.NIMAPIError, match="Response Gemini API tidak valid"):
        nim_client.generate_content("materi", "flashcard")


def test_generate_content_jenis_konten_tidak_dikenal_melempar_valueerror():
    with pytest.raises(ValueError, match="jenis_konten tidak dikenal"):
        nim_client.generate_content("materi", "puisi")


def test_generate_content_soal_gabungkan_array_terpisah_per_soal(monkeypatch):
    """
    Regression test: LLM kadang membalas dengan
    kalimat pembuka lalu SATU ARRAY JSON TERPISAH PER SOAL, alih-alih satu
    array tunggal berisi semua soal, mis.:

        Berikut adalah 10 soal pilihan ganda berdasarkan materi yang diberikan:

        [{"pertanyaan": "Q1", ...}]

        [{"pertanyaan": "Q2", ...}]

    Sebelum fix ini, _parse_llm_json gagal total (json.loads "Extra data")
    dan draft "soal" jatuh ke raw_text (parsed=None) -- guru tidak dapat
    bank soal sama sekali walau flashcard/rangkuman berhasil. Sekarang
    harus berhasil digabung jadi satu list berisi semua soal.
    """
    llm_content = (
        "Berikut adalah soal pilihan ganda berdasarkan materi yang diberikan:\n\n"
        '[{"pertanyaan": "Apa yang dimaksud dengan bilangan bulat?", '
        '"opsi_jawaban": ["Bilangan asli", "Bilangan nol", "Bilangan bulat positif dan negatif", "Bilangan pecahan"], '
        '"jawaban_benar": "C"}]\n\n'
        '[{"pertanyaan": "Apa yang dimaksud dengan sifat distributif?", '
        '"opsi_jawaban": ["Sifat komutatif", "Sifat asosiatif", "Sifat distributif", "Sifat komutatif dan asosiatif"], '
        '"jawaban_benar": "C"}]'
    )
    fake_data = {
        "candidates": [{"content": {"parts": [{"text": llm_content}]}}],
        "usageMetadata": {"promptTokenCount": 100, "candidatesTokenCount": 50, "totalTokenCount": 150},
    }

    monkeypatch.setattr(requests, "post", lambda *args, **kwargs: FakeResponse(200, fake_data))

    result = nim_client.generate_content("materi contoh", "soal")

    assert result["parsed"] == [
        {
            "pertanyaan": "Apa yang dimaksud dengan bilangan bulat?",
            "opsi_jawaban": ["Bilangan asli", "Bilangan nol", "Bilangan bulat positif dan negatif", "Bilangan pecahan"],
            "jawaban_benar": "C",
        },
        {
            "pertanyaan": "Apa yang dimaksud dengan sifat distributif?",
            "opsi_jawaban": ["Sifat komutatif", "Sifat asosiatif", "Sifat distributif", "Sifat komutatif dan asosiatif"],
            "jawaban_benar": "C",
        },
    ]


def test_parse_multiple_json_values_kembalikan_none_kalau_cuma_satu_nilai():
    # Satu nilai JSON valid biasa -- bukan tanggung jawab fungsi ini,
    # caller (_parse_llm_json) sudah menanganinya lewat json.loads langsung.
    assert nim_client._parse_multiple_json_values('[{"a": 1}]') is None


def test_parse_multiple_json_values_kembalikan_none_kalau_tidak_ada_json():
    assert nim_client._parse_multiple_json_values("bukan json sama sekali") is None
