/**
 * aiServiceClient.js - Klien HTTP untuk memanggil ai-service (Flask).
 *
 * ATURAN PENTING (ARCHITECTURE.md bagian 6): backend-api adalah SATU-SATUNYA
 * service yang boleh memanggil ai-service. frontend-web tidak pernah
 * memanggil ai-service secara langsung.
 *
 * Kegagalan ai-service (down/rate-limit) TIDAK BOLEH membuat backend-api ikut
 * down (graceful degradation) — caller wajib menangani AIServiceError dan
 * mengarahkan guru ke fallback input manual (FR-7).
 */

const axios = require('axios');
const FormData = require('form-data');

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:5001';
const TIMEOUT_MS = parseInt(process.env.AI_SERVICE_TIMEOUT_MS || '65000', 10);

class AIServiceError extends Error {
  constructor(message, statusCode = 503) {
    super(message);
    this.name = 'AIServiceError';
    this.statusCode = statusCode;
  }
}

/**
 * Mengirim file PDF ke ai-service untuk diproses. Secara default meminta
 * SEMUA jenis konten sekaligus (flashcard, rangkuman, soal) dari satu file
 * yang sama -- guru tidak perlu memilih jenis konten satu-satu saat upload.
 *
 * @param {Buffer} fileBuffer - isi file PDF (dari multer memory storage)
 * @param {string} originalFilename
 * @param {'all'|'flashcard'|'rangkuman'|'soal'} [jenisKonten='all'] - opsional,
 *   dipakai kalau hanya ingin (re)generate satu jenis konten saja.
 * @returns {Promise<{ status: string, keywords: string[], draft: { flashcard: object|null, rangkuman: object|null, soal: object|null }, errors?: object }>}
 */
async function generateMateri(fileBuffer, originalFilename, jenisKonten = 'all', options = {}) {
  const form = new FormData();
  form.append('file', fileBuffer, originalFilename);
  form.append('jenis_konten', jenisKonten);
  if (options.generatePpt) {
    form.append('generate_ppt', 'true');
  }
  if (options.judul) {
    form.append('judul', options.judul);
  }

  try {
    const response = await axios.post(`${AI_SERVICE_URL}/generate/materi`, form, {
      headers: form.getHeaders(),
      timeout: TIMEOUT_MS,
    });
    return response.data;
  } catch (err) {
    if (err.response) {
      // ai-service merespons dengan error terstruktur (4xx/5xx)
      const message = err.response.data?.message || 'ai-service mengembalikan error';
      throw new AIServiceError(message, err.response.status);
    }
    // Network error / timeout / ai-service down sepenuhnya
    throw new AIServiceError(
      `Tidak bisa terhubung ke ai-service: ${err.message}. Guru bisa lanjut input manual.`,
      503
    );
  }
}

async function generateVariant(jenisKonten, sourceContent) {
  try {
    const response = await axios.post(
      `${AI_SERVICE_URL}/generate/variant`,
      { jenis_konten: jenisKonten, source_content: sourceContent },
      { timeout: TIMEOUT_MS },
    );
    return response.data;
  } catch (err) {
    if (err.response) {
      const message = err.response.data?.message || 'ai-service mengembalikan error';
      throw new AIServiceError(message, err.response.status);
    }
    throw new AIServiceError(
      `Tidak bisa terhubung ke ai-service: ${err.message}. Guru bisa edit manual.`,
      503,
    );
  }
}

/**
 * Cek health ai-service (dipakai di dashboard guru / monitoring sederhana).
 */
async function checkHealth() {
  try {
    const response = await axios.get(`${AI_SERVICE_URL}/health`, { timeout: 5000 });
    return response.data;
  } catch (err) {
    return { status: 'down', error: err.message };
  }
}

module.exports = {
  generateMateri,
  generateVariant,
  checkHealth,
  AIServiceError,
};
