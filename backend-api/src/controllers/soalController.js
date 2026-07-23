/**
 * soalController.js - Endpoint kuis untuk SISWA (FR-13).
 *
 * Sebelumnya siswa mengambil soal lewat GET /materi/:id/draft yang
 * role-restricted 'guru' saja -> selalu 403 untuk siswa. Endpoint di sini
 * menggantikannya dengan jalur khusus siswa yang hanya mengembalikan bank
 * soal berstatus "approved" dari materi yang sudah "published".
 */

const prisma = require('../config/db');
const { canStudentAccessMateri } = require('../services/materiAccessService');
const aiServiceClient = require('../services/aiServiceClient');

const OPSI_LABELS = ['A', 'B', 'C', 'D'];
const QUESTION_STOPWORDS = new Set([
  'apa', 'yang', 'dapat', 'dengan', 'pada', 'di', 'ke', 'dari', 'dan', 'atau',
  'adalah', 'itu', 'ini', 'untuk', 'dalam', 'secara', 'sebagai', 'berikut',
  'dimaksud', 'menjadi', 'terjadi',
]);

function normalizeSoalCandidates(parsed) {
  if (Array.isArray(parsed)) return parsed;
  if (Array.isArray(parsed?.items)) return parsed.items;
  if (Array.isArray(parsed?.soal)) return parsed.soal;
  if (Array.isArray(parsed?.bank_soal)) return parsed.bank_soal;
  if (Array.isArray(parsed?.bankSoal)) return parsed.bankSoal;
  if (Array.isArray(parsed?.questions)) return parsed.questions;
  if (parsed?.pertanyaan || parsed?.question) return [parsed];
  return [];
}

function normalizeSoalItem(item) {
  const pertanyaan = item?.pertanyaan || item?.question || item?.soal || '';
  const opsiJawaban = item?.opsi_jawaban || item?.opsiJawaban || item?.options || item?.pilihan || item?.choices || [];
  const jawabanBenar = item?.jawaban_benar || item?.jawabanBenar || item?.correct_answer || item?.answer || item?.kunci || '';
  return {
    pertanyaan: String(pertanyaan || '').trim(),
    opsi_jawaban: Array.isArray(opsiJawaban) ? opsiJawaban.map((opsi) => String(opsi || '').trim()) : [],
    jawaban_benar: String(jawabanBenar).trim().toUpperCase().slice(0, 1),
  };
}

function hasMalformedOption(opsiJawaban) {
  return opsiJawaban.some((opsi) => /^[.\-•]\s*/.test(opsi) || /^[A-D][.)]\s*/i.test(opsi));
}

function makeQuestionKey(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[?!.]+$/g, '')
    .trim();
}

function questionTokens(value) {
  return makeQuestionKey(value)
    .split(' ')
    .map((token) => token.trim())
    .filter((token) => token.length > 2 && !QUESTION_STOPWORDS.has(token));
}

function questionSimilarity(a, b) {
  const aTokens = new Set(questionTokens(a));
  const bTokens = new Set(questionTokens(b));
  if (aTokens.size === 0 || bTokens.size === 0) return 0;

  let intersection = 0;
  for (const token of aTokens) {
    if (bTokens.has(token)) intersection += 1;
  }
  const union = new Set([...aTokens, ...bTokens]).size;
  return intersection / union;
}

function isNearDuplicateQuestion(a, b) {
  const aKey = makeQuestionKey(a);
  const bKey = makeQuestionKey(b);
  if (!aKey || !bKey) return false;
  if (aKey === bKey) return true;
  return questionSimilarity(a, b) >= 0.72;
}

function dedupeSoalByQuestion(items) {
  const seen = new Set();
  return items.filter((item) => {
    const key = makeQuestionKey(item.pertanyaan);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function filterNewQuestionsOnly(candidates, existingQuestions) {
  return candidates.filter((candidate) => (
    !existingQuestions.some((question) => isNearDuplicateQuestion(candidate.pertanyaan, question))
  ));
}

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

    // Untuk siswa: cek otorisasi sesi aktif / MateriAccess permanen, sama
    // seperti flashcardController.getFlashcardsByMateri.
    if (req.user.role === 'siswa') {
      const allowed = await canStudentAccessMateri(req.user.id, materiId);
      if (!allowed) {
        return res.status(404).json({ error: 'not_found', message: 'Materi tidak ditemukan atau belum dipublikasikan' });
      }
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
      const opsiJawaban = soal ? JSON.parse(soal.opsiJawaban || '[]') : [];
      const selectedIndex = OPSI_LABELS.indexOf(j.jawaban_dipilih);
      const correctIndex = soal ? OPSI_LABELS.indexOf(soal.jawabanBenar) : -1;
      return {
        soal_id: j.soal_id,
        pertanyaan: soal?.pertanyaan || '',
        opsi_jawaban: opsiJawaban,
        jawaban_dipilih: j.jawaban_dipilih,
        jawaban_dipilih_teks: selectedIndex >= 0 ? opsiJawaban[selectedIndex] || '' : '',
        jawaban_benar: soal?.jawabanBenar || null,
        jawaban_benar_teks: correctIndex >= 0 ? opsiJawaban[correctIndex] || '' : '',
        benar,
      };
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

    // Logging Activity
    await prisma.activityLog.deleteMany({
      where: { userId: siswaId }
    });
    await prisma.activityLog.create({
      data: {
        userId: siswaId,
        action: 'KERJAKAN_KUIS',
        description: `Siswa ${req.user.nama || ''} mengerjakan kuis (Skor: ${skorBenar}/${soalList.length})`,
      },
    });

    await prisma.user.update({
      where: { id: siswaId },
      data: { lastSyncAt: new Date() },
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

async function regenerateSoalByMateri(req, res) {
  try {
    const materiId = parseInt(req.params.id, 10);
    const materi = await prisma.materi.findFirst({
      where: { id: materiId, guruId: req.user.id },
      include: { bankSoal: { orderBy: { id: 'asc' } } },
    });

    if (!materi) {
      return res.status(404).json({ error: 'not_found', message: 'Materi tidak ditemukan' });
    }
    if (!materi.bankSoal.length) {
      return res.status(400).json({ error: 'bad_request', message: 'Belum ada bank soal untuk digenerate ulang' });
    }

    const result = await aiServiceClient.generateVariant('soal', {
      judul_materi: materi.judul,
      items: materi.bankSoal.map((s) => ({
        pertanyaan: s.pertanyaan,
        opsi_jawaban: JSON.parse(s.opsiJawaban || '[]'),
        jawaban_benar: s.jawabanBenar,
      })),
    });
    const parsed = result?.draft?.parsed;
    const candidates = normalizeSoalCandidates(parsed);
    const normalizedCandidates = candidates.map(normalizeSoalItem);
    const existingQuestions = materi.bankSoal.map((soal) => soal.pertanyaan);
    const validCandidates = filterNewQuestionsOnly(dedupeSoalByQuestion(
      normalizedCandidates.filter(
        (item) =>
          item?.pertanyaan &&
          Array.isArray(item.opsi_jawaban) &&
          item.opsi_jawaban.length === 4 &&
          item.opsi_jawaban.every((opsi) => opsi.trim()) &&
          !hasMalformedOption(item.opsi_jawaban) &&
          ['A', 'B', 'C', 'D'].includes(item.jawaban_benar),
      ),
    ), existingQuestions);
    if (validCandidates.length === 0) {
      return res.status(502).json({
        error: 'bad_ai_response',
        message: 'AI belum menghasilkan soal yang benar-benar berbeda dari soal lama. Coba generate ulang lagi atau edit manual.',
      });
    }

    await prisma.$transaction(
      materi.bankSoal.slice(0, validCandidates.length).map((soal, index) => {
        const candidate = validCandidates[index];
        return prisma.bankSoal.update({
          where: { id: soal.id },
          data: {
            pertanyaan: candidate.pertanyaan,
            opsiJawaban: JSON.stringify(candidate.opsi_jawaban),
            jawabanBenar: candidate.jawaban_benar,
            status: 'draft',
          },
        });
      }),
    );

    const soal = await prisma.bankSoal.findMany({ where: { materiId }, orderBy: { id: 'asc' } });
    return res.status(200).json({ soal });
  } catch (err) {
    console.error('regenerateSoalByMateri error:', err);
    return res.status(err.statusCode || 500).json({
      error: err.name === 'AIServiceError' ? 'ai_service_error' : 'internal_error',
      message: err.message || 'Gagal generate ulang semua bank soal',
    });
  }
}

module.exports = {
  getSoalByMateri,
  submitQuiz,
  getRiwayatKuis,
  updateSoal,
  regenerateSoalByMateri,
  deleteSoal,
};