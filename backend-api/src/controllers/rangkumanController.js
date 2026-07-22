/**
 * rangkumanController.js - Endpoint rangkuman materi (FR terkait ringkasan AI).
 *
 * Sebelumnya AI service bisa generate "rangkuman", tapi hasilnya tidak pernah
 * disimpan (materiController hanya menangani flashcard & bankSoal) sehingga
 * fitur ini tidak pernah benar-benar sampai ke siswa. Controller ini
 * melengkapi jalur simpan (dipanggil dari materiController) & jalur baca
 * (untuk siswa).
 */

const prisma = require('../config/db');
const aiServiceClient = require('../services/aiServiceClient');
const { canStudentAccessMateri } = require('../services/materiAccessService');

function normalizeRangkumanBlocks(parsed) {
  if (Array.isArray(parsed)) return parsed;
  if (Array.isArray(parsed?.items)) return parsed.items;
  if (Array.isArray(parsed?.blocks)) return parsed.blocks;
  if (Array.isArray(parsed?.blok)) return parsed.blok;
  if (Array.isArray(parsed?.konten)) return parsed.konten;
  if (Array.isArray(parsed?.rangkuman)) return parsed.rangkuman;
  if (typeof parsed === 'string' && parsed.trim()) {
    return [{ type: 'paragraf', teks: parsed.trim() }];
  }
  if (parsed?.type) return [parsed];
  if (parsed?.teks || parsed?.text) {
    return [{ type: 'paragraf', teks: parsed.teks || parsed.text }];
  }
  return [];
}

/**
 * GET /rangkuman/materi/:id
 * Siswa mengambil rangkuman untuk 1 materi published.
 */
async function getRangkumanByMateri(req, res) {
  try {
    const materiId = parseInt(req.params.id, 10);

    const materi = await prisma.materi.findFirst({
      where: { id: materiId, status: 'published' },
      include: { rangkuman: true },
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

    if (!materi.rangkuman || materi.rangkuman.status !== 'approved') {
      return res.status(404).json({ error: 'not_found', message: 'Rangkuman untuk materi ini belum tersedia' });
    }

    // Catat bahwa siswa ini sudah membaca (best-effort, tidak fatal jika gagal).
    if (req.user.role === 'siswa') {
      prisma.rangkumanRead
        .upsert({
          where: { rangkumanId_siswaId: { rangkumanId: materi.rangkuman.id, siswaId: req.user.id } },
          update: { readAt: new Date() },
          create: { rangkumanId: materi.rangkuman.id, siswaId: req.user.id },
        })
        .catch((err) => console.warn('Gagal mencatat rangkumanRead (non-fatal):', err.message));
    }

    return res.status(200).json({
      materi_id: materi.id,
      judul: materi.judul,
      rangkuman: { id: materi.rangkuman.id, konten: materi.rangkuman.konten },
    });
  } catch (err) {
    console.error('getRangkumanByMateri error:', err);
    return res.status(500).json({ error: 'internal_error', message: 'Gagal mengambil rangkuman' });
  }
}

async function updateRangkuman(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    const { konten } = req.body;

    if (!konten) {
      return res.status(400).json({ error: 'bad_request', message: 'Konten rangkuman wajib diisi' });
    }

    let kontenJson = typeof konten === 'string' ? konten : JSON.stringify(konten);

    const rangkuman = await prisma.rangkuman.findUnique({
      where: { id },
      include: { materi: true },
    });

    if (!rangkuman) {
      return res.status(404).json({ error: 'not_found', message: 'Rangkuman tidak ditemukan' });
    }

    if (rangkuman.materi.guruId !== req.user.id) {
      return res.status(403).json({ error: 'forbidden', message: 'Anda tidak memiliki akses ke rangkuman ini' });
    }

    const updated = await prisma.rangkuman.update({
      where: { id },
      data: { konten: kontenJson },
    });

    return res.status(200).json({
      rangkuman: {
        id: updated.id,
        konten: updated.konten,
      },
    });
  } catch (err) {
    console.error('updateRangkuman error:', err);
    return res.status(500).json({ error: 'internal_error', message: 'Gagal memperbarui rangkuman' });
  }
}

async function deleteRangkuman(req, res) {
  try {
    const id = parseInt(req.params.id, 10);

    const rangkuman = await prisma.rangkuman.findUnique({
      where: { id },
      include: { materi: true },
    });

    if (!rangkuman) {
      return res.status(404).json({ error: 'not_found', message: 'Rangkuman tidak ditemukan' });
    }

    if (rangkuman.materi.guruId !== req.user.id) {
      return res.status(403).json({ error: 'forbidden', message: 'Anda tidak memiliki akses ke rangkuman ini' });
    }

    await prisma.rangkuman.delete({
      where: { id },
    });

    return res.status(200).json({ message: 'Rangkuman berhasil dihapus' });
  } catch (err) {
    console.error('deleteRangkuman error:', err);
    return res.status(500).json({ error: 'internal_error', message: 'Gagal menghapus rangkuman' });
  }
}

async function regenerateRangkuman(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    const rangkuman = await prisma.rangkuman.findUnique({
      where: { id },
      include: { materi: true },
    });

    if (!rangkuman) {
      return res.status(404).json({ error: 'not_found', message: 'Rangkuman tidak ditemukan' });
    }
    if (rangkuman.materi.guruId !== req.user.id) {
      return res.status(403).json({ error: 'forbidden', message: 'Anda tidak memiliki akses ke rangkuman ini' });
    }

    let blocks;
    try {
      blocks = JSON.parse(rangkuman.konten || '[]');
    } catch (e) {
      blocks = [{ type: 'paragraf', teks: rangkuman.konten }];
    }

    const result = await aiServiceClient.generateVariant('rangkuman', {
      judul_materi: rangkuman.materi.judul,
      konten: blocks,
    });
    const parsed = result?.draft?.parsed;
    const newBlocks = normalizeRangkumanBlocks(parsed);
    if (newBlocks.length === 0) {
      return res.status(502).json({ error: 'bad_ai_response', message: 'AI gagal menghasilkan rangkuman pengganti yang valid' });
    }

    const updated = await prisma.rangkuman.update({
      where: { id },
      data: {
        konten: JSON.stringify(newBlocks),
        status: 'draft',
      },
    });

    return res.status(200).json({ rangkuman: { id: updated.id, konten: updated.konten } });
  } catch (err) {
    console.error('regenerateRangkuman error:', err);
    return res.status(err.statusCode || 500).json({
      error: err.name === 'AIServiceError' ? 'ai_service_error' : 'internal_error',
      message: err.message || 'Gagal generate ulang rangkuman',
    });
  }
}

module.exports = { getRangkumanByMateri, updateRangkuman, regenerateRangkuman, deleteRangkuman };