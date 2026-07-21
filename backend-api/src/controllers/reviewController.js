/**
 * reviewController.js - Submit skor kualitas review siswa & ambil jadwal review (SM-2).
 *
 * Endpoint sesuai ARCHITECTURE.md bagian 3.3:
 *   POST /review                        (siswa)
 *   GET  /review/schedule/:siswa_id      (siswa)
 */

const prisma = require('../config/db');
const { calculateNextReview, initialState } = require('../services/sm2Algorithm');

/**
 * POST /review
 * Body: { flashcard_id, skor_kualitas } — skor 0-5
 *
 * PENTING: endpoint ini adalah tujuan akhir dari offline queue frontend
 * (ARCHITECTURE.md 3.2). Skor yang masuk lewat sync manager setelah koneksi
 * kembali tetap diproses dengan cara yang sama di sini.
 */
async function submitReview(req, res) {
  try {
    const { flashcard_id, skor_kualitas } = req.body;
    const siswaId = req.user.id;

    if (flashcard_id === undefined || skor_kualitas === undefined) {
      return res.status(400).json({ error: 'bad_request', message: 'flashcard_id dan skor_kualitas wajib diisi' });
    }
    const q = Number(skor_kualitas);
    if (Number.isNaN(q) || q < 0 || q > 5) {
      return res.status(400).json({ error: 'bad_request', message: 'skor_kualitas harus angka 0-5' });
    }

    const flashcardId = parseInt(flashcard_id, 10);

    // Ambil (atau buat) state ReviewProgress sebelumnya.
    let progress = await prisma.reviewProgress.findUnique({
      where: { siswaId_flashcardId: { siswaId, flashcardId } },
    });

    const prevState = progress
      ? { n: progress.repetitionNumber, ef: progress.easeFactor, interval: progress.interval }
      : { n: initialState().repetitionNumber, ef: initialState().easeFactor, interval: initialState().interval };

    const result = calculateNextReview({
      q,
      n: prevState.n,
      ef: prevState.ef,
      interval: prevState.interval,
    });

    const now = new Date();

    if (progress) {
      progress = await prisma.reviewProgress.update({
        where: { siswaId_flashcardId: { siswaId, flashcardId } },
        data: {
          repetitionNumber: result.repetitionNumber,
          easeFactor: result.easeFactor,
          interval: result.interval,
          nextReviewDate: result.nextReviewDate,
          lastReviewedAt: now,
        },
      });
    } else {
      progress = await prisma.reviewProgress.create({
        data: {
          siswaId,
          flashcardId,
          repetitionNumber: result.repetitionNumber,
          easeFactor: result.easeFactor,
          interval: result.interval,
          nextReviewDate: result.nextReviewDate,
          lastReviewedAt: now,
        },
      });
    }

    await prisma.reviewLog.create({
      data: { siswaId, flashcardId, skorKualitas: q },
    });

    await prisma.user.update({
      where: { id: siswaId },
      data: { lastSyncAt: new Date() },
    });

    return res.status(200).json({ progress });
  } catch (err) {
    console.error('submitReview error:', err);
    return res.status(500).json({ error: 'internal_error', message: 'Gagal menyimpan hasil review' });
  }
}

/**
 * GET /review/schedule/:siswa_id?materi_id=<id>
 * Mengambil jadwal review terkini (flashcard yang next_review_date <= hari ini),
 * DIBATASI ke satu materi lewat query param materi_id -- sebelumnya endpoint ini
 * mengembalikan flashcard "baru" dari SELURUH materi yang belum direview siswa,
 * bukan cuma materi yang sedang dibuka (bug: siswa buka materi A tapi ikut
 * kebawa flashcard materi B, C, dst). materi_id bersifat opsional supaya
 * endpoint tetap kompatibel kalau suatu saat dibutuhkan jadwal lintas-materi.
 */
async function getReviewSchedule(req, res) {
  try {
    const siswaId = parseInt(req.params.siswa_id, 10);
    const materiId = req.query.materi_id ? parseInt(req.query.materi_id, 10) : null;

    if (req.user.role === 'siswa' && req.user.id !== siswaId) {
      return res.status(403).json({ error: 'forbidden', message: 'Tidak boleh melihat jadwal siswa lain' });
    }

    const today = new Date();

    const dueProgress = await prisma.reviewProgress.findMany({
      where: {
        siswaId,
        nextReviewDate: { lte: today },
        ...(materiId ? { flashcard: { materiId } } : {}),
      },
      include: { flashcard: true },
      orderBy: { nextReviewDate: 'asc' },
    });

    // Flashcard published yang belum pernah direview siswa ini juga masuk jadwal (baru).
    const reviewedFlashcardIds = (
      await prisma.reviewProgress.findMany({ where: { siswaId }, select: { flashcardId: true } })
    ).map((p) => p.flashcardId);

    const newFlashcards = await prisma.flashcard.findMany({
      where: {
        status: 'approved',
        id: { notIn: reviewedFlashcardIds.length ? reviewedFlashcardIds : [0] },
        ...(materiId ? { materiId } : {}),
      },
    });

    return res.status(200).json({
      due_for_review: dueProgress,
      new_flashcards: newFlashcards,
    });
  } catch (err) {
    console.error('getReviewSchedule error:', err);
    return res.status(500).json({ error: 'internal_error', message: 'Gagal mengambil jadwal review' });
  }
}

module.exports = { submitReview, getReviewSchedule };