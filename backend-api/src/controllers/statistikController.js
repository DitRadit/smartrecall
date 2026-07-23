const prisma = require('../config/db');

async function getStatistikKelas(req, res) {
  try {
    const guruId = req.user.id;
    const kelasId = req.query.kelasId && req.query.kelasId !== 'all' ? parseInt(req.query.kelasId, 10) : null;
    
    // Ambil materi dari guru (kecuali folder)
    let materiList = await prisma.materi.findMany({
      where: { guruId },
      include: {
        flashcards: true,
        bankSoal: true
      }
    });

    if (kelasId) {
      // Filter materi yang pernah diakses oleh siswa di kelas ini
      const materiAccesses = await prisma.materiAccess.findMany({
        where: { materi: { guruId }, siswa: { kelasId } },
        select: { materiId: true },
        distinct: ['materiId']
      });
      const allowedMateriIds = new Set(materiAccesses.map(ma => ma.materiId));
      materiList = materiList.filter(m => allowedMateriIds.has(m.id));
    }

    const progressPublikasi = {
      draft: materiList.filter(m => m.status === 'draft').length,
      published: materiList.filter(m => m.status === 'published').length,
    };

    // Total seluruh siswa di sistem / kelas
    const totalSiswa = await prisma.user.count({ 
      where: { role: 'siswa', ...(kelasId ? { kelasId } : {}) } 
    });

    // Hitung metrik performa per materi
    const performaMateri = await Promise.all(materiList.map(async (m) => {
      const flashcardIds = m.flashcards.map(f => f.id);
      
      let partisipasiSiswa = 0;
      let rataRataSkorKualitas = 0;
      let flashcardTersulit = null;

      if (flashcardIds.length > 0) {
        const uniqueReviewers = await prisma.reviewProgress.findMany({
          where: { 
            flashcardId: { in: flashcardIds },
            ...(kelasId ? { siswa: { kelasId } } : {})
          },
          select: { siswaId: true },
          distinct: ['siswaId']
        });
        partisipasiSiswa = uniqueReviewers.length;

        // Rata-rata skor kualitas materi ini
        const logStats = await prisma.reviewLog.aggregate({
          where: { 
            flashcardId: { in: flashcardIds },
            ...(kelasId ? { siswa: { kelasId } } : {})
          },
          _avg: { skorKualitas: true }
        });
        rataRataSkorKualitas = logStats._avg.skorKualitas || 0;

        // Flashcard tersulit (paling sering dijawab dengan skor < 3)
        const sulitStats = await prisma.reviewLog.groupBy({
          by: ['flashcardId'],
          where: { 
            flashcardId: { in: flashcardIds }, 
            skorKualitas: { lt: 3 },
            ...(kelasId ? { siswa: { kelasId } } : {})
          },
          _count: { flashcardId: true },
          orderBy: { _count: { flashcardId: 'desc' } },
          take: 1
        });

        if (sulitStats.length > 0) {
          const fId = sulitStats[0].flashcardId;
          const fData = await prisma.flashcard.findUnique({ where: { id: fId } });
          if (fData) {
            flashcardTersulit = {
              id: fData.id,
              pertanyaan: fData.pertanyaan,
              jawaban: fData.jawaban,
              salahCount: sulitStats[0]._count.flashcardId
            };
          }
        }
      }

      // Kuis metrics
      const kuisAttempts = await prisma.quizAttempt.findMany({
        where: { 
          materiId: m.id,
          ...(kelasId ? { siswa: { kelasId } } : {})
        }
      });
      const uniqueQuizTakers = new Set(kuisAttempts.map(a => a.siswaId)).size;
      
      let rataRataKuis = 0;
      if (kuisAttempts.length > 0) {
        const totalScore = kuisAttempts.reduce((acc, a) => acc + ((a.skorBenar / a.totalSoal) * 100), 0);
        rataRataKuis = totalScore / kuisAttempts.length;
      }

      return {
        id: m.id,
        judul: m.judul,
        status: m.status,
        partisipasiSiswa,
        persentasePartisipasi: totalSiswa > 0 ? (partisipasiSiswa / totalSiswa) * 100 : 0,
        rataRataSkorKualitas,
        tingkatPenyelesaianKuis: totalSiswa > 0 ? (uniqueQuizTakers / totalSiswa) * 100 : 0,
        rataRataKuis,
        flashcardTersulit
      };
    }));

    // Ambil daftar seluruh siswa
    const daftarSiswa = await prisma.user.findMany({
      where: { 
        role: 'siswa',
        ...(kelasId ? { kelasId } : {})
      },
      select: {
        id: true,
        nama: true,
        username: true,
        lastSyncAt: true,
        kelasId: true,
        kelas: { select: { nama: true } }
      },
      orderBy: { nama: 'asc' }
    });

    // Action Log: Identifikasi siswa tertinggal (Skor < 50 atau Ease Factor rendah)
    const actionLog = [];
    
    const allKuis = await prisma.quizAttempt.findMany({
      where: { ...(kelasId ? { siswa: { kelasId } } : {}) },
      include: { 
        siswa: { select: { nama: true, kelas: { select: { nama: true } }, kelasId: true } }, 
        materi: { select: { judul: true } } 
      },
      orderBy: { submittedAt: 'desc' }
    });
    
    const processedStudents = new Set();
    
    allKuis.forEach(k => {
      const percentage = (k.skorBenar / k.totalSoal) * 100;
      if (percentage < 50 && !processedStudents.has(k.siswaId)) {
        processedStudents.add(k.siswaId);
        actionLog.push({
          id: `kuis-${k.id}`,
          namaItem: k.siswa.nama,
          kelasNama: k.siswa.kelas?.nama || 'Tanpa Kelas',
          kelasId: k.siswa.kelasId,
          kategori: `Kesulitan Belajar (${k.materi.judul})`,
          status: 'Butuh Perhatian',
          prioritas: 'Tinggi',
          waktu: k.submittedAt,
          aksi: 'Kirim Rekomendasi Review'
        });
      } else if (percentage >= 50 && percentage < 70 && !processedStudents.has(k.siswaId)) {
        processedStudents.add(k.siswaId);
        actionLog.push({
          id: `kuis-${k.id}`,
          namaItem: k.siswa.nama,
          kelasNama: k.siswa.kelas?.nama || 'Tanpa Kelas',
          kelasId: k.siswa.kelasId,
          kategori: `Perlu Peningkatan (${k.materi.judul})`,
          status: 'Sedang Dipantau',
          prioritas: 'Sedang',
          waktu: k.submittedAt,
          aksi: 'Hubungi Siswa'
        });
      }
    });

    // Also check for bad SM-2 retention (easeFactor < 1.5)
    const badRetention = await prisma.reviewProgress.findMany({
      where: { 
        easeFactor: { lt: 1.5 },
        ...(kelasId ? { siswa: { kelasId } } : {})
      },
      include: { siswa: { select: { nama: true, kelas: { select: { nama: true } }, kelasId: true } } },
      distinct: ['siswaId']
    });

    badRetention.forEach(r => {
      if (!processedStudents.has(r.siswaId)) {
        processedStudents.add(r.siswaId);
        actionLog.push({
          id: `retensi-${r.id}`,
          namaItem: r.siswa.nama,
          kelasNama: r.siswa.kelas?.nama || 'Tanpa Kelas',
          kelasId: r.siswa.kelasId,
          kategori: 'Retensi Memori Rendah',
          status: 'Butuh Perhatian',
          prioritas: 'Tinggi',
          waktu: r.lastReviewedAt || new Date(),
          aksi: 'Kirim Rekomendasi Review'
        });
      }
    });

    const daftarKelas = await prisma.kelas.findMany({ orderBy: { nama: 'asc' } });

    return res.status(200).json({
      progressPublikasi,
      totalSiswa,
      performaMateri,
      daftarSiswa,
      actionLog,
      daftarKelas
    });
  } catch (err) {
    console.error('getStatistikKelas error:', err);
    return res.status(500).json({ error: 'internal_error', message: 'Gagal mengambil statistik kelas' });
  }
}

async function getStatistikSiswa(req, res) {
  try {
    const siswaId = parseInt(req.params.id, 10);
    const siswa = await prisma.user.findUnique({ where: { id: siswaId, role: 'siswa' } });
    
    if (!siswa) {
      return res.status(404).json({ error: 'not_found', message: 'Siswa tidak ditemukan' });
    }

    const flashcardTersedia = await prisma.flashcard.count({
      where: { status: 'approved', materi: { status: 'published' } }
    });

    const flashcardDireview = await prisma.reviewProgress.count({
      where: { siswaId }
    });

    // Streak / last review
    const lastLog = await prisma.reviewLog.findFirst({
      where: { siswaId },
      orderBy: { createdAt: 'desc' }
    });
    const streak = lastLog ? lastLog.createdAt : null;

    // Distribusi skor
    const distribusi = await prisma.reviewLog.groupBy({
      by: ['skorKualitas'],
      where: { siswaId },
      _count: { skorKualitas: true }
    });
    const histogram = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    distribusi.forEach(d => {
      histogram[d.skorKualitas] = d._count.skorKualitas;
    });

    // Overdue
    const today = new Date();
    const overdueCount = await prisma.reviewProgress.count({
      where: { siswaId, nextReviewDate: { lt: today } }
    });

    // Kuis detail
    const kuis = await prisma.quizAttempt.findMany({
      where: { siswaId },
      include: { materi: { select: { judul: true } } },
      orderBy: { submittedAt: 'desc' }
    });

    return res.status(200).json({
      siswa: {
        id: siswa.id,
        nama: siswa.nama,
        lastSyncAt: siswa.lastSyncAt
      },
      flashcardTersedia,
      flashcardDireview,
      streak,
      histogram,
      overdueCount,
      kuis
    });
  } catch (err) {
    console.error('getStatistikSiswa error:', err);
    return res.status(500).json({ error: 'internal_error', message: 'Gagal mengambil statistik siswa' });
  }
}

module.exports = {
  getStatistikKelas,
  getStatistikSiswa
};
