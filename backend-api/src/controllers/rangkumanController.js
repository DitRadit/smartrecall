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

module.exports = { getRangkumanByMateri, updateRangkuman, deleteRangkuman };
