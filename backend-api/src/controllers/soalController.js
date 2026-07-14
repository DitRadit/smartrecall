/**
 * soalController.js - Endpoint kuis untuk SISWA (FR-13).
 *
 * Sebelumnya siswa mengambil soal lewat GET /materi/:id/draft yang
 * role-restricted 'guru' saja -> selalu 403 untuk siswa. Endpoint di sini
 * menggantikannya dengan jalur khusus siswa yang hanya mengembalikan bank
 * soal berstatus "approved" dari materi yang sudah "published".
 */

const prisma = require('../config/db');

/**
 * GET /soal/materi/:id
 * Siswa mengambil daftar soal (bank soal approved) untuk satu materi published.
 * Jawaban benar TIDAK disertakan di response ini -- baru dievaluasi di server
 * saat submit (lih. submitQuiz), supaya tidak bisa dicurangi lewat DevTools.
 */
async function getSoalByMateri(req, res) {
  try {
    const materiId = parseInt(req.params.id, 10);

    const materi = await prisma.materi.findFirst({
      where: { id: materiId, status: 'published' },
      include: {
        bankSoal: { where: { status: 'approved' } },
      },
    });

    if (!materi) {
      return res.status(404).json({ error: 'not_found', message: 'Materi tidak ditemukan atau belum dipublikasikan' });
    }

    const soalUntukSiswa = materi.bankSoal.map((s) => ({
      id: s.id,
      pertanyaan: s.pertanyaan,
      opsi_jawaban: JSON.parse(s.opsiJawaban || '[]'),
      // jawabanBenar sengaja TIDAK dikirim ke klien.
    }));

    return res.status(200).json({ materi_id: materi.id, judul: materi.judul, soal: soalUntukSiswa });
  } catch (err) {
    console.error('getSoalByMateri error:', err);
    return res.status(500).json({ error: 'internal_error', message: 'Gagal mengambil soal' });
  }
}

/**
 * POST /soal/submit
 * Body: { materi_id, jawaban: [{ soal_id, jawaban_dipilih }] }
 *
 * Skor dihitung di server (bukan percaya skor dari klien), lalu disimpan
 * sebagai QuizAttempt agar hasil kuis persisten (sebelumnya hilang saat
 * reload karena hanya dihitung di state React).
 */
async function submitQuiz(req, res) {
  try {
    const { materi_id, jawaban } = req.body;
    const siswaId = req.user.id;

    if (!materi_id || !Array.isArray(jawaban)) {
      return res.status(400).json({ error: 'bad_request', message: 'materi_id dan jawaban (array) wajib diisi' });
    }

    const materiId = parseInt(materi_id, 10);
    const soalIds = jawaban.map((j) => parseInt(j.soal_id, 10));

    const soalList = await prisma.bankSoal.findMany({
      where: { id: { in: soalIds }, materiId, status: 'approved' },
    });

    let skorBenar = 0;
    const detail = jawaban.map((j) => {
      const soal = soalList.find((s) => s.id === parseInt(j.soal_id, 10));
      const benar = !!soal && soal.jawabanBenar === j.jawaban_dipilih;
      if (benar) skorBenar += 1;
      return { soal_id: j.soal_id, jawaban_dipilih: j.jawaban_dipilih, benar };
    });

    const attempt = await prisma.quizAttempt.create({
      data: {
        siswaId,
        materiId,
        skorBenar,
        totalSoal: soalList.length,
        jawabanDetail: JSON.stringify(detail),
      },
    });

    return res.status(201).json({
      attempt_id: attempt.id,
      skor_benar: skorBenar,
      total_soal: soalList.length,
      detail,
    });
  } catch (err) {
    console.error('submitQuiz error:', err);
    return res.status(500).json({ error: 'internal_error', message: 'Gagal menyimpan hasil kuis' });
  }
}

/**
 * GET /soal/riwayat/:siswa_id
 * Melihat riwayat percobaan kuis siswa (untuk siswa sendiri, atau guru).
 */
async function getRiwayatKuis(req, res) {
  try {
    const siswaId = parseInt(req.params.siswa_id, 10);

    if (req.user.role === 'siswa' && req.user.id !== siswaId) {
      return res.status(403).json({ error: 'forbidden', message: 'Tidak boleh melihat riwayat siswa lain' });
    }

    const attempts = await prisma.quizAttempt.findMany({
      where: { siswaId },
      include: { materi: { select: { judul: true } } },
      orderBy: { submittedAt: 'desc' },
    });

    return res.status(200).json({ attempts });
  } catch (err) {
    console.error('getRiwayatKuis error:', err);
    return res.status(500).json({ error: 'internal_error', message: 'Gagal mengambil riwayat kuis' });
  }
}

async function updateSoal(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    const { pertanyaan, opsi_jawaban, jawaban_benar } = req.body;

    if (!pertanyaan || !Array.isArray(opsi_jawaban) || !jawaban_benar) {
      return res.status(400).json({
        error: 'bad_request',
        message: 'Pertanyaan, opsi jawaban (array), dan jawaban benar wajib diisi',
      });
    }

    const soal = await prisma.bankSoal.findUnique({
      where: { id },
      include: { materi: true },
    });

    if (!soal) {
      return res.status(404).json({ error: 'not_found', message: 'Soal tidak ditemukan' });
    }

    if (soal.materi.guruId !== req.user.id) {
      return res.status(403).json({ error: 'forbidden', message: 'Anda tidak memiliki akses ke soal ini' });
    }

    const updated = await prisma.bankSoal.update({
      where: { id },
      data: {
        pertanyaan,
        opsiJawaban: JSON.stringify(opsi_jawaban),
        jawabanBenar: jawaban_benar,
      },
    });

    return res.status(200).json({
      soal: {
        id: updated.id,
        pertanyaan: updated.pertanyaan,
        opsi_jawaban: JSON.parse(updated.opsiJawaban),
        jawaban_benar: updated.jawabanBenar,
      },
    });
  } catch (err) {
    console.error('updateSoal error:', err);
    return res.status(500).json({ error: 'internal_error', message: 'Gagal memperbarui soal' });
  }
}

async function deleteSoal(req, res) {
  try {
    const id = parseInt(req.params.id, 10);

    const soal = await prisma.bankSoal.findUnique({
      where: { id },
      include: { materi: true },
    });

    if (!soal) {
      return res.status(404).json({ error: 'not_found', message: 'Soal tidak ditemukan' });
    }

    if (soal.materi.guruId !== req.user.id) {
      return res.status(403).json({ error: 'forbidden', message: 'Anda tidak memiliki akses ke soal ini' });
    }

    await prisma.bankSoal.delete({
      where: { id },
    });

    return res.status(200).json({ message: 'Soal berhasil dihapus' });
  } catch (err) {
    console.error('deleteSoal error:', err);
    return res.status(500).json({ error: 'internal_error', message: 'Gagal menghapus soal' });
  }
}

module.exports = { getSoalByMateri, submitQuiz, getRiwayatKuis, updateSoal, deleteSoal };
