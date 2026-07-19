"""
SmartRecall - ai-service (Flask)

Tanggung jawab (lih. ARCHITECTURE.md bagian 2):
- Ekstraksi teks PDF (pdfplumber)
- Preprocessing NLP Bahasa Indonesia (Sastrawi)
- Generate flashcard/rangkuman/soal via NVIDIA NIM API

PENTING (ARCHITECTURE.md bagian 6 & 8):
- Ini satu-satunya service yang boleh butuh koneksi internet (saat generate).
- Service ini TIDAK BOLEH diakses langsung oleh frontend-web.
  Hanya backend-api yang boleh memanggil endpoint di sini.
- API key NVIDIA NIM wajib lewat environment variable, jangan pernah hardcode.
"""

import os
import logging
from flask import Flask, jsonify
from flask_cors import CORS
from dotenv import load_dotenv

from routes.generate import generate_bp

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("ai-service")


def create_app():
    app = Flask(__name__)

    # CORS dibatasi: idealnya hanya origin backend-api yang diizinkan.
    # Untuk MVP di jaringan lokal, kita izinkan konfigurasi via env var.
    allowed_origin = os.getenv("BACKEND_API_ORIGIN", "http://localhost:3000")
    CORS(app, resources={r"/*": {"origins": allowed_origin}})

    app.config["UPLOAD_FOLDER"] = os.getenv("UPLOAD_FOLDER", "./uploads")
    os.makedirs(app.config["UPLOAD_FOLDER"], exist_ok=True)

    max_mb = int(os.getenv("MAX_CONTENT_LENGTH_MB", "20"))
    app.config["MAX_CONTENT_LENGTH"] = max_mb * 1024 * 1024

    app.register_blueprint(generate_bp, url_prefix="/generate")

    @app.route("/health", methods=["GET"])
    def health():
        """Health-check sederhana, dipakai backend-api untuk cek service up/down."""
        return jsonify({"status": "ok", "service": "ai-service"}), 200

    @app.errorhandler(404)
    def not_found(e):
        return jsonify({"error": "not_found", "message": "Endpoint tidak ditemukan"}), 404

    @app.errorhandler(500)
    def server_error(e):
        logger.exception("Internal server error")
        return jsonify({"error": "internal_error", "message": "Terjadi kesalahan di ai-service"}), 500

    return app


app = create_app()

if __name__ == "__main__":
    port = int(os.getenv("PORT", "5001"))
    debug = os.getenv("FLASK_ENV", "development") == "development"
    app.run(host="0.0.0.0", port=port, debug=debug)
