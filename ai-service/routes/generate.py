"""
routes/generate.py - Endpoint utama ai-service.

Endpoint ini HANYA boleh dipanggil oleh backend-api (lihat ARCHITECTURE.md
bagian 6: frontend-web TIDAK BOLEH memanggil ai-service secara langsung).

Alur (ARCHITECTURE.md bagian 3.1):
  backend-api -> POST /generate/materi (file PDF + jenis_konten)
  ai-service: pdfplumber ekstrak teks -> Sastrawi preprocess -> Gemini API
  ai-service kembalikan hasil draft ke backend-api
"""

import os
import logging
from concurrent.futures import ThreadPoolExecutor, as_completed
from flask import Blueprint, request, jsonify, current_app

from services.pdf_extractor import extract_text_from_pdf, PDFExtractionError
from services.nlp_processor import preprocess_for_generation, extract_keywords
from services.nim_client import generate_content, NIMAPIError
from utils.file_utils import is_allowed_file, save_uploaded_file

generate_bp = Blueprint("generate", __name__)
logger = logging.getLogger("ai-service.routes.generate")

ALL_JENIS_KONTEN = ["flashcard", "rangkuman", "soal"]
VALID_JENIS_KONTEN = {"flashcard", "rangkuman", "soal", "all"}


@generate_bp.route("/materi", methods=["POST"])
def generate_materi():
    """
    Terima file PDF, ekstraksi teks SEKALI, lalu generate ketiga jenis
    konten (flashcard, rangkuman, bank soal) sekaligus dari materi yang
    sama -- guru tidak perlu memilih jenis konten satu-satu saat upload.

    Request: multipart/form-data
      - file: PDF materi
      - jenis_konten (opsional): "all" (default) | "flashcard" | "rangkuman" | "soal"
        Nilai tunggal tetap didukung untuk kebutuhan testing/regenerate satu
        jenis saja (mis. guru minta generate ulang hanya bank soal).

    Response 200:
      {
        "status": "success",
        "keywords": [...],
        "draft": {
          "flashcard": { "parsed": [...], "raw_text": "..." } | null,
          "rangkuman": { "parsed": {...}, "raw_text": "..." } | null,
          "soal": { "parsed": [...], "raw_text": "..." } | null
        },
        "errors": { "soal": "pesan error jika salah satu jenis gagal generate" }
      }

    Response 4xx/5xx: { "status": "error", "message": "..." }
    Kegagalan di sini TIDAK BOLEH mematikan backend-api atau frontend-web
    (graceful degradation, ARCHITECTURE.md prinsip #4) — backend-api wajib
    menangani error ini dan tetap menyediakan jalur input manual guru.
    Kegagalan SEBAGIAN (mis. rangkuman gagal tapi flashcard berhasil) juga
    tidak boleh menggagalkan seluruh request -- lihat "errors" di response,
    guru tetap dapat draft yang berhasil dan input manual untuk yang gagal.
    """
    if "file" not in request.files:
        return jsonify({"status": "error", "message": "File PDF wajib disertakan (field 'file')"}), 400

    file = request.files["file"]
    jenis_konten = request.form.get("jenis_konten", "all").strip().lower()

    if file.filename == "":
        return jsonify({"status": "error", "message": "Nama file kosong"}), 400

    if not is_allowed_file(file.filename):
        return jsonify({"status": "error", "message": "Hanya file .pdf yang diizinkan"}), 400

    if jenis_konten not in VALID_JENIS_KONTEN:
        return jsonify({
            "status": "error",
            "message": f"jenis_konten harus salah satu dari: {', '.join(sorted(VALID_JENIS_KONTEN))}"
        }), 400

    jenis_list = ALL_JENIS_KONTEN if jenis_konten == "all" else [jenis_konten]

    saved_path = None
    try:
        saved_path = save_uploaded_file(file, current_app.config["UPLOAD_FOLDER"])

        # Ekstraksi & preprocessing PDF dilakukan SEKALI, dipakai ulang untuk
        # semua jenis konten -- menghindari re-upload/re-parse PDF berkali-kali.
        raw_text = extract_text_from_pdf(saved_path)
        processed_text = preprocess_for_generation(raw_text)
        keywords = extract_keywords(raw_text)

        draft = {}
        errors = {}

        # Ketiga jenis konten independen satu sama lain (masing-masing 1 HTTP call
        # terpisah ke Gemini), jadi dijalankan PARALEL, bukan berurutan --
        # supaya total waktu tunggu backend-api (AI_SERVICE_TIMEOUT_MS) tidak
        # gampang kelewat untuk materi yang panjang (3x waktu 1 panggilan LLM
        # kalau sekuensial, vs ~1x waktu panggilan terlama kalau paralel).
        with ThreadPoolExecutor(max_workers=len(jenis_list)) as executor:
            future_to_jk = {
                executor.submit(generate_content, processed_text, jk): jk for jk in jenis_list
            }
            for future in as_completed(future_to_jk):
                jk = future_to_jk[future]
                try:
                    result = future.result()
                    draft[jk] = result

                    token_usage = result.get("token_usage")
                    if token_usage:
                        logger.info("[generate materi] jenis_konten=%s token_usage=%s", jk, token_usage)
                except NIMAPIError as e:
                    logger.error("Gagal generate jenis_konten=%s: %s", jk, e)
                    draft[jk] = None
                    errors[jk] = str(e)

        # Kalau SEMUA jenis gagal (mis. Gemini API down total), anggap request
        # gagal supaya backend-api mengarahkan guru ke fallback manual (FR-7).
        if all(v is None for v in draft.values()):
            raise NIMAPIError(errors.get(jenis_list[0], "Gagal generate semua jenis konten."))

        response_body = {
            "status": "success",
            "keywords": keywords,
            "draft": draft,
        }
        if errors:
            response_body["errors"] = errors

        return jsonify(response_body), 200

    except PDFExtractionError as e:
        logger.warning("Ekstraksi PDF gagal: %s", e)
        return jsonify({"status": "error", "message": str(e)}), 422

    except NIMAPIError as e:
        logger.error("Gemini API error: %s", e)
        # 503: guru harus diarahkan ke fallback input manual (FR-7) oleh backend-api.
        return jsonify({"status": "error", "message": str(e)}), 503

    except Exception as e:
        logger.exception("Kesalahan tak terduga saat generate materi")
        return jsonify({"status": "error", "message": "Terjadi kesalahan internal saat memproses materi"}), 500

    finally:
        # Bersihkan file upload sementara setelah diproses.
        if saved_path and os.path.exists(saved_path):
            try:
                os.remove(saved_path)
            except OSError:
                logger.warning("Gagal menghapus file sementara: %s", saved_path)


@generate_bp.route("/health", methods=["GET"])
def generate_health():
    """Health-check khusus modul generate (terpisah dari /health utama)."""
    return jsonify({"status": "ok", "module": "generate"}), 200
