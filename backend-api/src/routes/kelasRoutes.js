const express = require('express');
const router = express.Router();
const kelasController = require('../controllers/kelasController');
const { requireAuth, requireRole } = require('../middleware/auth');

// List kelas bisa diakses oleh admin dan guru
router.get('/', requireAuth, (req, res, next) => {
  if (req.user.role === 'admin' || req.user.role === 'guru') {
    return next();
  }
  return res.status(403).json({ error: 'forbidden', message: 'Akses ditolak' });
}, kelasController.listKelas);

// Create & Delete hanya untuk Admin
router.post('/', requireAuth, requireRole('admin'), kelasController.createKelas);
router.delete('/:id', requireAuth, requireRole('admin'), kelasController.deleteKelas);

module.exports = router;
