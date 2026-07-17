/**
 * materiController.test.js - Test untuk logika pemecahan hasil generate AI
 * (draft.flashcard / draft.rangkuman / draft.soal) ke tabel masing-masing,
 * sesuai perubahan alur upload: satu file PDF -> generate ketiga jenis
 * konten sekaligus, tanpa guru memilih jenis konten satu-satu.
 *
 * prisma & aiServiceClient di-mock supaya test murni memverifikasi logic,
 * tanpa butuh database atau koneksi ke ai-service sungguhan.
 */

jest.mock('../src/config/db', () => ({
  flashcard: { createMany: jest.fn() },
  bankSoal: { createMany: jest.fn() },
  rangkuman: { upsert: jest.fn() },
  materi: { update: jest.fn() },
}));

jest.mock('../src/services/aiServiceClient', () => ({
  generateMateri: jest.fn(),
}));

const prisma = require('../src/config/db');
const aiServiceClient = require('../src/services/aiServiceClient');
const { generateAIContentInBackground } = require('../src/controllers/materiController');

describe('generateAIContentInBackground', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('menyimpan ketiga jenis konten sekaligus saat semuanya berhasil di-generate', async () => {
    const rangkumanBlocks = [
      { type: 'paragraf', teks: 'Fotosintesis adalah proses...' },
      { type: 'heading', teks: 'Tahap 1: Penyerapan Cahaya' },
      { type: 'list', items: ['Klorofil menyerap cahaya', 'Air diserap akar'] },
      { type: 'tip', teks: 'Ingat: fotosintesis butuh cahaya, air, dan CO2.' },
    ];

    aiServiceClient.generateMateri.mockResolvedValue({
      status: 'success',
      draft: {
        flashcard: { parsed: [{ pertanyaan: 'Apa itu fotosintesis?', jawaban: 'Proses...' }] },
        rangkuman: { parsed: rangkumanBlocks },
        soal: { parsed: [{ pertanyaan: '...', opsi_jawaban: ['A', 'B'], jawaban_benar: 'A' }] },
      },
    });

    await generateAIContentInBackground(1, Buffer.from('fake-pdf'), 'materi.pdf');

    expect(aiServiceClient.generateMateri).toHaveBeenCalledWith(Buffer.from('fake-pdf'), 'materi.pdf', 'all', {
      generatePpt: false,
      judul: undefined,
    });
    expect(prisma.flashcard.createMany).toHaveBeenCalledTimes(1);
    expect(prisma.bankSoal.createMany).toHaveBeenCalledTimes(1);
    expect(prisma.rangkuman.upsert).toHaveBeenCalledTimes(1);

    expect(prisma.flashcard.createMany.mock.calls[0][0].data[0]).toMatchObject({
      materiId: 1,
      pertanyaan: 'Apa itu fotosintesis?',
      status: 'draft',
    });

    const rangkumanCall = prisma.rangkuman.upsert.mock.calls[0][0];
    expect(rangkumanCall.where).toEqual({ materiId: 1 });
    expect(rangkumanCall.create.materiId).toBe(1);
    expect(rangkumanCall.create.status).toBe('draft');
    // konten disimpan sebagai JSON string dari blok-blok konten (bukan lagi prosa polos)
    expect(JSON.parse(rangkumanCall.create.konten)).toEqual(rangkumanBlocks);
  });

  it('tetap menyimpan jenis yang berhasil walau salah satu jenis gagal (draft null + errors)', async () => {
    aiServiceClient.generateMateri.mockResolvedValue({
      status: 'success',
      draft: {
        flashcard: { parsed: [{ pertanyaan: 'Q1', jawaban: 'A1' }] },
        rangkuman: null,
        soal: { parsed: [{ pertanyaan: 'Q2', opsi_jawaban: ['A', 'B'], jawaban_benar: 'B' }] },
      },
      errors: { rangkuman: 'Rate limit tercapai pada NVIDIA NIM API (429).' },
    });

    await generateAIContentInBackground(2, Buffer.from('fake-pdf'), 'materi2.pdf');

    expect(prisma.flashcard.createMany).toHaveBeenCalledTimes(1);
    expect(prisma.bankSoal.createMany).toHaveBeenCalledTimes(1);
    expect(prisma.rangkuman.upsert).not.toHaveBeenCalled(); // rangkuman gagal, tidak disimpan
  });

  it('tidak melempar error ke pemanggil saat ai-service gagal total (graceful degradation)', async () => {
    aiServiceClient.generateMateri.mockRejectedValue(new Error('ai-service down'));

    await expect(generateAIContentInBackground(3, Buffer.from('fake-pdf'), 'materi3.pdf')).resolves.not.toThrow();

    expect(prisma.flashcard.createMany).not.toHaveBeenCalled();
    expect(prisma.bankSoal.createMany).not.toHaveBeenCalled();
    expect(prisma.rangkuman.upsert).not.toHaveBeenCalled();
  });

  it('tidak memanggil createMany untuk jenis dengan array kosong (menghindari insert data kosong)', async () => {
    aiServiceClient.generateMateri.mockResolvedValue({
      status: 'success',
      draft: {
        flashcard: { parsed: [] },
        rangkuman: { parsed: [{ type: 'paragraf', teks: 'Rangkuman valid.' }] },
        soal: { parsed: [] },
      },
    });

    await generateAIContentInBackground(4, Buffer.from('fake-pdf'), 'materi4.pdf');

    expect(prisma.flashcard.createMany).not.toHaveBeenCalled();
    expect(prisma.bankSoal.createMany).not.toHaveBeenCalled();
    expect(prisma.rangkuman.upsert).toHaveBeenCalledTimes(1);
  });

  it('tidak menyimpan rangkuman jika hasil parsed berupa array kosong', async () => {
    aiServiceClient.generateMateri.mockResolvedValue({
      status: 'success',
      draft: {
        flashcard: { parsed: [{ pertanyaan: 'Q', jawaban: 'A' }] },
        rangkuman: { parsed: [] },
        soal: { parsed: [] },
      },
    });

    await generateAIContentInBackground(5, Buffer.from('fake-pdf'), 'materi5.pdf');

    expect(prisma.rangkuman.upsert).not.toHaveBeenCalled();
  });

  it('meminta dan menyimpan PPT jika opsi generatePpt aktif', async () => {
    aiServiceClient.generateMateri.mockResolvedValue({
      status: 'success',
      draft: {
        flashcard: { parsed: [{ pertanyaan: 'Q', jawaban: 'A' }] },
        rangkuman: { parsed: [{ type: 'paragraf', teks: 'Rangkuman valid.' }] },
        soal: { parsed: [{ pertanyaan: 'Q2', opsi_jawaban: ['A', 'B'], jawaban_benar: 'A' }] },
      },
      ppt: {
        filename: 'materi.pptx',
        content_base64: Buffer.from('fake-ppt').toString('base64'),
      },
    });

    await generateAIContentInBackground(6, Buffer.from('fake-pdf'), 'materi6.pdf', {
      generatePpt: true,
      judul: 'Materi 6',
    });

    expect(aiServiceClient.generateMateri).toHaveBeenCalledWith(Buffer.from('fake-pdf'), 'materi6.pdf', 'all', {
      generatePpt: true,
      judul: 'Materi 6',
    });
    expect(prisma.materi.update).toHaveBeenCalledWith({
      where: { id: 6 },
      data: { pptFile: '6-Materi-6.pptx' },
    });
  });
});
