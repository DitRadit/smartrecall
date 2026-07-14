const express = require('express');
const router = express.Router();

const flashcardController = require('../controllers/flashcardController');
const { requireAuth, requireRole } = require('../middleware/auth');

// GET /flashcard/materi/:id (siswa/guru) - semua flashcard published 1 materi,
// dipakai fitur download offline (lihat flashcardController.getFlashcardsByMateri)
router.get('/materi/:id', requireAuth, flashcardController.getFlashcardsByMateri);

// POST /flashcard/manual (guru) — fallback wajib saat AI gagal/limit (FR-7)
router.post('/manual', requireAuth, requireRole('guru'), flashcardController.createManualFlashcard);

// PUT /flashcard/:id (guru) - edit flashcard
router.put('/:id', requireAuth, requireRole('guru'), flashcardController.updateFlashcard);

// DELETE /flashcard/:id (guru) - hapus flashcard
router.delete('/:id', requireAuth, requireRole('guru'), flashcardController.deleteFlashcard);

module.exports = router;