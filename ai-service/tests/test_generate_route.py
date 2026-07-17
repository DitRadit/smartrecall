"""
test_generate_route.py - Test untuk endpoint POST /generate/materi.

Fokus utama: memverifikasi bahwa satu kali upload PDF menghasilkan ketiga
jenis konten sekaligus (flashcard, rangkuman, soal) dalam SATU response,
tanpa guru perlu memilih jenis konten -- sesuai perubahan alur upload.

Gemini API di-mock (monkeypatch generate_content) supaya test tidak
butuh API key/koneksi internet sungguhan.
"""
import io
import pytest

from app import create_app
from services.nim_client import NIMAPIError


@pytest.fixture
def client():
    app = create_app()
    app.config["TESTING"] = True
    with app.test_client() as c:
        yield c


def _fake_pdf_bytes():
    # Konten biner tidak perlu PDF valid karena extract_text_from_pdf akan
    # di-monkeypatch di sebagian besar test; untuk test yang butuh ekstraksi
    # asli, gunakan pdfplumber minimal fixture terpisah jika diperlukan.
    return io.BytesIO(b"%PDF-1.4 fake content for upload test")


def test_generate_materi_default_menghasilkan_ketiga_jenis_konten(client, monkeypatch):
    """Tanpa jenis_konten di body (default), harus generate flashcard+rangkuman+soal sekaligus."""
    monkeypatch.setattr(
        "routes.generate.extract_text_from_pdf",
        lambda path: "Materi contoh tentang fotosintesis.",
    )
    monkeypatch.setattr(
        "routes.generate.preprocess_for_generation",
        lambda text: text,
    )
    monkeypatch.setattr(
        "routes.generate.extract_keywords",
        lambda text: ["fotosintesis", "klorofil"],
    )

    call_log = []

    def fake_generate_content(materi_text, jenis_konten):
        call_log.append(jenis_konten)
        if jenis_konten == "flashcard":
            return {"parsed": [{"pertanyaan": "Apa itu fotosintesis?", "jawaban": "..."}], "raw_text": "...", "token_usage": {"total_tokens": 100}}
        if jenis_konten == "rangkuman":
            return {"parsed": [{"type": "paragraf", "teks": "Ringkasan fotosintesis..."}], "raw_text": "...", "token_usage": {"total_tokens": 80}}
        if jenis_konten == "soal":
            return {"parsed": [{"pertanyaan": "...", "opsi_jawaban": ["A", "B"], "jawaban_benar": "A"}], "raw_text": "...", "token_usage": {"total_tokens": 90}}
        raise AssertionError(f"jenis_konten tak terduga: {jenis_konten}")

    monkeypatch.setattr("routes.generate.generate_content", fake_generate_content)

    response = client.post(
        "/generate/materi",
        data={"file": (_fake_pdf_bytes(), "materi.pdf")},
        content_type="multipart/form-data",
    )

    assert response.status_code == 200
    body = response.get_json()
    assert body["status"] == "success"

    # Ketiga jenis konten harus di-generate dalam SATU request (tidak perlu
    # guru memilih/upload ulang per jenis).
    assert set(call_log) == {"flashcard", "rangkuman", "soal"}
    assert body["draft"]["flashcard"]["parsed"][0]["pertanyaan"] == "Apa itu fotosintesis?"
    assert body["draft"]["rangkuman"]["parsed"] == [{"type": "paragraf", "teks": "Ringkasan fotosintesis..."}]
    assert body["draft"]["soal"]["parsed"][0]["jawaban_benar"] == "A"
    assert "errors" not in body


def test_generate_materi_kegagalan_sebagian_tidak_menggagalkan_seluruh_request(client, monkeypatch):
    """Jika salah satu jenis gagal (mis. rate limit), dua lainnya tetap dikembalikan."""
    monkeypatch.setattr("routes.generate.extract_text_from_pdf", lambda path: "Materi contoh.")
    monkeypatch.setattr("routes.generate.preprocess_for_generation", lambda text: text)
    monkeypatch.setattr("routes.generate.extract_keywords", lambda text: [])

    def fake_generate_content(materi_text, jenis_konten):
        if jenis_konten == "rangkuman":
            raise NIMAPIError("Rate limit tercapai pada Gemini API (429).")
        return {"parsed": [{"ok": True}], "raw_text": "...", "token_usage": None}

    monkeypatch.setattr("routes.generate.generate_content", fake_generate_content)

    response = client.post(
        "/generate/materi",
        data={"file": (_fake_pdf_bytes(), "materi.pdf")},
        content_type="multipart/form-data",
    )

    assert response.status_code == 200
    body = response.get_json()
    assert body["draft"]["flashcard"] is not None
    assert body["draft"]["soal"] is not None
    assert body["draft"]["rangkuman"] is None
    assert "rangkuman" in body["errors"]


def test_generate_materi_semua_jenis_gagal_mengembalikan_503(client, monkeypatch):
    """Jika Gemini API down total (semua jenis gagal), request dianggap gagal
    supaya backend-api mengarahkan guru ke fallback input manual (FR-7)."""
    monkeypatch.setattr("routes.generate.extract_text_from_pdf", lambda path: "Materi contoh.")
    monkeypatch.setattr("routes.generate.preprocess_for_generation", lambda text: text)
    monkeypatch.setattr("routes.generate.extract_keywords", lambda text: [])

    def fake_generate_content(materi_text, jenis_konten):
        raise NIMAPIError("Tidak bisa menghubungi Gemini API.")

    monkeypatch.setattr("routes.generate.generate_content", fake_generate_content)

    response = client.post(
        "/generate/materi",
        data={"file": (_fake_pdf_bytes(), "materi.pdf")},
        content_type="multipart/form-data",
    )

    assert response.status_code == 503
    assert response.get_json()["status"] == "error"


def test_generate_materi_bisa_diminta_satu_jenis_saja(client, monkeypatch):
    """jenis_konten eksplisit tetap didukung (mis. guru regenerate ulang bank soal saja)."""
    monkeypatch.setattr("routes.generate.extract_text_from_pdf", lambda path: "Materi contoh.")
    monkeypatch.setattr("routes.generate.preprocess_for_generation", lambda text: text)
    monkeypatch.setattr("routes.generate.extract_keywords", lambda text: [])

    call_log = []

    def fake_generate_content(materi_text, jenis_konten):
        call_log.append(jenis_konten)
        return {"parsed": [{"ok": True}], "raw_text": "...", "token_usage": None}

    monkeypatch.setattr("routes.generate.generate_content", fake_generate_content)

    response = client.post(
        "/generate/materi",
        data={"file": (_fake_pdf_bytes(), "materi.pdf"), "jenis_konten": "soal"},
        content_type="multipart/form-data",
    )

    assert response.status_code == 200
    assert call_log == ["soal"]
    body = response.get_json()
    assert body["draft"]["soal"] is not None
    assert "flashcard" not in body["draft"]
    assert "rangkuman" not in body["draft"]


def test_generate_materi_opsional_bisa_menghasilkan_ppt(client, monkeypatch):
    monkeypatch.setattr("routes.generate.extract_text_from_pdf", lambda path: "Materi contoh.")
    monkeypatch.setattr("routes.generate.preprocess_for_generation", lambda text: text)
    monkeypatch.setattr("routes.generate.extract_keywords", lambda text: [])
    monkeypatch.setattr(
        "routes.generate.generate_content",
        lambda materi_text, jenis_konten: {"parsed": [{"ok": jenis_konten}], "raw_text": "...", "token_usage": None},
    )
    monkeypatch.setattr("routes.generate.generate_pptx", lambda title, text: b"fake-pptx")

    response = client.post(
        "/generate/materi",
        data={
            "file": (_fake_pdf_bytes(), "materi.pdf"),
            "judul": "Materi PPT",
            "generate_ppt": "true",
        },
        content_type="multipart/form-data",
    )

    assert response.status_code == 200
    body = response.get_json()
    assert body["ppt"]["filename"] == "Materi PPT.pptx"
    assert body["ppt"]["content_base64"] == "ZmFrZS1wcHR4"


def test_generate_materi_tanpa_file_mengembalikan_400(client):
    response = client.post("/generate/materi", data={}, content_type="multipart/form-data")
    assert response.status_code == 400


def test_generate_materi_jenis_konten_tidak_valid_mengembalikan_400(client):
    response = client.post(
        "/generate/materi",
        data={"file": (_fake_pdf_bytes(), "materi.pdf"), "jenis_konten": "puisi"},
        content_type="multipart/form-data",
    )
    assert response.status_code == 400
