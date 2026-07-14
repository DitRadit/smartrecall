"""
file_utils.py - Helper validasi & penyimpanan file upload PDF.
"""

import os
import uuid
from werkzeug.utils import secure_filename

ALLOWED_EXTENSIONS = {"pdf"}


def is_allowed_file(filename: str) -> bool:
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


def save_uploaded_file(file_storage, upload_folder: str) -> str:
    """
    Simpan file upload ke disk dengan nama unik, kembalikan path lokal-nya.

    Args:
        file_storage: objek file dari request.files (Werkzeug FileStorage)
        upload_folder: folder tujuan penyimpanan

    Returns:
        path lengkap file yang disimpan
    """
    original_name = secure_filename(file_storage.filename)
    unique_name = f"{uuid.uuid4().hex}_{original_name}"
    full_path = os.path.join(upload_folder, unique_name)
    file_storage.save(full_path)
    return full_path
