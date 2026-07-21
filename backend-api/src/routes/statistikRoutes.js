const express = require('express');
const router = express.Router();
const statistikController = require('../controllers/statistikController');
const { requireAuth, requireRole } = require('../middleware/auth');

router.use(requireAuth, requireRole('guru'));

router.get('/kelas', statistikController.getStatistikKelas);
router.get('/siswa/:id', statistikController.getStatistikSiswa);

module.exports = router;
