const express = require('express');
const router = express.Router();

const reviewController = require('../controllers/reviewController');
const { requireAuth, requireRole } = require('../middleware/auth');

// POST /review (siswa) — submit skor kualitas jawaban (0-5)
router.post('/', requireAuth, requireRole('siswa'), reviewController.submitReview);

// GET /review/schedule/:siswa_id (siswa)
router.get('/schedule/:siswa_id', requireAuth, requireRole('siswa'), reviewController.getReviewSchedule);

module.exports = router;
