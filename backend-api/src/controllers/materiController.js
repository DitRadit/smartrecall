/**
 * materiController.js - Upload materi, trigger generate AI, list materi, review draft, approve.
 *
 * Endpoint sesuai kontrak API ARCHITECTURE.md bagian 3.3:
 *   POST /materi/upload        (guru)
 *   GET  /materi                (siswa/guru)
 *   GET  /materi/:id/draft      (guru)
 *   POST /materi/:id/approve    (guru)
 */

const prisma = require('../config/db');
const aiServiceClient = require('../services/aiServiceClient');
const { getActiveSessionGroupIds, getAccessibleMateriIds } = require('../services/materiAccessService');
const fs = require('fs/promises');
const path = require('path');

const GENERATED_PPT_DIR = path.join(__dirname, '..', '..', 'generated', 'ppt');
const GENERATION_PROGRESS_TTL_MS = 30 * 60 * 1000;
const generationProgress = new Map();

function setGenerationProgress(materiId, update) {
  const previous = generationProgress.get(materiId) || {};
  generationProgress.set(materiId, {
    materiId,
    status: 'running',
    progress: 5,
    message: 'Menyiapkan proses AI...',
    startedAt: previous.startedAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...previous,
    ...update,
  });
}

function getGenerationProgressSnapshot(materiId) {
  const progress = generationProgress.get(materiId);
  if (!progress) return null;

  const updatedAt = new Date(progress.updatedAt).getTime();
  if (Number.isFinite(updatedAt) && Date.now() - updatedAt > GENERATION_PROGRESS_TTL_MS) {
    generationProgress.delete(materiId);
    return null;
  }

  return progress;
}

function sanitizeFilename(value) {
  return String(value || 'materi')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'materi';
}

function normalizeFlashcardDraftItems(items) {
  return items
    .map((item) => ({
      pertanyaan: String(item?.pertanyaan || '').trim(),
      jawaban: String(item?.jawaban || '').trim(),
    }))
    .filter((item) => item.pertanyaan && item.jawaban);
}

function makeQuestionKey(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[?!.]+$/g, '')
    .trim();
}

function dedupeByQuestion(items) {
  const seen = new Set();
  return items.filter((item) => {
    const key = makeQuestionKey(item.pertanyaan);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function normalizeSoalDraftItems(items) {
  const validItems = items
    .map((item) => {
      const opsiJawaban = Array.isArray(item?.opsi_jawaban) ? item.opsi_jawaban : [];
      return {
        pertanyaan: String(item?.pertanyaan || '').trim(),
        opsi_jawaban: opsiJawaban.map((opsi) => String(opsi || '').trim()).filter(Boolean),
        jawaban_benar: String(item?.jawaban_benar || '').trim().toUpperCase().slice(0, 1),
      };
    })
    .filter(
      (item) =>
        item.pertanyaan &&
        item.opsi_jawaban.length >= 2 &&
        ['A', 'B', 'C', 'D'].includes(item.jawaban_benar),
    );
  return dedupeByQuestion(validItems);
}

async function saveGeneratedPpt(materiId, judul, ppt) {
  if (!ppt?.content_base64) return null;

  await fs.mkdir(GENERATED_PPT_DIR, { recursive: true });
  const filename = `${materiId}-${sanitizeFilename(judul)}.pptx`;
  const fullPath = path.join(GENERATED_PPT_DIR, filename);
  await fs.writeFile(fullPath, Buffer.from(ppt.content_base64, 'base64'));
  await prisma.materi.update({
    where: { id: materiId },
    data: { pptFile: filename },
  });
  return filename;
}

/**
 * POST /materi/upload
 * Guru upload PDF. Materi disimpan status "draft", lalu job generate AI
 * di-trigger untuk KETIGA jenis konten sekaligus (flashcard, rangkuman,
 * bank soal) dari satu file yang sama -- guru tidak perlu memilih jenis
 * konten satu-satu saat upload (ai-service melakukan 1x ekstraksi PDF,
 * lalu 3x generate LLM, lihat ai-service/routes/generate.py).
 * Sesuai ARCHITECTURE.md 3.1, request ini idealnya non-blocking terhadap
 * trafik siswa yang sedang aktif -- pada skeleton ini job dijalankan
 * secara async (fire-and-forget after response) sebagai placeholder untuk
 * queue yang lebih matang (mis. BullMQ) di iterasi berikutnya.
 */
async function uploadMateri(req, res) {
  try {
    const { judul, groupId } = req.body;
    const generatePpt = ['true', '1', 'yes'].includes(String(req.body.generate_ppt || '').toLowerCase());
    const file = req.file; // dari multer memory storage

    if (!file) {
      return res.status(400).json({ error: 'bad_request', message: 'File PDF wajib disertakan' });
    }
    if (!judul) {
      return res.status(400).json({ error: 'bad_request', message: 'judul materi wajib diisi' });
    }

    const materi = await prisma.materi.create({
      data: {
        guruId: req.user.id,
        judul,
        groupId: groupId ? parseInt(groupId, 10) : null,
        fileOriginal: file.originalname,
        status: 'draft',
      },
    });

    // Logging Activity
    await prisma.activityLog.create({
      data: {
        userId: req.user.id,
        action: 'GENERATE_MATERI',
        description: `Guru ${req.user.nama || ''} mengunggah materi "${judul}"`,
      },
    });

    setGenerationProgress(materi.id, {
      status: 'queued',
      progress: 10,
      message: 'File diterima. Menunggu proses AI dimulai...',
    });

    // Trigger job generate AI (async, tidak blocking response ke guru).
    // Kegagalan di sini TIDAK mengubah status materi menjadi error yang fatal --
    // guru tetap bisa input manual lewat /flashcard/manual (FR-7).
    generateAIContentInBackground(materi.id, file.buffer, file.originalname, { generatePpt, judul });

    return res.status(202).json({
      message: generatePpt
        ? 'Materi diterima, proses generate AI dan PPT berjalan di background.'
        : 'Materi diterima, proses generate AI (flashcard, rangkuman, bank soal) berjalan di background.',
      materi: { id: materi.id, judul: materi.judul, status: materi.status },
      progress: getGenerationProgressSnapshot(materi.id),
    });
  } catch (err) {
    console.error('uploadMateri error:', err);
    return res.status(500).json({ error: 'internal_error', message: 'Gagal upload materi' });
  }
}

/**
 * Memanggil ai-service SEKALI (jenis_konten="all" secara default di
 * ai-service), lalu memecah hasil draft.flashcard / draft.rangkuman /
 * draft.soal ke tabel masing-masing. Kegagalan pada salah satu jenis
 * (dilaporkan lewat field "errors" dari ai-service) tidak menggagalkan
 * jenis lain yang berhasil -- guru tetap bisa review yang berhasil &
 * lengkapi manual yang gagal.
 */
async function generateAIContentInBackground(materiId, fileBuffer, filename, options = {}) {
  try {
    setGenerationProgress(materiId, {
      status: 'running',
      progress: 20,
      message: 'Mengirim PDF ke AI service...',
    });

    const result = await aiServiceClient.generateMateri(fileBuffer, filename, 'all', {
      generatePpt: Boolean(options.generatePpt),
      judul: options.judul,
    });
    const draft = result?.draft;

    if (!draft) {
      setGenerationProgress(materiId, {
        status: 'error',
        progress: 100,
        message: 'AI service tidak mengembalikan draft.',
      });
      console.warn(`[materi ${materiId}] ai-service tidak mengembalikan draft sama sekali.`);
      return;
    }

    const savedJenis = [];
    const failedJenis = []; // parsed kosong/invalid meski ai-service melaporkan "success"

    const flashcardDraft = draft.flashcard?.parsed;
    if (Array.isArray(flashcardDraft) && flashcardDraft.length > 0) {
      setGenerationProgress(materiId, {
        status: 'running',
        progress: 45,
        message: 'Menyimpan flashcard hasil AI...',
      });
      const validFlashcards = normalizeFlashcardDraftItems(flashcardDraft);
      if (validFlashcards.length > 0) {
        await prisma.flashcard.createMany({
          data: validFlashcards.map((item) => ({
            materiId,
            pertanyaan: item.pertanyaan,
            jawaban: item.jawaban,
            status: 'draft',
          })),
        });
        savedJenis.push('flashcard');
      } else {
        failedJenis.push('flashcard');
        console.warn(`[materi ${materiId}] flashcard parsed berupa array, tapi semua item invalid/kosong.`);
      }
    } else if (draft.flashcard) {
      failedJenis.push('flashcard');
      console.warn(
        `[materi ${materiId}] flashcard gagal diparse jadi array (kemungkinan JSON invalid dari LLM). raw_text (500 char pertama):`,
        (draft.flashcard.raw_text || '').slice(0, 500),
      );
    }

    const soalDraft = draft.soal?.parsed;
    if (Array.isArray(soalDraft) && soalDraft.length > 0) {
      setGenerationProgress(materiId, {
        status: 'running',
        progress: 65,
        message: 'Menyimpan bank soal hasil AI...',
      });
      const validSoal = normalizeSoalDraftItems(soalDraft);
      if (validSoal.length > 0) {
        await prisma.bankSoal.createMany({
          data: validSoal.map((item) => ({
            materiId,
            pertanyaan: item.pertanyaan,
            opsiJawaban: JSON.stringify(item.opsi_jawaban),
            jawabanBenar: item.jawaban_benar,
            status: 'draft',
          })),
        });
        savedJenis.push('soal');
      } else {
        failedJenis.push('soal');
        console.warn(`[materi ${materiId}] soal parsed berupa array, tapi semua item invalid/kosong.`);
      }
    } else if (draft.soal) {
      // ai-service melaporkan status 200 (bukan errors) tapi parsed = null/bukan
      // array -- ini beda dari NIMAPIError, jadi tidak muncul di result.errors.
      // Log raw_text di sini supaya guru/admin bisa lacak kenapa Bank Soal Draft
      // kosong, bukan cuma tahu "gagal" tanpa detail (lihat juga nim_client.py
      // _parse_llm_json yang sudah menyertakan jenis_konten di log ai-service).
      failedJenis.push('soal');
      console.warn(
        `[materi ${materiId}] soal gagal diparse jadi array (kemungkinan JSON invalid dari LLM, mis. tanda kutip liar di teks opsi). raw_text (500 char pertama):`,
        (draft.soal.raw_text || '').slice(0, 500),
      );
    }

    // Rangkuman berbentuk array blok konten terstruktur (heading, paragraf,
    // list, contoh, tip) -- lihat nim_client.py _build_prompt("rangkuman").
    // Disimpan sebagai JSON string di kolom Rangkuman.konten (kolom tetap
    // String, tidak perlu migration skema) -- frontend yang parse saat render.
    const rangkumanBlocks = draft.rangkuman?.parsed;
    if (Array.isArray(rangkumanBlocks) && rangkumanBlocks.length > 0) {
      setGenerationProgress(materiId, {
        status: 'running',
        progress: 82,
        message: 'Menyimpan rangkuman hasil AI...',
      });
      const kontenJson = JSON.stringify(rangkumanBlocks);
      await prisma.rangkuman.upsert({
        where: { materiId },
        update: { konten: kontenJson, status: 'draft' },
        create: { materiId, konten: kontenJson, status: 'draft' },
      });
      savedJenis.push('rangkuman');
    } else if (draft.rangkuman) {
      failedJenis.push('rangkuman');
      console.warn(
        `[materi ${materiId}] rangkuman gagal diparse jadi array blok (parsed=${JSON.stringify(draft.rangkuman.parsed)}). raw_text (500 char pertama):`,
        (draft.rangkuman.raw_text || '').slice(0, 500),
      );
    }

    if (result.errors) {
      console.warn(`[materi ${materiId}] sebagian jenis konten gagal di-generate:`, result.errors);
    }
    if (result.ppt) {
      try {
        setGenerationProgress(materiId, {
          status: 'running',
          progress: 92,
          message: 'Menyimpan PPT hasil AI...',
        });
        const pptFilename = await saveGeneratedPpt(materiId, options.judul || filename, result.ppt);
        if (pptFilename) savedJenis.push('ppt');
      } catch (pptErr) {
        console.warn(`[materi ${materiId}] PPT berhasil dibuat ai-service tapi gagal disimpan backend:`, pptErr.message);
      }
    }
    if (failedJenis.length > 0) {
      console.warn(`[materi ${materiId}] sebagian jenis konten gagal disimpan (parsed invalid): ${failedJenis.join(', ')}.`);
    }

    setGenerationProgress(materiId, {
      status: 'done',
      progress: 100,
      message: `Generate AI selesai. Tersimpan: ${savedJenis.join(', ') || '(tidak ada)'}.`,
      savedJenis,
      failedJenis,
    });
    console.log(`[materi ${materiId}] draft AI selesai diproses. Tersimpan: ${savedJenis.join(', ') || '(tidak ada)'}.`);
  } catch (err) {
    setGenerationProgress(materiId, {
      status: 'error',
      progress: 100,
      message: err.message || 'Generate AI gagal.',
    });
    // Graceful degradation: log error, jangan lempar ke proses lain.
    console.error(`[materi ${materiId}] generate AI gagal total:`, err.message);
  }
}

async function getGenerateProgress(req, res) {
  try {
    const materiId = parseInt(req.params.id, 10);
    if (Number.isNaN(materiId)) {
      return res.status(400).json({ error: 'bad_request', message: 'ID materi tidak valid' });
    }

    const materi = await prisma.materi.findFirst({
      where: { id: materiId, guruId: req.user.id },
      select: { id: true, status: true },
    });
    if (!materi) {
      return res.status(404).json({ error: 'not_found', message: 'Materi tidak ditemukan' });
    }

    const progress = getGenerationProgressSnapshot(materiId);
    if (progress) {
      return res.status(200).json({ progress });
    }

    return res.status(200).json({
      progress: {
        materiId,
        status: 'unknown',
        progress: materi.status === 'published' ? 100 : 0,
        message: 'Progress tidak tersedia. Jika server baru restart, cek halaman review materi.',
      },
    });
  } catch (err) {
    console.error('getGenerateProgress error:', err);
    return res.status(500).json({ error: 'internal_error', message: 'Gagal mengambil progress generate AI' });
  }
}

/**
 * GET /materi
 * Guru bisa melihat semua materi miliknya.
 * Siswa hanya melihat materi published DAN (berada di tree sesi aktif
 * saat ini ATAU sudah pernah diberikan akses permanen lewat MateriAccess).
 * Klausa kedua ini yang menjamin materi yang sudah didownload offline
 * tetap muncul di sini walau sesi kelasnya sudah diakhiri guru -- lihat
 * materiAccessService.js untuk detail pemisahan live vs permanen.
 */
async function listMateri(req, res) {
  try {
    let where;
    if (req.user.role === 'siswa') {
      const [activeGroupIds, accessibleMateriIds] = await Promise.all([
        getActiveSessionGroupIds(req.user.id),
        getAccessibleMateriIds(req.user.id),
      ]);
      where = {
        status: 'published',
        OR: [
          { groupId: { in: [...activeGroupIds] } },
          { id: { in: accessibleMateriIds } },
        ],
      };
    } else {
      where = { guruId: req.user.id };
    }

    const materiList = await prisma.materi.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: { id: true, judul: true, status: true, pptFile: true, groupId: true, createdAt: true },
    });

    return res.status(200).json({ materi: materiList });
  } catch (err) {
    console.error('listMateri error:', err);
    return res.status(500).json({ error: 'internal_error', message: 'Gagal mengambil daftar materi' });
  }
}

/**
 * GET /materi/:id/draft
 * Guru melihat draft flashcard/soal AI untuk direview sebelum approve.
 */
async function getMateriDraft(req, res) {
  try {
    const materiId = parseInt(req.params.id, 10);

    // Sengaja TIDAK difilter status: 'draft' saja -- setelah approve/publish,
    // status flashcard/bankSoal berubah jadi 'approved', dan guru tetap perlu
    // bisa melihat & mengedit konten itu di halaman ini kapan saja (lih.
    // komentar di ReviewDraftAI.jsx), bukan cuma sebelum publish pertama kali.
    const materi = await prisma.materi.findFirst({
      where: { id: materiId, guruId: req.user.id },
      include: {
        flashcards: true,
        bankSoal: true,
        rangkuman: true,
      },
    });

    if (!materi) {
      return res.status(404).json({ error: 'not_found', message: 'Materi tidak ditemukan' });
    }

    return res.status(200).json({ materi });
  } catch (err) {
    console.error('getMateriDraft error:', err);
    return res.status(500).json({ error: 'internal_error', message: 'Gagal mengambil draft materi' });
  }
}

async function downloadMateriPpt(req, res) {
  try {
    const materiId = parseInt(req.params.id, 10);
    const materi = await prisma.materi.findFirst({
      where: { id: materiId, guruId: req.user.id },
      select: { id: true, judul: true, pptFile: true },
    });

    if (!materi) {
      return res.status(404).json({ error: 'not_found', message: 'Materi tidak ditemukan' });
    }
    if (!materi.pptFile) {
      return res.status(404).json({ error: 'not_found', message: 'PPT belum tersedia untuk materi ini' });
    }

    const fullPath = path.join(GENERATED_PPT_DIR, materi.pptFile);
    const downloadName = `${sanitizeFilename(materi.judul)}.pptx`;
    return res.download(fullPath, downloadName);
  } catch (err) {
    console.error('downloadMateriPpt error:', err);
    return res.status(500).json({ error: 'internal_error', message: 'Gagal download PPT' });
  }
}

/**
 * GET /materi/:id/ppt/siswa
 * Siswa download PPT dari materi yang sudah published.
 * Hanya bisa akses materi dengan status 'published' — tidak bisa akses draft.
 */
async function downloadMateriPptSiswa(req, res) {
  try {
    const materiId = parseInt(req.params.id, 10);
    const materi = await prisma.materi.findFirst({
      where: { id: materiId, status: 'published' },
      select: { id: true, judul: true, pptFile: true },
    });

    if (!materi) {
      return res.status(404).json({ error: 'not_found', message: 'Materi tidak ditemukan' });
    }
    if (!materi.pptFile) {
      return res.status(404).json({ error: 'not_found', message: 'PPT belum tersedia untuk materi ini' });
    }

    const fullPath = path.join(GENERATED_PPT_DIR, materi.pptFile);
    const downloadName = `${sanitizeFilename(materi.judul)}.pptx`;
    return res.download(fullPath, downloadName);
  } catch (err) {
    console.error('downloadMateriPptSiswa error:', err);
    return res.status(500).json({ error: 'internal_error', message: 'Gagal download PPT' });
  }
}

/**
 * POST /materi/:id/approve
 * Guru approve/edit/reject draft AI (human-in-the-loop, FR-6).
 * Body: { action: "approve" | "reject", flashcard_edits?: [{id, pertanyaan, jawaban}] }
 */
async function approveMateri(req, res) {
  try {
    const materiId = parseInt(req.params.id, 10);
    const { action, flashcard_edits = [] } = req.body;

    const materi = await prisma.materi.findFirst({ where: { id: materiId, guruId: req.user.id } });
    if (!materi) {
      return res.status(404).json({ error: 'not_found', message: 'Materi tidak ditemukan' });
    }

    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ error: 'bad_request', message: "action harus 'approve' atau 'reject'" });
    }

    // Terapkan edit guru (jika ada) sebelum approve.
    for (const edit of flashcard_edits) {
      await prisma.flashcard.update({
        where: { id: edit.id },
        data: { pertanyaan: edit.pertanyaan, jawaban: edit.jawaban },
      });
    }

    if (action === 'approve') {
      await prisma.$transaction([
        prisma.flashcard.updateMany({ where: { materiId }, data: { status: 'approved' } }),
        prisma.bankSoal.updateMany({ where: { materiId }, data: { status: 'approved' } }),
        prisma.rangkuman.updateMany({ where: { materiId }, data: { status: 'approved' } }),
        prisma.materi.update({ where: { id: materiId }, data: { status: 'published' } }),
      ]);
    } else {
      await prisma.$transaction([
        prisma.flashcard.deleteMany({ where: { materiId, status: 'draft' } }),
        prisma.bankSoal.deleteMany({ where: { materiId, status: 'draft' } }),
        prisma.rangkuman.deleteMany({ where: { materiId, status: 'draft' } }),
      ]);
    }

    return res.status(200).json({ message: `Materi berhasil di-${action}` });
  } catch (err) {
    console.error('approveMateri error:', err);
    return res.status(500).json({ error: 'internal_error', message: 'Gagal memproses approval materi' });
  }
}

/**
 * DELETE /materi/:id
 * Guru menghapus materi miliknya sendiri beserta seluruh konten turunannya
 * (flashcard, bank soal, rangkuman, riwayat kuis siswa). Penghapusan
 * cascade ditangani di level database lewat `onDelete: Cascade` pada
 * relasi Flashcard/BankSoal/Rangkuman/QuizAttempt -> Materi (lihat
 * prisma/schema.prisma), jadi cukup satu `prisma.materi.delete`.
 */
async function deleteMateri(req, res) {
  try {
    const materiId = parseInt(req.params.id, 10);

    const materi = await prisma.materi.findFirst({
      where: { id: materiId, guruId: req.user.id },
    });

    if (!materi) {
      return res.status(404).json({ error: 'not_found', message: 'Materi tidak ditemukan' });
    }

    await prisma.materi.delete({ where: { id: materiId } });

    return res.status(200).json({ message: 'Materi berhasil dihapus' });
  } catch (err) {
    console.error('deleteMateri error:', err);
    return res.status(500).json({ error: 'internal_error', message: 'Gagal menghapus materi' });
  }
}

/**
 * PUT /materi/:id/move
 * Guru memindahkan materi ke folder lain atau ke root.
 * Body: { groupId: number | null }
 */
async function moveMateri(req, res) {
  try {
    const materiId = parseInt(req.params.id, 10);
    const parsedGroupId = req.body.groupId === undefined || req.body.groupId === null || req.body.groupId === ''
      ? null
      : parseInt(req.body.groupId, 10);

    if (Number.isNaN(materiId)) {
      return res.status(400).json({ error: 'bad_request', message: 'ID materi tidak valid' });
    }
    if (Number.isNaN(parsedGroupId)) {
      return res.status(400).json({ error: 'bad_request', message: 'groupId tidak valid' });
    }

    const materi = await prisma.materi.findFirst({
      where: { id: materiId, guruId: req.user.id },
      select: { id: true },
    });

    if (!materi) {
      return res.status(404).json({ error: 'not_found', message: 'Materi tidak ditemukan' });
    }

    if (parsedGroupId) {
      const group = await prisma.group.findFirst({
        where: { id: parsedGroupId, guruId: req.user.id },
        select: { id: true },
      });
      if (!group) {
        return res.status(404).json({ error: 'not_found', message: 'Folder tujuan tidak ditemukan' });
      }
    }

    await prisma.materi.update({
      where: { id: materiId },
      data: { groupId: parsedGroupId },
    });

    return res.status(200).json({ message: 'Materi berhasil dipindahkan' });
  } catch (err) {
    console.error('moveMateri error:', err);
    return res.status(500).json({ error: 'internal_error', message: 'Gagal memindahkan materi' });
  }
}

module.exports = {
  uploadMateri,
  listMateri,
  getMateriDraft,
  getGenerateProgress,
  approveMateri,
  deleteMateri,
  moveMateri,
  downloadMateriPpt,
  downloadMateriPptSiswa,
  generateAIContentInBackground,
};