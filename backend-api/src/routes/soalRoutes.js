const express = require('express');
const router = express.Router();

const soalController = require('../controllers/soalController');
const { requireAuth, requireRole } = require('../middleware/auth');

// GET  /soal/materi/:id      (siswa) - ambil soal untuk 1 materi published
router.get('/materi/:id', requireAuth, soalController.getSoalByMateri);

// POST /soal/submit          (siswa) - submit jawaban, skor dihitung server
router.post('/submit', requireAuth, soalController.submitQuiz);

// GET  /soal/riwayat/:siswa_id (siswa/guru) - riwayat percobaan kuis
router.get('/riwayat/:siswa_id', requireAuth, soalController.getRiwayatKuis);

// POST /soal/materi/:id/regenerate (guru) - generate ulang semua bank soal 1 materi
router.post('/materi/:id/regenerate', requireAuth, requireRole('guru'), soalController.regenerateSoalByMateri);

// PUT /soal/:id (guru) - edit soal kuis
router.put('/:id', requireAuth, requireRole('guru'), soalController.updateSoal);

// DELETE /soal/:id (guru) - hapus soal kuis
router.delete('/:id', requireAuth, requireRole('guru'), soalController.deleteSoal);

module.exports = router;
