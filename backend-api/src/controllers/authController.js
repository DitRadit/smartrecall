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
 * GET /auth/me
 * Ambil data user yang sedang login (termasuk activeGroupId untuk guru).
 */
async function getMe(req, res) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, nama: true, role: true, username: true, nis: true, kelasId: true, activeGroupId: true, activeKelasId: true },
    });
    if (!user) {
      return res.status(404).json({ error: 'not_found', message: 'User tidak ditemukan' });
    }
    return res.status(200).json({ user });
  } catch (err) {
    console.error('getMe error:', err);
    return res.status(500).json({ error: 'internal_error', message: 'Gagal mengambil data user' });
  }
}

/**
 * PUT /auth/active-group
 * Guru set atau clear folder sesi aktif. Body: { groupId: number | null, kelasId: number | null }
 * Jika groupId null → sesi diakhiri, siswa tidak bisa lihat apapun.
 */
async function setActiveGroup(req, res) {
  try {
    const { groupId, kelasId } = req.body;
    const parsedGroupId = groupId === undefined || groupId === null || groupId === ''
      ? null
      : parseInt(groupId, 10);
      
    const parsedKelasId = kelasId === undefined || kelasId === null || kelasId === ''
      ? null
      : parseInt(kelasId, 10);

    if (parsedGroupId !== null && Number.isNaN(parsedGroupId)) {
      return res.status(400).json({ error: 'bad_request', message: 'groupId tidak valid' });
    }
    if (parsedKelasId !== null && Number.isNaN(parsedKelasId)) {
      return res.status(400).json({ error: 'bad_request', message: 'kelasId tidak valid' });
    }

    // Pastikan folder milik guru ini (jika bukan null)
    if (parsedGroupId !== null) {
      const group = await prisma.group.findFirst({
        where: { id: parsedGroupId, guruId: req.user.id },
        select: { id: true, nama: true },
      });
      if (!group) {
        return res.status(404).json({ error: 'not_found', message: 'Folder tidak ditemukan atau bukan milik Anda' });
      }
    }
    
    // Pastikan kelas valid (jika bukan null)
    if (parsedKelasId !== null) {
      const kelasExist = await prisma.kelas.findUnique({
        where: { id: parsedKelasId },
        select: { id: true },
      });
      if (!kelasExist) {
        return res.status(404).json({ error: 'not_found', message: 'Kelas tidak ditemukan' });
      }
    }

    await prisma.user.update({
      where: { id: req.user.id },
      data: { activeGroupId: parsedGroupId, activeKelasId: parsedKelasId },
    });

    return res.status(200).json({
      message: parsedGroupId ? 'Sesi kelas dimulai' : 'Sesi kelas diakhiri',
      activeGroupId: parsedGroupId,
      activeKelasId: parsedKelasId,
    });
  } catch (err) {
    console.error('setActiveGroup error:', err);
    return res.status(500).json({ error: 'internal_error', message: 'Gagal mengatur sesi kelas' });
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

    // Log login activity (keep only the latest by deleting old ones)
    try {
      await prisma.activityLog.deleteMany({
        where: { userId: user.id },
      });
      await prisma.activityLog.create({
        data: {
          userId: user.id,
          action: 'LOGIN',
          description: `${user.nama} berhasil login`,
        },
      });
    } catch (e) {
      console.error('Failed to log login:', e);
    }

    return res.status(200).json({
      token,
      user: { id: user.id, nama: user.nama, role: user.role, username: user.username, nis: user.nis },
    });
  } catch (err) {
    console.error('login error:', err);
    return res.status(500).json({ error: 'internal_error', message: 'Gagal login' });
  }
}

module.exports = { registerGuru, registerSiswa, login, getMe, setActiveGroup };
