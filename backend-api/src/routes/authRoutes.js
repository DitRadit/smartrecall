const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// Registrasi (tidak ada di kontrak minimal ARCHITECTURE.md, tapi dibutuhkan
// agar /auth/login punya user untuk login -- lih. FR-1, FR-9)
router.post('/register-guru', authController.registerGuru);
router.post('/register-siswa', authController.registerSiswa);

// POST /auth/login -> guru & siswa (username + password)
router.post('/login', authController.login);

module.exports = router;
