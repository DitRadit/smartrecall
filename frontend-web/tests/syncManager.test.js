import { describe, it, expect, beforeEach, vi } from 'vitest';
import MockAdapter from 'axios-mock-adapter';
import api from '../src/services/api';
import { getQueuedReviews, removeQueuedReview, getQueuedQuizSubmits, removeQueuedQuizSubmit } from '../src/offline/indexedDbCache';
import { submitReviewWithFallback, trySyncQueue, submitQuizWithFallback } from '../src/offline/syncManager';

/**
 * Test untuk syncManager.js — memverifikasi perilaku offline-first yang
 * disyaratkan ARCHITECTURE.md bagian 3.2:
 *   "submit skor TIDAK BOLEH hilang walau koneksi ke Local Server Hub
 *    terputus sesaat."
 */

const mock = new MockAdapter(api);

beforeEach(async () => {
  mock.reset();
  const queued = await getQueuedReviews();
  await Promise.all(queued.map((item) => removeQueuedReview(item.localId)));
  const queuedQuiz = await getQueuedQuizSubmits();
  await Promise.all(queuedQuiz.map((item) => removeQueuedQuizSubmit(item.localId)));
});

describe('submitReviewWithFallback', () => {
  it('mengirim langsung ke backend-api saat koneksi normal (tidak masuk queue)', async () => {
    mock.onPost('/review').reply(200, { progress: { id: 1 } });

    const result = await submitReviewWithFallback({ flashcard_id: 1, skor_kualitas: 4 });

    expect(result.synced).toBe(true);
    const queued = await getQueuedReviews();
    expect(queued).toHaveLength(0);
  });

  it('menyimpan ke offline queue saat network error (bukan error response server)', async () => {
    mock.onPost('/review').networkError();

    const result = await submitReviewWithFallback({ flashcard_id: 2, skor_kualitas: 3 });

    expect(result.synced).toBe(false);
    expect(result.queued).toBe(true);
    const queued = await getQueuedReviews();
    expect(queued).toHaveLength(1);
    expect(queued[0].flashcard_id).toBe(2);
  });

  it('tetap melempar error jika server merespons error (bukan disimpan ke queue)', async () => {
    mock.onPost('/review').reply(400, { error: 'bad_request', message: 'skor_kualitas tidak valid' });

    await expect(submitReviewWithFallback({ flashcard_id: 3, skor_kualitas: 99 })).rejects.toThrow();

    // Error validasi dari server bukan masalah konektivitas -> tidak boleh
    // ikut masuk offline queue (akan gagal lagi terus-menerus saat sync).
    const queued = await getQueuedReviews();
    expect(queued).toHaveLength(0);
  });
});

describe('submitQuizWithFallback (FR-13 offline support)', () => {
  it('mengirim langsung ke backend-api saat koneksi normal', async () => {
    mock.onPost('/soal/submit').reply(201, { skor_benar: 3, total_soal: 5 });

    const result = await submitQuizWithFallback({ materi_id: 7, jawaban: [{ soal_id: 1, jawaban_dipilih: 'A' }] });

    expect(result.synced).toBe(true);
    expect(result.data.skor_benar).toBe(3);
    const queued = await getQueuedQuizSubmits();
    expect(queued).toHaveLength(0);
  });

  it('menyimpan ke offline queue saat network error', async () => {
    mock.onPost('/soal/submit').networkError();

    const result = await submitQuizWithFallback({ materi_id: 7, jawaban: [{ soal_id: 1, jawaban_dipilih: 'A' }] });

    expect(result.synced).toBe(false);
    expect(result.queued).toBe(true);
    const queued = await getQueuedQuizSubmits();
    expect(queued).toHaveLength(1);
    expect(queued[0].materi_id).toBe(7);
  });

  it('trySyncQueue ikut mengirim hasil kuis yang tertunda setelah koneksi kembali', async () => {
    mock.onPost('/soal/submit').networkError();
    await submitQuizWithFallback({ materi_id: 7, jawaban: [{ soal_id: 1, jawaban_dipilih: 'A' }] });

    let queued = await getQueuedQuizSubmits();
    expect(queued).toHaveLength(1);

    mock.reset();
    mock.onPost('/soal/submit').reply(201, { skor_benar: 1, total_soal: 1 });

    await trySyncQueue();

    queued = await getQueuedQuizSubmits();
    expect(queued).toHaveLength(0);
  });
});

describe('trySyncQueue', () => {
  it('mengirim semua item di queue ke backend-api lalu menghapusnya setelah sukses', async () => {
    mock.onPost('/review').networkError();
    await submitReviewWithFallback({ flashcard_id: 1, skor_kualitas: 4 });
    await submitReviewWithFallback({ flashcard_id: 2, skor_kualitas: 5 });

    let queued = await getQueuedReviews();
    expect(queued).toHaveLength(2);

    mock.reset();
    mock.onPost('/review').reply(200, { progress: {} });

    await trySyncQueue();

    queued = await getQueuedReviews();
    expect(queued).toHaveLength(0);
  });

  it('menghentikan sync di tengah jalan jika masih offline, menyisakan item yang belum ter-sync', async () => {
    mock.onPost('/review').networkError();
    await submitReviewWithFallback({ flashcard_id: 1, skor_kualitas: 4 });
    await submitReviewWithFallback({ flashcard_id: 2, skor_kualitas: 5 });

    // Masih offline saat trySyncQueue dipanggil -> tidak ada yang tersync.
    await trySyncQueue();

    const queued = await getQueuedReviews();
    expect(queued).toHaveLength(2);
  });

  it('melewati (drop) item yang gagal karena error validasi server, tidak memblokir item lain', async () => {
    mock.onPost('/review').networkError();
    await submitReviewWithFallback({ flashcard_id: 1, skor_kualitas: 4 });
    await submitReviewWithFallback({ flashcard_id: 2, skor_kualitas: 5 });

    mock.reset();
    let callCount = 0;
    mock.onPost('/review').reply(() => {
      callCount += 1;
      // Item pertama gagal validasi server, item kedua sukses.
      return callCount === 1 ? [400, { error: 'bad_request' }] : [200, { progress: {} }];
    });

    await trySyncQueue();

    const queued = await getQueuedReviews();
    expect(queued).toHaveLength(0); // keduanya di-drop dari queue (satu sukses, satu invalid & dibuang)
  });
});
