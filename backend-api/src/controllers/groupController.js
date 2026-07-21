const prisma = require('../config/db');

/**
 * POST /groups
 * Membuat folder baru.
 */
async function createGroup(req, res) {
  try {
    const { nama, parentId } = req.body;
    if (!nama) {
      return res.status(400).json({ error: 'bad_request', message: 'Nama folder wajib diisi' });
    }

    const group = await prisma.group.create({
      data: {
        nama,
        guruId: req.user.id,
        parentId: parentId ? parseInt(parentId, 10) : null,
      },
    });

    return res.status(201).json({ group });
  } catch (err) {
    console.error('createGroup error:', err);
    return res.status(500).json({ error: 'internal_error', message: 'Gagal membuat folder' });
  }
}

/**
 * GET /groups
 * GET /groups?parentId=1
 * Mengambil isi folder: sub-folder (children) dan materi di dalam folder tersebut (atau di root jika tidak ada parentId).
 */
async function getGroupContents(req, res) {
  try {
    const parentId = req.query.parentId ? parseInt(req.query.parentId, 10) : null;

    const [groups, materi] = await Promise.all([
      prisma.group.findMany({
        where: {
          guruId: req.user.id,
          parentId,
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.materi.findMany({
        where: {
          guruId: req.user.id,
          groupId: parentId,
        },
        orderBy: { createdAt: 'desc' },
        select: { id: true, judul: true, status: true, pptFile: true, createdAt: true },
      }),
    ]);

    // Jika masuk ke suatu folder, kirimkan juga data folder tsb untuk breadcrumb
    let currentGroup = null;
    if (parentId) {
      currentGroup = await prisma.group.findUnique({
        where: { id: parentId, guruId: req.user.id },
      });
      if (!currentGroup) {
        return res.status(404).json({ error: 'not_found', message: 'Folder tidak ditemukan' });
      }
    }

    return res.status(200).json({ currentGroup, groups, materi });
  } catch (err) {
    console.error('getGroupContents error:', err);
    return res.status(500).json({ error: 'internal_error', message: 'Gagal mengambil isi folder' });
  }
}

/**
 * PUT /groups/:id
 * Mengubah nama folder.
 */
async function updateGroup(req, res) {
  try {
    const { id } = req.params;
    const { nama } = req.body;

    if (!nama) {
      return res.status(400).json({ error: 'bad_request', message: 'Nama folder wajib diisi' });
    }

    const group = await prisma.group.updateMany({
      where: { id: parseInt(id, 10), guruId: req.user.id },
      data: { nama },
    });

    if (group.count === 0) {
      return res.status(404).json({ error: 'not_found', message: 'Folder tidak ditemukan atau Anda tidak memiliki akses' });
    }

    return res.status(200).json({ message: 'Nama folder berhasil diubah' });
  } catch (err) {
    console.error('updateGroup error:', err);
    return res.status(500).json({ error: 'internal_error', message: 'Gagal mengubah folder' });
  }
}

/**
 * DELETE /groups/:id
 * Menghapus folder beserta isinya (cascade).
 */
async function deleteGroup(req, res) {
  try {
    const { id } = req.params;
    
    // Cari dulu foldernya untuk memastikan kepemilikan
    const group = await prisma.group.findFirst({
      where: { id: parseInt(id, 10), guruId: req.user.id },
    });

    if (!group) {
      return res.status(404).json({ error: 'not_found', message: 'Folder tidak ditemukan' });
    }

    await prisma.group.delete({
      where: { id: parseInt(id, 10) },
    });

    return res.status(200).json({ message: 'Folder berhasil dihapus' });
  } catch (err) {
    console.error('deleteGroup error:', err);
    return res.status(500).json({ error: 'internal_error', message: 'Gagal menghapus folder' });
  }
}

module.exports = {
  createGroup,
  getGroupContents,
  updateGroup,
  deleteGroup,
};
