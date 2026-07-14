import { describe, it, expect, beforeEach } from 'vitest';
import {
  cacheMateriList,
  getCachedMateriList,
  cacheFlashcards,
  getCachedFlashcards,
  cacheReviewSchedule,
  getCachedReviewSchedule,
  enqueueReview,
  getQueuedReviews,
  removeQueuedReview,
  cacheSoal,
  getCachedSoal,
  cacheRangkuman,
  getCachedRangkuman,
} from '../src/offline/indexedDbCache';

/**
 * Test untuk indexedDbCache.js — bagian paling kritikal dari arsitektur
 * offline-first (ARCHITECTURE.md prinsip #2 & #3, bagian 3.2).
 *
 * Menggunakan fake-indexeddb (lih. tests/setup.js) sehingga bisa jalan di
 * Node tanpa browser sungguhan.
 */

// IndexedDB di sini persisten antar test dalam satu file (DB_NAME/DB_VERSION
// tetap), jadi kita bersihkan queue secara eksplisit di awal agar test
// deterministik dan tidak saling mempengaruhi.
beforeEach(async () => {
  const queued = await getQueuedReviews();
  await Promise.all(queued.map((item) => removeQueuedReview(item.localId)));
});

describe('indexedDbCache - materi & flashcards cache', () => {
  it('menyimpan dan mengambil kembali daftar materi', async () => {
    await cacheMateriList([
      { id: 1, judul: 'Materi A', status: 'published' },
      { id: 2, judul: 'Materi B', status: 'published' },
    ]);

    const result = await getCachedMateriList();
    expect(result).toHaveLength(2);
    expect(result.map((m) => m.judul)).toEqual(expect.arrayContaining(['Materi A', 'Materi B']));
  });

  it('menimpa (bukan menduplikasi) materi dengan id yang sama saat di-cache ulang', async () => {
    await cacheMateriList([{ id: 1, judul: 'Versi Lama', status: 'draft' }]);
    await cacheMateriList([{ id: 1, judul: 'Versi Baru', status: 'published' }]);

    const result = await getCachedMateriList();
    const materi1 = result.filter((m) => m.id === 1);
    expect(materi1).toHaveLength(1);
    expect(materi1[0].judul).toBe('Versi Baru');
  });

  it('menyimpan dan mengambil kembali flashcards', async () => {
    await cacheFlashcards([{ id: 10, pertanyaan: 'Apa itu SM-2?', jawaban: 'Algoritma spaced repetition' }]);
    const result = await getCachedFlashcards();
    expect(result.find((f) => f.id === 10)).toBeDefined();
  });
});

describe('indexedDbCache - review schedule cache', () => {
  it('menyimpan dan mengambil jadwal review per siswa', async () => {
    await cacheReviewSchedule(5, { due_for_review: [], new_flashcards: [{ id: 1 }] });
    const result = await getCachedReviewSchedule(5);
    expect(result.siswaId).toBe(5);
    expect(result.new_flashcards).toHaveLength(1);
  });
});

describe('indexedDbCache - soal (kuis) cache, FR-13', () => {
  it('menyimpan dan mengambil kembali soal per materi', async () => {
    await cacheSoal(7, { judul: 'Kuis Fotosintesis', soal: [{ id: 1, pertanyaan: 'Apa itu klorofil?', opsi_jawaban: ['A', 'B'] }] });
    const result = await getCachedSoal(7);
    expect(result.judul).toBe('Kuis Fotosintesis');
    expect(result.soal).toHaveLength(1);
  });

  it('mengembalikan undefined untuk materi yang belum pernah di-cache', async () => {
    const result = await getCachedSoal(9999);
    expect(result).toBeUndefined();
  });
});

describe('indexedDbCache - rangkuman cache', () => {
  it('menyimpan dan mengambil kembali rangkuman per materi', async () => {
    await cacheRangkuman(7, { judul: 'Fotosintesis', konten: 'Ringkasan singkat...' });
    const result = await getCachedRangkuman(7);
    expect(result.konten).toBe('Ringkasan singkat...');
  });
});

describe('indexedDbCache - offline review queue (kritikal untuk ARCHITECTURE.md 3.2)', () => {
  it('menambahkan item ke queue dan bisa diambil kembali', async () => {
    await enqueueReview({ flashcard_id: 1, skor_kualitas: 4 });
    const queued = await getQueuedReviews();

    expect(queued).toHaveLength(1);
    expect(queued[0].flashcard_id).toBe(1);
    expect(queued[0].skor_kualitas).toBe(4);
    expect(queued[0].queuedAt).toBeDefined(); // timestamp wajib ada untuk audit/log
  });

  it('setiap item queue mendapat localId unik (autoincrement)', async () => {
    await enqueueReview({ flashcard_id: 1, skor_kualitas: 3 });
    await enqueueReview({ flashcard_id: 2, skor_kualitas: 5 });

    const queued = await getQueuedReviews();
    expect(queued).toHaveLength(2);
    const ids = queued.map((q) => q.localId);
    expect(new Set(ids).size).toBe(2); // tidak ada localId duplikat
  });

  it('item yang sudah di-sync bisa dihapus dari queue (mencegah submit ganda)', async () => {
    await enqueueReview({ flashcard_id: 1, skor_kualitas: 4 });
    let queued = await getQueuedReviews();
    expect(queued).toHaveLength(1);

    await removeQueuedReview(queued[0].localId);
    queued = await getQueuedReviews();
    expect(queued).toHaveLength(0);
  });

  it('queue tetap berisi item lain jika hanya satu item yang dihapus', async () => {
    await enqueueReview({ flashcard_id: 1, skor_kualitas: 4 });
    await enqueueReview({ flashcard_id: 2, skor_kualitas: 2 });

    const queued = await getQueuedReviews();
    await removeQueuedReview(queued[0].localId);

    const remaining = await getQueuedReviews();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].flashcard_id).toBe(queued[1].flashcard_id);
  });
});
