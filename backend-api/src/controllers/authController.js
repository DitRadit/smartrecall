/**
 * authController.js - Login & registrasi guru/siswa (FR-1, FR-9).
 *
 * PENTING (PRD.md FR-9, direvisi): siswa login dengan username + password,
 * sama seperti guru. Autentikasi sepenuhnya diproses oleh backend-api di
 * Local Server Hub (bcrypt + JWT) -- tidak butuh OTP/SMS gateway karena
 * tidak ada koneksi internet. Akun siswa (username & password awal)
 * dibuatkan oleh guru/admin sekolah saat onboarding, bukan self-registration
 * terbuka. NIS tetap disimpan sebagai identifier administratif tambahan
 * (opsional), bukan sebagai kredensial login.
 */

const bcrypt = require('bcryptjs');
const prisma = require('../config/db');
const { signToken } = require('../middleware/auth');

/**
 * POST /auth/register-guru
 * Registrasi akun guru (username + password).
 */
async function registerGuru(req, res) {
  try {
    const { nama, username, password } = req.body;

    if (!nama || !username || !password) {
      return res.status(400).json({ error: 'bad_request', message: 'nama, username, password wajib diisi' });
    }

    const existing = await prisma.user.findUnique({ where: { username } });
    if (existing) {
      return res.status(409).json({ error: 'conflict', message: 'Username sudah digunakan' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: { nama, role: 'guru', username, passwordHash },
    });

    const token = signToken(user);
    return res.status(201).json({
      token,
      user: { id: user.id, nama: user.nama, role: user.role, username: user.username },
    });
  } catch (err) {
    console.error('registerGuru error:', err);
    return res.status(500).json({ error: 'internal_error', message: 'Gagal registrasi guru' });
  }
}

/**
 * POST /auth/register-siswa
 * Registrasi akun siswa (username + password + NIS opsional). Idealnya
 * dipanggil oleh guru/admin saat mendaftarkan siswa ke sistem, bukan
 * self-registration bebas.
 */
async function registerSiswa(req, res) {
  try {
    const { nama, username, password, nis, kelasId } = req.body;

    if (!nama || !username || !password) {
      return res.status(400).json({ error: 'bad_request', message: 'nama, username, password wajib diisi' });
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
    });

    const token = signToken(user);
    return res.status(201).json({
      token,
      user: { id: user.id, nama: user.nama, role: user.role, username: user.username, nis: user.nis },
    });
  } catch (err) {
    console.error('registerSiswa error:', err);
    return res.status(500).json({ error: 'internal_error', message: 'Gagal registrasi siswa' });
  }
}

/**
 * POST /auth/login
 * Login untuk guru maupun siswa: username + password.
 */
async function login(req, res) {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'bad_request', message: 'username dan password wajib diisi' });
    }

    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) {
      return res.status(401).json({ error: 'unauthorized', message: 'Username atau password salah' });
    }

    const validPassword = await bcrypt.compare(password, user.passwordHash);
    if (!validPassword) {
      return res.status(401).json({ error: 'unauthorized', message: 'Username atau password salah' });
    }

    const token = signToken(user);
    return res.status(200).json({
      token,
      user: { id: user.id, nama: user.nama, role: user.role, username: user.username, nis: user.nis },
    });
  } catch (err) {
    console.error('login error:', err);
    return res.status(500).json({ error: 'internal_error', message: 'Gagal login' });
  }
}

module.exports = { registerGuru, registerSiswa, login };
