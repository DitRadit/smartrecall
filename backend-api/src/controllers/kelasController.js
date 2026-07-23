const prisma = require('../config/db');

async function listKelas(req, res) {
  try {
    const kelasList = await prisma.kelas.findMany({
      orderBy: { nama: 'asc' },
    });
    return res.status(200).json({ kelas: kelasList });
  } catch (err) {
    console.error('listKelas error:', err);
    return res.status(500).json({ error: 'internal_error', message: 'Gagal memuat daftar kelas' });
  }
}

async function createKelas(req, res) {
  try {
    const { nama } = req.body;
    if (!nama || !nama.trim()) {
      return res.status(400).json({ error: 'bad_request', message: 'Nama kelas wajib diisi' });
    }
    
    const existing = await prisma.kelas.findUnique({ where: { nama: nama.trim() } });
    if (existing) {
      return res.status(409).json({ error: 'conflict', message: 'Nama kelas sudah ada' });
    }

    const kelasBaru = await prisma.kelas.create({
      data: { nama: nama.trim() },
    });
    return res.status(201).json({ message: 'Kelas berhasil ditambahkan', kelas: kelasBaru });
  } catch (err) {
    console.error('createKelas error:', err);
    return res.status(500).json({ error: 'internal_error', message: 'Gagal menambah kelas' });
  }
}

async function deleteKelas(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: 'bad_request', message: 'ID kelas tidak valid' });
    }

    const kelasExist = await prisma.kelas.findUnique({ where: { id } });
    if (!kelasExist) {
      return res.status(404).json({ error: 'not_found', message: 'Kelas tidak ditemukan' });
    }

    await prisma.kelas.delete({ where: { id } });
    return res.status(200).json({ message: 'Kelas berhasil dihapus' });
  } catch (err) {
    console.error('deleteKelas error:', err);
    return res.status(500).json({ error: 'internal_error', message: 'Gagal menghapus kelas' });
  }
}

module.exports = { listKelas, createKelas, deleteKelas };
