const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { requireAuth, requireRole } = require('../middleware/auth');

// Semua endpoint /users hanya untuk guru yang sudah login
router.use(requireAuth, requireRole('guru'));

router.get('/', userController.listUsers);
router.post('/siswa', userController.createSiswa);
router.post('/guru', userController.createGuru);
router.delete('/:id', userController.deleteUser);
router.put('/:id/password', userController.resetPassword);

module.exports = router;
