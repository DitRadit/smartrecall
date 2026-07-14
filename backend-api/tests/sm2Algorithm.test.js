/**
 * Unit test dasar untuk sm2Algorithm.js.
 * Wajib mencakup (ARCHITECTURE.md bagian 5): q < 3 (reset), q >= 3 (progresi normal),
 * dan EF di batas minimum 1.3.
 *
 * Jalankan: npm test
 */

const { calculateNextReview, initialState, MIN_EASE_FACTOR } = require('../src/services/sm2Algorithm');

describe('sm2Algorithm.calculateNextReview', () => {
  const today = new Date('2026-07-12T00:00:00Z');

  test('q < 3 harus reset repetition_number ke 0 dan interval ke 1 hari', () => {
    const result = calculateNextReview({ q: 2, n: 4, ef: 2.3, interval: 15, today });

    expect(result.repetitionNumber).toBe(0);
    expect(result.interval).toBe(1);

    const expectedDate = new Date(today);
    expectedDate.setDate(expectedDate.getDate() + 1);
    expect(result.nextReviewDate.toISOString()).toBe(expectedDate.toISOString());
  });

  test('q >= 3 pada repetisi pertama (n=0 -> n=1) harus set interval = 1', () => {
    const result = calculateNextReview({ q: 4, n: 0, ef: 2.5, interval: 0, today });

    expect(result.repetitionNumber).toBe(1);
    expect(result.interval).toBe(1);
  });

  test('q >= 3 pada repetisi kedua (n=1 -> n=2) harus set interval = 6', () => {
    const result = calculateNextReview({ q: 4, n: 1, ef: 2.5, interval: 1, today });

    expect(result.repetitionNumber).toBe(2);
    expect(result.interval).toBe(6);
  });

  test('q >= 3 pada repetisi ketiga+ (n>2) harus interval = round(interval_sebelumnya * EF)', () => {
    const result = calculateNextReview({ q: 5, n: 2, ef: 2.5, interval: 6, today });

    expect(result.repetitionNumber).toBe(3);
    // EF baru dihitung dulu, lalu interval = round(6 * EF_baru)
    const expectedEF = 2.5 + (0.1 - (5 - 5) * (0.08 + (5 - 5) * 0.02));
    expect(result.easeFactor).toBeCloseTo(expectedEF, 5);
    expect(result.interval).toBe(Math.round(6 * expectedEF));
  });

  test('EF tidak boleh turun di bawah batas minimum 1.3', () => {
    // q=3 berkali-kali akan menurunkan EF secara signifikan
    let state = { n: 2, ef: 1.35, interval: 6 };
    const result = calculateNextReview({ q: 3, n: state.n, ef: state.ef, interval: state.interval, today });

    expect(result.easeFactor).toBeGreaterThanOrEqual(MIN_EASE_FACTOR);
  });

  test('q=0 (kegagalan total) tetap reset n dan interval walau EF tidak berubah', () => {
    const result = calculateNextReview({ q: 0, n: 5, ef: 2.1, interval: 30, today });

    expect(result.repetitionNumber).toBe(0);
    expect(result.interval).toBe(1);
    expect(result.easeFactor).toBe(2.1); // EF tidak diubah saat q < 3
  });

  test('melempar error jika q di luar rentang 0-5', () => {
    expect(() => calculateNextReview({ q: 6, n: 0, ef: 2.5, interval: 0, today })).toThrow();
    expect(() => calculateNextReview({ q: -1, n: 0, ef: 2.5, interval: 0, today })).toThrow();
  });
});

describe('sm2Algorithm.initialState', () => {
  test('mengembalikan state default untuk flashcard baru', () => {
    const state = initialState();
    expect(state.repetitionNumber).toBe(0);
    expect(state.easeFactor).toBe(2.5);
    expect(state.interval).toBe(0);
  });
});
