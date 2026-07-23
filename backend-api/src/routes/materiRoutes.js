const express = require('express');
const multer = require('multer');
const router = express.Router();

const materiController = require('../controllers/materiController');
const { requireAuth, requireRole } = require('../middleware/auth');

// Simpan file di memory (buffer) supaya bisa langsung diteruskan ke ai-service
// tanpa perlu disimpan permanen di backend-api (ai-service yang menyimpan
// sementara & menghapusnya setelah diproses, lihat ai-service/routes/generate.py).
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype !== 'application/pdf') {
      return cb(new Error('Hanya file PDF yang diizinkan'));
    }
    cb(null, true);
  },
});

// POST /materi/upload (guru)
router.post('/upload', requireAuth, requireRole('guru'), upload.single('file'), materiController.uploadMateri);

// GET /materi (siswa: published only, guru: milik sendiri)
router.get('/', requireAuth, materiController.listMateri);

// PUT /materi/:id/move (guru) - pindah materi ke folder lain/root
router.put('/:id/move', requireAuth, requireRole('guru'), materiController.moveMateri);

// GET /materi/:id/generate-progress (guru) - progress generate AI background
router.get('/:id/generate-progress', requireAuth, requireRole('guru'), materiController.getGenerateProgress);

// GET /materi/:id/draft (guru)
router.get('/:id/draft', requireAuth, requireRole('guru'), materiController.getMateriDraft);

// GET /materi/:id/ppt/siswa - siswa download PPT dari materi published
router.get('/:id/ppt/siswa', requireAuth, materiController.downloadMateriPptSiswa);

// POST /materi/:id/log-download - catat aktivitas download materi
router.post('/:id/log-download', requireAuth, materiController.logDownloadMateri);

// GET /materi/:id/ppt (guru) - download PPT hasil generate opsional
router.get('/:id/ppt', requireAuth, requireRole('guru'), materiController.downloadMateriPpt);

// POST /materi/:id/approve (guru)
router.post('/:id/approve', requireAuth, requireRole('guru'), materiController.approveMateri);

// DELETE /materi/:id (guru) - hapus materi + seluruh konten turunannya (cascade)
router.delete('/:id', requireAuth, requireRole('guru'), materiController.deleteMateri);

module.exports = router;
