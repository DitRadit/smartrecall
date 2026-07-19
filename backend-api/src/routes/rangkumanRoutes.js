const express = require('express');
const router = express.Router();

const rangkumanController = require('../controllers/rangkumanController');
const { requireAuth, requireRole } = require('../middleware/auth');

// GET /rangkuman/materi/:id (siswa/guru) - ambil rangkuman 1 materi published
router.get('/materi/:id', requireAuth, rangkumanController.getRangkumanByMateri);

// PUT /rangkuman/:id (guru) - edit rangkuman
router.put('/:id', requireAuth, requireRole('guru'), rangkumanController.updateRangkuman);

// POST /rangkuman/:id/regenerate (guru) - generate ulang rangkuman tanpa upload PDF
router.post('/:id/regenerate', requireAuth, requireRole('guru'), rangkumanController.regenerateRangkuman);

// DELETE /rangkuman/:id (guru) - hapus rangkuman
router.delete('/:id', requireAuth, requireRole('guru'), rangkumanController.deleteRangkuman);

module.exports = router;
