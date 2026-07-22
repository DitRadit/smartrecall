const prisma = require('../config/db');
const { getActiveSessionGroupIds, grantMateriAccess } = require('../services/materiAccessService');

function parseOptionalId(value) {
  if (value === undefined || value === null || value === '') return null;
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) ? NaN : parsed;
}

function collectAccessibleGroupIds(groups, publishedMateri) {
  const groupById = new Map(groups.map((group) => [group.id, group]));
  const accessibleIds = new Set();

  for (const materi of publishedMateri) {
    let groupId = materi.groupId;
    while (groupId) {
      if (accessibleIds.has(groupId)) break;
      accessibleIds.add(groupId);
      groupId = groupById.get(groupId)?.parentId || null;
    }
  }

  return accessibleIds;
}

function selectMateriSummary() {
  return { id: true, judul: true, status: true, pptFile: true, groupId: true, createdAt: true };
}

async function ensureOwnedParentGroup(parentId, guruId) {
  if (!parentId) return null;

  const parent = await prisma.group.findFirst({
    where: { id: parentId, guruId },
    select: { id: true, parentId: true },
  });
  return parent;
}

async function isDescendantGroup(groupId, maybeDescendantId) {
  let currentId = maybeDescendantId;

  while (currentId) {
    if (currentId === groupId) return true;

    const current = await prisma.group.findUnique({
      where: { id: currentId },
      select: { parentId: true },
    });
    currentId = current?.parentId || null;
  }

  return false;
}

/**
 * POST /groups
 * Membuat folder baru.
 */
async function createGroup(req, res) {
  try {
    const { nama, parentId } = req.body;
    const parsedParentId = parseOptionalId(parentId);

    if (!nama) {
      return res.status(400).json({ error: 'bad_request', message: 'Nama folder wajib diisi' });
    }
    if (Number.isNaN(parsedParentId)) {
      return res.status(400).json({ error: 'bad_request', message: 'parentId tidak valid' });
    }
    if (parsedParentId) {
      const parent = await ensureOwnedParentGroup(parsedParentId, req.user.id);
      if (!parent) {
        return res.status(404).json({ error: 'not_found', message: 'Folder tujuan tidak ditemukan' });
      }
    }

    const group = await prisma.group.create({
      data: {
        nama,
        guruId: req.user.id,
        parentId: parsedParentId,
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
    const parentId = parseOptionalId(req.query.parentId);
    if (Number.isNaN(parentId)) {
      return res.status(400).json({ error: 'bad_request', message: 'parentId tidak valid' });
    }

    if (req.user.role === 'siswa') {
      return getStudentGroupContents(req, res, parentId);
    }

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
        select: selectMateriSummary(),
      }),
    ]);

    // Jika masuk ke suatu folder, kirimkan juga data folder tsb untuk breadcrumb
    let currentGroup = null;
    if (parentId) {
      currentGroup = await prisma.group.findFirst({
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

async function getStudentGroupContents(req, res, parentId) {
  // Kumpulkan ID folder yang termasuk tree sesi aktif (folder aktif tiap
  // guru yang punya sesi + semua descendant-nya). Ini murni untuk
  // visibility LIVE di navigasi folder -- lihat materiAccessService.js
  // untuk pemisahan dari akses permanen.
  const allowedGroupIds = await getActiveSessionGroupIds();

  if (allowedGroupIds.size === 0) {
    // Belum ada guru yang memulai sesi — tidak ada folder/materi yang
    // ditampilkan lewat navigasi live. (Materi yang sudah pernah diakses
    // siswa tetap terlihat lewat GET /materi, lihat materiController.listMateri.)
    return res.status(200).json({ currentGroup: null, groups: [], materi: [] });
  }

  // Validasi: jika siswa minta folder tertentu (parentId), pastikan folder itu
  // termasuk dalam tree folder aktif.
  if (parentId !== null && !allowedGroupIds.has(parentId)) {
    return res.status(404).json({ error: 'not_found', message: 'Folder tidak ditemukan' });
  }

  const allGroups = await prisma.group.findMany({
    select: { id: true, nama: true, parentId: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  });

  // Materi yang published DAN berada di dalam tree folder aktif saja.
  const publishedMateri = await prisma.materi.findMany({
    where: {
      status: 'published',
      groupId: { in: [...allowedGroupIds] },
    },
    orderBy: { createdAt: 'desc' },
    select: selectMateriSummary(),
  });

  // Materi ini baru saja legit ditampilkan ke siswa lewat sesi aktif --
  // catat sebagai akses permanen supaya tidak hilang setelah sesi berakhir
  // (best-effort, tidak boleh menggagalkan response ke siswa).
  grantMateriAccess(req.user.id, publishedMateri.map((m) => m.id)).catch((err) => {
    console.warn('grantMateriAccess gagal (non-fatal):', err.message);
  });

  let currentGroup = null;
  if (parentId) {
    currentGroup = allGroups.find((g) => g.id === parentId) || null;
    if (!currentGroup) {
      return res.status(404).json({ error: 'not_found', message: 'Folder tidak ditemukan' });
    }
  }

  // Sub-folder yang parentId-nya sesuai dengan folder yang sedang dibuka,
  // dan masih dalam tree yang diizinkan.
  const groups = allGroups.filter(
    (g) => g.parentId === parentId && allowedGroupIds.has(g.id),
  );

  // Materi langsung di folder ini (groupId === parentId dari request)
  const materi = publishedMateri.filter((item) => item.groupId === parentId);

  return res.status(200).json({ currentGroup, groups, materi });
}


/**
 * PUT /groups/:id
 * Mengubah nama folder.
 */
async function updateGroup(req, res) {
  try {
    const { id } = req.params;
    const groupId = parseInt(id, 10);
    const { nama } = req.body;
    const hasParentId = Object.prototype.hasOwnProperty.call(req.body, 'parentId');

    if (Number.isNaN(groupId)) {
      return res.status(400).json({ error: 'bad_request', message: 'ID folder tidak valid' });
    }

    const existing = await prisma.group.findFirst({
      where: { id: groupId, guruId: req.user.id },
      select: { id: true },
    });

    if (!existing) {
      return res.status(404).json({ error: 'not_found', message: 'Folder tidak ditemukan atau Anda tidak memiliki akses' });
    }

    const data = {};
    if (nama !== undefined) {
      if (!nama?.trim()) {
        return res.status(400).json({ error: 'bad_request', message: 'Nama folder wajib diisi' });
      }
      data.nama = nama.trim();
    }

    if (hasParentId) {
      const parsedParentId = parseOptionalId(req.body.parentId);
      if (Number.isNaN(parsedParentId)) {
        return res.status(400).json({ error: 'bad_request', message: 'parentId tidak valid' });
      }
      if (parsedParentId === groupId) {
        return res.status(400).json({ error: 'bad_request', message: 'Folder tidak bisa dipindah ke dirinya sendiri' });
      }
      if (parsedParentId) {
        const parent = await ensureOwnedParentGroup(parsedParentId, req.user.id);
        if (!parent) {
          return res.status(404).json({ error: 'not_found', message: 'Folder tujuan tidak ditemukan' });
        }
        if (await isDescendantGroup(groupId, parsedParentId)) {
          return res.status(400).json({ error: 'bad_request', message: 'Folder tidak bisa dipindah ke subfoldernya sendiri' });
        }
      }
      data.parentId = parsedParentId;
    }

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ error: 'bad_request', message: 'Tidak ada perubahan yang dikirim' });
    }

    await prisma.group.update({
      where: { id: groupId },
      data,
    });

    return res.status(200).json({ message: 'Folder berhasil diperbarui' });
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