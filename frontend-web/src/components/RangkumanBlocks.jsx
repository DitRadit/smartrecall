/**
 * RangkumanBlocks.jsx - Merender rangkuman AI berbentuk blok konten terstruktur
 * (heading, paragraf, list, contoh, tip) sesuai skema di
 * ai-service/services/nim_client.py _build_prompt("rangkuman").
 *
 * `konten` yang diterima adalah STRING (hasil JSON.stringify dari backend,
 * lih. materiController.js generateAIContentInBackground). Komponen ini yang
 * bertanggung jawab JSON.parse-nya.
 *
 * Graceful fallback: rangkuman lama (sebelum perubahan ini) tersimpan sebagai
 * prosa biasa (bukan JSON array), baik di database maupun di cache
 * IndexedDB siswa yang sempat offline sebelum update. Kalau JSON.parse gagal
 * atau hasilnya bukan array, tampilkan sebagai paragraf biasa (perilaku lama)
 * alih-alih menampilkan halaman kosong/error ke siswa.
 */
function parseBlocks(konten) {
  if (!konten) return [];
  try {
    const parsed = JSON.parse(konten);
    if (Array.isArray(parsed)) return parsed;
  } catch (e) {
    // bukan JSON valid -> kemungkinan data lama (prosa polos), fallback di bawah
  }
  return konten
    .split('\n')
    .filter(Boolean)
    .map((teks) => ({ type: 'paragraf', teks }));
}

export default function RangkumanBlocks({ konten }) {
  const blocks = parseBlocks(konten);

  if (blocks.length === 0) {
    return <p className="hint-text">Rangkuman belum memiliki konten.</p>;
  }

  return (
    <div className="space-y-4">
      {blocks.map((block, i) => {
        switch (block.type) {
          case 'heading':
            return (
              <h3 key={i} className="text-headline-md text-primary mt-2">
                {block.teks}
              </h3>
            );
          case 'list':
            return (
              <ul key={i} className="list-disc list-inside space-y-1">
                {(block.items || []).map((item, j) => (
                  <li key={j} className="text-body-md text-on-surface-variant">
                    {item}
                  </li>
                ))}
              </ul>
            );
          case 'contoh':
            return (
              <div key={i} className="bg-surface-container-low border-l-4 border-secondary-container rounded-r-lg p-4">
                <p className="text-label-sm text-secondary font-bold uppercase tracking-wide mb-1">Contoh</p>
                <p className="text-body-md text-on-surface-variant">{block.teks}</p>
              </div>
            );
          case 'tip':
            return (
              <div key={i} className="bg-primary-container text-on-primary rounded-xl p-4 flex gap-3">
                <span className="material-symbols-outlined text-secondary-container flex-shrink-0">lightbulb</span>
                <div>
                  <p className="text-label-md font-bold mb-1">Ingat!</p>
                  <p className="text-body-md text-primary-fixed">{block.teks}</p>
                </div>
              </div>
            );
          case 'paragraf':
          default:
            return (
              <p key={i} className="text-body-md text-on-surface-variant leading-relaxed">
                {block.teks}
              </p>
            );
        }
      })}
    </div>
  );
}
