/**
 * flashcardController.js - Input manual flashcard/soal oleh guru.
 *
 * Ini adalah fallback WAJIB (FR-7, ARCHITECTURE.md batasan bagian 8:
 * "Jangan hilangkan jalur input manual guru") saat ai-service down/limit.
 */

const prisma = require('../config/db');

/**
 * POST /flashcard/manual
 * Body: { materi_id, pertanyaan, jawaban }
 */
async function createManualFlashcard(req, res) {
  try {
    const { materi_id, pertanyaan, jawaban } = req.body;

    if (!materi_id || !pertanyaan || !jawaban) {
      return res.status(400).json({
        error: 'bad_request',
        message: 'materi_id, pertanyaan, dan jawaban wajib diisi',
      });
    }

    const materi = await prisma.materi.findFirst({
      where: { id: parseInt(materi_id, 10), guruId: req.user.id },
    });
    if (!materi) {
      return res.status(404).json({ error: 'not_found', message: 'Materi tidak ditemukan' });
    }

    const flashcard = await prisma.flashcard.create({
      data: {
        materiId: materi.id,
        pertanyaan,
        jawaban,
        status: 'draft', // tetap lewat alur review guru sebelum publish (human-in-the-loop)
      },
    });

    return res.status(201).json({ flashcard });
  } catch (err) {
    console.error('createManualFlashcard error:', err);
    return res.status(500).json({ error: 'internal_error', message: 'Gagal membuat flashcard manual' });
  }
}

async function updateFlashcard(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    const { pertanyaan, jawaban } = req.body;

    if (!pertanyaan || !jawaban) {
      return res.status(400).json({ error: 'bad_request', message: 'Pertanyaan dan jawaban wajib diisi' });
    }

    const flashcard = await prisma.flashcard.findUnique({
      where: { id },
      include: { materi: true },
    });

    if (!flashcard) {
      return res.status(404).json({ error: 'not_found', message: 'Flashcard tidak ditemukan' });
    }

    if (flashcard.materi.guruId !== req.user.id) {
      return res.status(403).json({ error: 'forbidden', message: 'Anda tidak memiliki akses ke flashcard ini' });
    }

    const updated = await prisma.flashcard.update({
      where: { id },
      data: { pertanyaan, jawaban },
    });

    return res.status(200).json({ flashcard: updated });
  } catch (err) {
    console.error('updateFlashcard error:', err);
    return res.status(500).json({ error: 'internal_error', message: 'Gagal memperbarui flashcard' });
  }
}

async function deleteFlashcard(req, res) {
  try {
    const id = parseInt(req.params.id, 10);

    const flashcard = await prisma.flashcard.findUnique({
      where: { id },
      include: { materi: true },
    });

    if (!flashcard) {
      return res.status(404).json({ error: 'not_found', message: 'Flashcard tidak ditemukan' });
    }

    if (flashcard.materi.guruId !== req.user.id) {
      return res.status(403).json({ error: 'forbidden', message: 'Anda tidak memiliki akses ke flashcard ini' });
    }

    await prisma.flashcard.delete({
      where: { id },
    });

    return res.status(200).json({ message: 'Flashcard berhasil dihapus' });
  } catch (err) {
    console.error('deleteFlashcard error:', err);
    return res.status(500).json({ error: 'internal_error', message: 'Gagal menghapus flashcard' });
  }
}

/**
 * GET /flashcard/materi/:id
 * Siswa mengambil SEMUA flashcard published (status "approved") untuk 1
 * materi, terlepas dari status jadwal spaced-repetition (due/belum due).
 *
 * Dipakai khusus untuk fitur "Download materi untuk offline" (siswa) --
 * endpoint /review/schedule/:siswa_id hanya mengembalikan kartu yang due
 * atau belum pernah direview ("new"), jadi kalau siswa sudah mereview
 * SEMUA kartu materi ini, endpoint itu balikin array kosong walau
 * kartunya tetap ada. Halaman ReviewFlashcard.jsx TETAP pakai
 * /review/schedule (bukan endpoint ini) karena dia butuh logika due/new,
 * bukan sekadar daftar mentah.
 */
async function getFlashcardsByMateri(req, res) {
  try {
    const materiId = parseInt(req.params.id, 10);

    const materi = await prisma.materi.findFirst({
      where: { id: materiId, status: 'published' },
    });
    if (!materi) {
      return res.status(404).json({ error: 'not_found', message: 'Materi tidak ditemukan' });
    }

    const flashcards = await prisma.flashcard.findMany({
      where: { materiId, status: 'approved' },
    });

    return res.status(200).json({ flashcards });
  } catch (err) {
    console.error('getFlashcardsByMateri error:', err);
    return res.status(500).json({ error: 'internal_error', message: 'Gagal mengambil flashcard materi' });
  }
}

module.exports = { createManualFlashcard, updateFlashcard, deleteFlashcard, getFlashcardsByMateri };