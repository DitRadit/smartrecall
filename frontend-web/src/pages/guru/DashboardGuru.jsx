import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';

/**
 * DashboardGuru.jsx - Daftar materi milik guru + status masing-masing (FR-8, opsional MVP+).
 */
export default function DashboardGuru() {
  const [materiList, setMateriList] = useState([]);
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    loadMateri();
  }, []);

  function loadMateri() {
    api
      .get('/materi')
      .then((res) => setMateriList(res.data.materi))
      .catch((err) => setError(err.response?.data?.message || 'Gagal memuat daftar materi.'));
  }

  async function handleDelete(materi) {
    const konfirmasi = window.confirm(
      `Hapus materi "${materi.judul}"? Seluruh flashcard, rangkuman, dan bank soal yang terhubung juga akan terhapus. Tindakan ini tidak bisa dibatalkan.`,
    );
    if (!konfirmasi) return;

    setDeletingId(materi.id);
    setError('');
    try {
      await api.delete(`/materi/${materi.id}`);
      setMateriList((prev) => prev.filter((m) => m.id !== materi.id));
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal menghapus materi.');
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="max-w-7xl mx-auto">
      <header className="flex flex-wrap justify-between items-center gap-4 px-container-padding py-stack-md">
        <div className="flex flex-col">
          <h2 className="text-headline-lg text-primary">Materi Saya</h2>
          <p className="text-body-md text-on-surface-variant">Kelola konten edukasi untuk siswa Anda.</p>
        </div>
        <Link
          to="/guru/upload"
          className="bg-primary text-on-primary h-touch-target-min px-6 rounded-xl flex items-center gap-2 hover:opacity-90 transition-opacity active:scale-95"
        >
          <span className="material-symbols-outlined">add</span>
          <span className="text-label-md">Upload Materi Baru</span>
        </Link>
      </header>

      {error && <p className="error-text px-container-padding">{error}</p>}

      <div className="px-container-padding pb-8">
        <div className="border border-outline-variant rounded-xl overflow-hidden bg-surface-container-lowest">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[480px]">
              <thead className="bg-surface-container-low border-b border-outline-variant">
                <tr>
                  <th className="px-6 py-4 text-label-md text-on-surface-variant">Judul Materi</th>
                  <th className="px-6 py-4 text-label-md text-on-surface-variant">Status</th>
                  <th className="px-6 py-4 text-label-md text-on-surface-variant text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant">
                {materiList.map((m) => (
                  <tr key={m.id} className="hover:bg-surface-container-low transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-surface-container flex items-center justify-center shrink-0">
                          <span className="material-symbols-outlined text-on-surface-variant">description</span>
                        </div>
                        <p className="text-label-md text-on-surface">{m.judul}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                          m.status === 'published'
                            ? 'bg-on-tertiary-container/10 text-on-tertiary-container'
                            : 'bg-secondary-container/20 text-on-secondary-container'
                        }`}
                      >
                        {m.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-4">
                        <Link
  to={`/guru/review/${m.id}`}
  className="text-primary hover:underline text-label-sm inline-flex items-center gap-1"
>
  <span className="material-symbols-outlined text-[18px]">
    {m.status === 'draft' ? 'rate_review' : 'edit'}
  </span>
  {m.status === 'draft' ? 'Review Draft' : 'Edit Materi'}
</Link>
                        <button
                          type="button"
                          onClick={() => handleDelete(m)}
                          disabled={deletingId === m.id}
                          className="text-error hover:underline text-label-sm inline-flex items-center gap-1 disabled:opacity-50"
                        >
                          <span className="material-symbols-outlined text-[18px]">delete</span>
                          {deletingId === m.id ? 'Menghapus...' : 'Hapus'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {materiList.length === 0 && !error && (
                  <tr>
                    <td colSpan={3} className="px-6 py-8 text-center text-body-md text-on-surface-variant">
                      Belum ada materi. Mulai dengan upload materi pertama Anda.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}