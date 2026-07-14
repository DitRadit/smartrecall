/**
 * sm2Algorithm.js - Implementasi algoritma SuperMemo 2 (SM-2).
 *
 * Sesuai pseudocode di ARCHITECTURE.md bagian 5:
 *
 *   jika q < 3:
 *       n = 0
 *       I = 1 (hari)
 *   jika q >= 3:
 *       n = n + 1
 *       EF = EF + (0.1 - (5-q) * (0.08 + (5-q) * 0.02))   // clamp EF minimum 1.3
 *       jika n == 1: I = 1
 *       jika n == 2: I = 6
 *       jika n > 2:  I = round(I_sebelumnya * EF)
 *
 *   next_review_date = today + I hari
 *
 * Komponen ini kritikal secara akademis/teknis (PRD.md bagian 14) -> wajib unit test.
 */

const MIN_EASE_FACTOR = 1.3;
const DEFAULT_EASE_FACTOR = 2.5;

/**
 * Menghitung state SM-2 berikutnya berdasarkan skor kualitas jawaban siswa.
 *
 * @param {Object} params
 * @param {number} params.q - Skor kualitas jawaban (0-5).
 * @param {number} params.n - repetition_number sebelumnya.
 * @param {number} params.ef - ease_factor sebelumnya.
 * @param {number} params.interval - interval (hari) sebelumnya.
 * @param {Date} [params.today] - Tanggal acuan "hari ini" (default: new Date()), dibuat
 *   sebagai parameter agar mudah di-unit-test secara deterministik.
 * @returns {{ repetitionNumber: number, easeFactor: number, interval: number, nextReviewDate: Date }}
 */
function calculateNextReview({ q, n, ef, interval, today = new Date() }) {
  if (typeof q !== 'number' || q < 0 || q > 5) {
    throw new Error('Skor kualitas (q) harus berupa angka antara 0 dan 5');
  }

  let newN = n;
  let newEF = ef;
  let newInterval = interval;

  if (q < 3) {
    newN = 0;
    newInterval = 1;
    // EF tidak diubah saat q < 3, sesuai pseudocode (reset hanya n dan I).
  } else {
    newN = n + 1;
    newEF = ef + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));

    if (newEF < MIN_EASE_FACTOR) {
      newEF = MIN_EASE_FACTOR;
    }

    if (newN === 1) {
      newInterval = 1;
    } else if (newN === 2) {
      newInterval = 6;
    } else {
      newInterval = Math.round(interval * newEF);
    }
  }

  const nextReviewDate = new Date(today);
  nextReviewDate.setDate(nextReviewDate.getDate() + newInterval);

  return {
    repetitionNumber: newN,
    easeFactor: newEF,
    interval: newInterval,
    nextReviewDate,
  };
}

/**
 * State awal untuk flashcard yang belum pernah direview siswa.
 */
function initialState() {
  return {
    repetitionNumber: 0,
    easeFactor: DEFAULT_EASE_FACTOR,
    interval: 0,
  };
}

module.exports = {
  calculateNextReview,
  initialState,
  MIN_EASE_FACTOR,
  DEFAULT_EASE_FACTOR,
};
