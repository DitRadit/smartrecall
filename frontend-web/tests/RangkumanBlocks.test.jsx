import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import RangkumanBlocks from '../src/components/RangkumanBlocks';

/**
 * Test untuk RangkumanBlocks.jsx -- terutama logic parsing & graceful
 * fallback untuk data lama (rangkuman versi sebelum perubahan format
 * block-based, tersimpan sebagai prosa polos di database/cache lama).
 */
describe('RangkumanBlocks', () => {
  it('merender semua tipe blok terstruktur dengan benar', () => {
    const blocks = [
      { type: 'paragraf', teks: 'Ini paragraf pembuka.' },
      { type: 'heading', teks: 'Tahap 1: Penguapan' },
      { type: 'list', items: ['Air menguap', 'Uap naik ke atmosfer'] },
      { type: 'contoh', teks: 'Contoh: air laut menguap karena panas matahari.' },
      { type: 'tip', teks: 'Siklus air penting untuk kehidupan.' },
    ];

    render(<RangkumanBlocks konten={JSON.stringify(blocks)} />);

    expect(screen.getByText('Ini paragraf pembuka.')).toBeInTheDocument();
    expect(screen.getByText('Tahap 1: Penguapan')).toBeInTheDocument();
    expect(screen.getByText('Air menguap')).toBeInTheDocument();
    expect(screen.getByText('Uap naik ke atmosfer')).toBeInTheDocument();
    expect(screen.getByText(/Contoh: air laut menguap/)).toBeInTheDocument();
    expect(screen.getByText('Ingat!')).toBeInTheDocument();
    expect(screen.getByText('Siklus air penting untuk kehidupan.')).toBeInTheDocument();
  });

  it('fallback ke paragraf biasa jika konten adalah data lama (prosa polos, bukan JSON)', () => {
    const legacyKonten = 'Ini rangkuman lama baris pertama.\nIni baris kedua.';

    render(<RangkumanBlocks konten={legacyKonten} />);

    expect(screen.getByText('Ini rangkuman lama baris pertama.')).toBeInTheDocument();
    expect(screen.getByText('Ini baris kedua.')).toBeInTheDocument();
  });

  it('fallback ke paragraf biasa jika JSON valid tapi bukan array (mis. object lama {konten:...})', () => {
    const legacyJsonObject = JSON.stringify({ konten: 'Format objek lama' });

    render(<RangkumanBlocks konten={legacyJsonObject} />);

    // JSON.stringify({konten:...}) di-treat sebagai satu baris teks -> jadi 1 paragraf fallback
    expect(screen.getByText(legacyJsonObject)).toBeInTheDocument();
  });

  it('menampilkan pesan hint jika konten kosong', () => {
    render(<RangkumanBlocks konten="" />);
    expect(screen.getByText('Rangkuman belum memiliki konten.')).toBeInTheDocument();
  });

  it('menampilkan pesan hint jika konten null/undefined', () => {
    render(<RangkumanBlocks konten={null} />);
    expect(screen.getByText('Rangkuman belum memiliki konten.')).toBeInTheDocument();
  });
});
