const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { requireAuth, requireRole } = require('../middleware/auth');

// POST /auth/login -> guru & siswa (username + password)
router.post('/login', authController.login);

// Registrasi akun harus dilakukan oleh guru yang sudah login.
// (Guru pertama dibuat via seed.js atau langsung di DB.)
router.post('/register-siswa', requireAuth, requireRole('guru'), authController.registerSiswa);
router.post('/register-guru', requireAuth, requireRole('guru'), authController.registerGuru);

// GET /auth/me -> data user yang sedang login (termasuk activeGroupId)
router.get('/me', requireAuth, authController.getMe);

// PUT /auth/active-group -> guru set/clear folder sesi aktif
router.put('/active-group', requireAuth, requireRole('guru'), authController.setActiveGroup);

module.exports = router;
