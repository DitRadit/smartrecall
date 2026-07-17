/**
 * Seed data demo minimal untuk testing/demo.
 * Jalankan: npm run seed
 */

require('dotenv').config();
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const guruPasswordHash = await bcrypt.hash('guru123', 10);
  const guru = await prisma.user.upsert({
    where: { username: 'guru_demo' },
    update: {},
    create: {
      nama: 'Bu Sari',
      role: 'guru',
      username: 'guru_demo',
      passwordHash: guruPasswordHash,
    },
  });

  const siswaPasswordHash = await bcrypt.hash('siswa123', 10);
  const siswa = await prisma.user.upsert({
    where: { username: 'siswa_demo' },
    update: {},
    create: {
      nama: 'Budi',
      role: 'siswa',
      username: 'siswa_demo',
      passwordHash: siswaPasswordHash,
      nis: '1234567890',
      kelasId: 'kelas-7a',
    },
  });

  const materi = await prisma.materi.create({
    data: {
      guruId: guru.id,
      judul: 'Pengantar Fotosintesis',
      fileOriginal: 'fotosintesis.pdf',
      status: 'published',
      flashcards: {
        create: [
          { pertanyaan: 'Apa itu fotosintesis?', jawaban: 'Proses tumbuhan mengubah cahaya matahari menjadi energi kimia.', status: 'approved' },
          { pertanyaan: 'Apa hasil utama fotosintesis?', jawaban: 'Glukosa dan oksigen.', status: 'approved' },
        ],
      },
    },
  });

  console.log('Seed selesai:', { guru: guru.username, siswa: siswa.username, materi: materi.judul });
  console.log('Login guru  : username=guru_demo, password=guru123');
  console.log('Login siswa : username=siswa_demo, password=siswa123');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
