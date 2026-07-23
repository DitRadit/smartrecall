const prisma = require('../config/db');

async function getAdminDashboardStats(req, res) {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // Pengguna aktif (distinct users dalam 24 jam terakhir)
    const activeUsers = await prisma.activityLog.findMany({
      where: { createdAt: { gte: last24h } },
      select: { userId: true },
      distinct: ['userId'],
    });
    const totalActiveUsers = activeUsers.length;

    // Jumlah aktivitas hari ini
    const totalActivitiesToday = await prisma.activityLog.count({
      where: { createdAt: { gte: today } },
    });

    // Aktivitas terbaru
    const rawActivities = await prisma.activityLog.findMany({
      take: 50,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { nama: true, role: true } },
      },
    });

    const seenUsers = new Set();
    const latestActivities = [];
    for (const act of rawActivities) {
      if (!seenUsers.has(act.userId)) {
        seenUsers.add(act.userId);
        latestActivities.push(act);
        if (latestActivities.length >= 10) break;
      }
    }

    // Distribusi aktivitas (guru vs siswa vs admin)
    const distribution = await prisma.activityLog.groupBy({
      by: ['userId'],
      _count: { id: true },
    });
    
    // We need to map user roles
    const userIds = distribution.map(d => d.userId);
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, role: true },
    });
    
    const userRoleMap = {};
    users.forEach(u => { userRoleMap[u.id] = u.role; });
    
    const activityDistribution = { guru: 0, siswa: 0, admin: 0 };
    distribution.forEach(d => {
      const role = userRoleMap[d.userId];
      if (role && activityDistribution[role] !== undefined) {
        activityDistribution[role] += d._count.id;
      }
    });

    // Semua guru sudah upload berapa materi
    const gurus = await prisma.user.findMany({
      where: { role: 'guru' },
      include: {
        _count: {
          select: { materiDiunggah: true },
        },
      },
    });
    
    const materiPerGuru = gurus.map(g => ({
      id: g.id,
      nama: g.nama,
      totalMateri: g._count.materiDiunggah,
    }));
    
    // Jumlah siswa aktif belajar (siswa yang memiliki reviewProgress)
    const activeSiswaCount = await prisma.reviewProgress.findMany({
      select: { siswaId: true },
      distinct: ['siswaId'],
    });

    return res.status(200).json({
      totalActiveUsers,
      totalActivitiesToday,
      latestActivities,
      activityDistribution,
      materiPerGuru,
      totalSiswaAktif: activeSiswaCount.length
    });
  } catch (err) {
    console.error('getAdminDashboardStats error:', err);
    return res.status(500).json({ error: 'internal_error', message: 'Gagal mengambil statistik admin' });
  }
}

module.exports = {
  getAdminDashboardStats,
};
