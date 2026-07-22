/**
 * userController.js - Manajemen pengguna oleh guru.
 * Guru bisa melihat, menambah, menghapus, dan reset password siswa & guru lain.
 *
 * Endpoint:
 *   GET    /users           - list semua pengguna
 *   POST   /users/siswa     - tambah akun siswa baru
 *   POST   /users/guru      - tambah akun guru baru
 *   DELETE /users/:id       - hapus akun (tidak bisa hapus diri sendiri)
 *   PUT    /users/:id/password - reset password akun
 */

const bcrypt = require('bcryptjs');
const prisma = require('../config/db');

/**
 * GET /users
 * List semua pengguna (guru bisa lihat semua siswa dan guru).
 */
async function listUsers(req, res) {
  try {
    const { role } = req.query; // opsional filter ?role=siswa atau ?role=guru

    const where = role && ['siswa', 'guru'].includes(role) ? { role } : {};

    const users = await prisma.user.findMany({
      where,
      orderBy: [{ role: 'asc' }, { nama: 'asc' }],
      select: {
        id: true,
        nama: true,
        role: true,
        username: true,
        nis: true,
        kelasId: true,
        createdAt: true,
      },
    });

    return res.status(200).json({ users });
  } catch (err) {
    console.error('listUsers error:', err);
    return res.status(500).json({ error: 'internal_error', message: 'Gagal mengambil daftar pengguna' });
  }
}

/**
 * POST /users/siswa
 * Guru menambah akun siswa baru.
 * Body: { nama, username, password, nis?, kelasId? }
 */
async function createSiswa(req, res) {
  try {
    const { nama, username, password, nis, kelasId } = req.body;

    if (!nama || !username || !password) {
      return res.status(400).json({ error: 'bad_request', message: 'nama, username, password wajib diisi' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'bad_request', message: 'Password minimal 6 karakter' });
    }

    const existing = await prisma.user.findUnique({ where: { username } });
    if (existing) {
      return res.status(409).json({ error: 'conflict', message: 'Username sudah digunakan' });
    }

    if (nis) {
      const existingNis = await prisma.user.findUnique({ where: { nis } });
      if (existingNis) {
        return res.status(409).json({ error: 'conflict', message: 'NIS sudah terdaftar' });
      }
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { nama, role: 'siswa', username, passwordHash, nis: nis || null, kelasId: kelasId || null },
      select: { id: true, nama: true, role: true, username: true, nis: true, kelasId: true, createdAt: true },
    });

    return res.status(201).json({ message: 'Akun siswa berhasil dibuat', user });
  } catch (err) {
    console.error('createSiswa error:', err);
    return res.status(500).json({ error: 'internal_error', message: 'Gagal membuat akun siswa' });
  }
}

/**
 * POST /users/guru
 * Guru menambah akun guru baru.
 * Body: { nama, username, password }
 */
async function createGuru(req, res) {
  try {
    const { nama, username, password } = req.body;

    if (!nama || !username || !password) {
      return res.status(400).json({ error: 'bad_request', message: 'nama, username, password wajib diisi' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'bad_request', message: 'Password minimal 6 karakter' });
    }

    const existing = await prisma.user.findUnique({ where: { username } });
    if (existing) {
      return res.status(409).json({ error: 'conflict', message: 'Username sudah digunakan' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { nama, role: 'guru', username, passwordHash },
      select: { id: true, nama: true, role: true, username: true, createdAt: true },
    });

    return res.status(201).json({ message: 'Akun guru berhasil dibuat', user });
  } catch (err) {
    console.error('createGuru error:', err);
    return res.status(500).json({ error: 'internal_error', message: 'Gagal membuat akun guru' });
  }
}

/**
 * DELETE /users/:id
 * Hapus akun pengguna. Guru tidak bisa hapus akunnya sendiri.
 */
async function deleteUser(req, res) {
  try {
    const targetId = parseInt(req.params.id, 10);
    if (Number.isNaN(targetId)) {
      return res.status(400).json({ error: 'bad_request', message: 'ID pengguna tidak valid' });
    }
    if (targetId === req.user.id) {
      return res.status(400).json({ error: 'bad_request', message: 'Tidak bisa menghapus akun sendiri' });
    }

    const user = await prisma.user.findUnique({ where: { id: targetId }, select: { id: true, nama: true, role: true } });
    if (!user) {
      return res.status(404).json({ error: 'not_found', message: 'Pengguna tidak ditemukan' });
    }

    await prisma.user.delete({ where: { id: targetId } });
    return res.status(200).json({ message: `Akun ${user.nama} berhasil dihapus` });
  } catch (err) {
    console.error('deleteUser error:', err);
    return res.status(500).json({ error: 'internal_error', message: 'Gagal menghapus pengguna' });
  }
}

/**
 * PUT /users/:id/password
 * Reset password pengguna lain. Guru tidak bisa reset password sendiri lewat endpoint ini.
 * Body: { password }
 */
async function resetPassword(req, res) {
  try {
    const targetId = parseInt(req.params.id, 10);
    if (Number.isNaN(targetId)) {
      return res.status(400).json({ error: 'bad_request', message: 'ID pengguna tidak valid' });
    }
    if (targetId === req.user.id) {
      return res.status(400).json({ error: 'bad_request', message: 'Gunakan halaman profil untuk ganti password sendiri' });
    }

    const { password } = req.body;
    if (!password || password.length < 6) {
      return res.status(400).json({ error: 'bad_request', message: 'Password baru minimal 6 karakter' });
    }

    const user = await prisma.user.findUnique({ where: { id: targetId }, select: { id: true } });
    if (!user) {
      return res.status(404).json({ error: 'not_found', message: 'Pengguna tidak ditemukan' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    await prisma.user.update({ where: { id: targetId }, data: { passwordHash } });

    return res.status(200).json({ message: 'Password berhasil direset' });
  } catch (err) {
    console.error('resetPassword error:', err);
    return res.status(500).json({ error: 'internal_error', message: 'Gagal mereset password' });
  }
}

module.exports = { listUsers, createSiswa, createGuru, deleteUser, resetPassword };
