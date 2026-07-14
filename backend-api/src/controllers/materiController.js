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
    const { judul } = req.body;
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
        fileOriginal: file.originalname,
        status: 'draft',
      },
    });

    // Trigger job generate AI (async, tidak blocking response ke guru).
    // Kegagalan di sini TIDAK mengubah status materi menjadi error yang fatal --
    // guru tetap bisa input manual lewat /flashcard/manual (FR-7).
    generateAIContentInBackground(materi.id, file.buffer, file.originalname);

    return res.status(202).json({
      message: 'Materi diterima, proses generate AI (flashcard, rangkuman, bank soal) berjalan di background.',
      materi: { id: materi.id, judul: materi.judul, status: materi.status },
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
async function generateAIContentInBackground(materiId, fileBuffer, filename) {
  try {
    const result = await aiServiceClient.generateMateri(fileBuffer, filename);
    const draft = result?.draft;

    if (!draft) {
      console.warn(`[materi ${materiId}] ai-service tidak mengembalikan draft sama sekali.`);
      return;
    }

    const savedJenis = [];
    const failedJenis = []; // parsed kosong/invalid meski ai-service melaporkan "success"

    const flashcardDraft = draft.flashcard?.parsed;
    if (Array.isArray(flashcardDraft) && flashcardDraft.length > 0) {
      await prisma.flashcard.createMany({
        data: flashcardDraft.map((item) => ({
          materiId,
          pertanyaan: item.pertanyaan,
          jawaban: item.jawaban,
          status: 'draft',
        })),
      });
      savedJenis.push('flashcard');
    } else if (draft.flashcard) {
      failedJenis.push('flashcard');
      console.warn(
        `[materi ${materiId}] flashcard gagal diparse jadi array (kemungkinan JSON invalid dari LLM). raw_text (500 char pertama):`,
        (draft.flashcard.raw_text || '').slice(0, 500),
      );
    }

    const soalDraft = draft.soal?.parsed;
    if (Array.isArray(soalDraft) && soalDraft.length > 0) {
      await prisma.bankSoal.createMany({
        data: soalDraft.map((item) => ({
          materiId,
          pertanyaan: item.pertanyaan,
          opsiJawaban: JSON.stringify(item.opsi_jawaban || []),
          jawabanBenar: item.jawaban_benar,
          status: 'draft',
        })),
      });
      savedJenis.push('soal');
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
    if (failedJenis.length > 0) {
      console.warn(`[materi ${materiId}] sebagian jenis konten gagal disimpan (parsed invalid): ${failedJenis.join(', ')}.`);
    }

    console.log(`[materi ${materiId}] draft AI selesai diproses. Tersimpan: ${savedJenis.join(', ') || '(tidak ada)'}.`);
  } catch (err) {
    // Graceful degradation: log error, jangan lempar ke proses lain.
    console.error(`[materi ${materiId}] generate AI gagal total:`, err.message);
  }
}

/**
 * GET /materi
 * Siswa hanya melihat materi published. Guru bisa melihat semua materi miliknya.
 */
async function listMateri(req, res) {
  try {
    const where = req.user.role === 'siswa'
      ? { status: 'published' }
      : { guruId: req.user.id };

    const materiList = await prisma.materi.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: { id: true, judul: true, status: true, createdAt: true },
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

module.exports = {
  uploadMateri,
  listMateri,
  getMateriDraft,
  approveMateri,
  deleteMateri,
  generateAIContentInBackground,
};