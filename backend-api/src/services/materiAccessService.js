/**
 * materiAccessService.js - Logika otorisasi akses materi untuk siswa.
 *
 * Memisahkan dua konsep yang sebelumnya tercampur di satu tempat
 * (groupController.getStudentGroupContents):
 *
 *   1. "Sesi aktif saat ini" (live, transient) -- folder yang sedang
 *      dibuka guru lewat activeGroupId, dipakai untuk visibility real-time
 *      di navigasi folder siswa.
 *   2. "Akses yang sudah pernah diberikan ke siswa" (permanen, per
 *      siswa+materi) -- dicatat di tabel MateriAccess begitu materi
 *      pernah legit ditampilkan ke siswa lewat sesi aktif. Ini yang
 *      menjamin materi yang sudah didownload offline TIDAK hilang saat
 *      guru menekan "Akhiri Sesi", dan menjadi dasar otorisasi untuk
 *      endpoint konten (flashcard/rangkuman/soal), bukan cuma daftar folder.
 */

const prisma = require('../config/db');

/**
 * Mengumpulkan semua groupId yang termasuk dalam tree sesi aktif saat ini:
 * folder aktif (activeGroupId) tiap guru yang sedang punya sesi, plus semua
 * descendant-nya. Materi dengan groupId null (di root, tanpa folder) SENGAJA
 * tidak pernah termasuk di sini -- sama seperti perilaku sebelumnya.
 */
async function getActiveSessionGroupIds(siswaId) {
  if (!siswaId) return new Set();
  
  const siswa = await prisma.user.findUnique({
    where: { id: siswaId },
    select: { kelasId: true },
  });
  
  if (!siswa || !siswa.kelasId) return new Set(); // Jika siswa tidak punya kelas, dia tidak bisa ikut sesi kelas apapun

  const activeGurus = await prisma.user.findMany({
    where: { 
      role: 'guru', 
      activeGroupId: { not: null },
      activeKelasId: siswa.kelasId 
    },
    select: { activeGroupId: true },
  });

  if (activeGurus.length === 0) return new Set();

  const allGroups = await prisma.group.findMany({
    select: { id: true, parentId: true },
  });

  const result = new Set(activeGurus.map((g) => g.activeGroupId));
  let changed = true;
  while (changed) {
    changed = false;
    for (const g of allGroups) {
      if (!result.has(g.id) && g.parentId !== null && result.has(g.parentId)) {
        result.add(g.id);
        changed = true;
      }
    }
  }
  return result;
}

/**
 * Mencatat bahwa sekumpulan materi baru saja legit ditampilkan ke seorang
 * siswa lewat sesi aktif. Best-effort: dipanggil dari
 * getStudentGroupContents setiap kali publishedMateri dikembalikan.
 */
async function grantMateriAccess(siswaId, materiIds) {
  const ids = [...new Set(materiIds)].filter((id) => Number.isInteger(id));
  if (!siswaId || ids.length === 0) return;

  await Promise.all(
    ids.map((materiId) =>
      prisma.materiAccess
        .upsert({
          where: { siswaId_materiId: { siswaId, materiId } },
          update: {},
          create: { siswaId, materiId },
        })
        .catch((err) => {
          // Non-fatal: gagal mencatat akses tidak boleh menggagalkan response
          // daftar materi ke siswa.
          console.warn(`Gagal mencatat MateriAccess (siswa ${siswaId}, materi ${materiId}):`, err.message);
        }),
    ),
  );
}

/**
 * ID materi yang sudah pernah diberikan akses permanen ke siswa ini.
 */
async function getAccessibleMateriIds(siswaId) {
  if (!siswaId) return [];
  const rows = await prisma.materiAccess.findMany({
    where: { siswaId },
    select: { materiId: true },
  });
  return rows.map((r) => r.materiId);
}

/**
 * Otorisasi utama dipakai endpoint konten (flashcard/rangkuman/soal):
 * materi bisa diakses siswa jika published DAN (berada di tree sesi aktif
 * ATAU siswa itu punya MateriAccess untuk materi ini).
 */
async function canStudentAccessMateri(siswaId, materiId) {
  const materi = await prisma.materi.findFirst({
    where: { id: materiId, status: 'published' },
    select: { id: true, groupId: true },
  });
  if (!materi) return false;

  if (materi.groupId !== null && materi.groupId !== undefined) {
    const activeGroupIds = await getActiveSessionGroupIds(siswaId);
    if (activeGroupIds.has(materi.groupId)) return true;
  }

  const access = await prisma.materiAccess.findUnique({
    where: { siswaId_materiId: { siswaId, materiId } },
  });
  return Boolean(access);
}

module.exports = {
  getActiveSessionGroupIds,
  grantMateriAccess,
  getAccessibleMateriIds,
  canStudentAccessMateri,
};