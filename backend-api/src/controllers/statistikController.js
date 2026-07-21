const prisma = require('../config/db');

async function getStatistikKelas(req, res) {
  try {
    const guruId = req.user.id;
    // Ambil materi dari guru (kecuali folder)
    const materiList = await prisma.materi.findMany({
      where: { guruId },
      include: {
        flashcards: true,
        bankSoal: true
      }
    });

    const progressPublikasi = {
      draft: materiList.filter(m => m.status === 'draft').length,
      published: materiList.filter(m => m.status === 'published').length,
    };

    // Total seluruh siswa di sistem
    const totalSiswa = await prisma.user.count({ where: { role: 'siswa' } });

    // Hitung metrik performa per materi
    const performaMateri = await Promise.all(materiList.map(async (m) => {
      const flashcardIds = m.flashcards.map(f => f.id);
      
      let partisipasiSiswa = 0;
      let rataRataSkorKualitas = 0;
      let flashcardTersulit = null;

      if (flashcardIds.length > 0) {
        const uniqueReviewers = await prisma.reviewProgress.findMany({
          where: { flashcardId: { in: flashcardIds } },
          select: { siswaId: true },
          distinct: ['siswaId']
        });
        partisipasiSiswa = uniqueReviewers.length;

        // Rata-rata skor kualitas materi ini
        const logStats = await prisma.reviewLog.aggregate({
          where: { flashcardId: { in: flashcardIds } },
          _avg: { skorKualitas: true }
        });
        rataRataSkorKualitas = logStats._avg.skorKualitas || 0;

        // Flashcard tersulit (paling sering dijawab dengan skor < 3)
        const sulitStats = await prisma.reviewLog.groupBy({
          by: ['flashcardId'],
          where: { flashcardId: { in: flashcardIds }, skorKualitas: { lt: 3 } },
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
        where: { materiId: m.id }
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
      where: { role: 'siswa' },
      select: {
        id: true,
        nama: true,
        username: true,
        lastSyncAt: true
      },
      orderBy: { nama: 'asc' }
    });

    return res.status(200).json({
      progressPublikasi,
      totalSiswa,
      performaMateri,
      daftarSiswa
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
