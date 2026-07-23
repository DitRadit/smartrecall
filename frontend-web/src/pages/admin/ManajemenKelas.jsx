import { useEffect, useState } from 'react';
import api from '../../services/api';

export default function ManajemenKelas() {
  const [kelasList, setKelasList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [newNama, setNewNama] = useState('');
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState('');
  
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    fetchKelas();
  }, []);

  async function fetchKelas() {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/kelas');
      setKelasList(res.data.kelas || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal memuat daftar kelas');
    } finally {
      setLoading(false);
    }
  }

  async function handleAddKelas(e) {
    e.preventDefault();
    if (!newNama.trim()) return;
    
    setAdding(true);
    setAddError('');
    try {
      const res = await api.post('/kelas', { nama: newNama });
      setNewNama('');
      fetchKelas();
    } catch (err) {
      setAddError(err.response?.data?.message || 'Gagal menambah kelas');
    } finally {
      setAdding(false);
    }
  }

  async function handleDelete(id, nama) {
    if (!window.confirm(`Yakin ingin menghapus kelas "${nama}"?`)) return;
    
    setDeletingId(id);
    try {
      await api.delete(`/kelas/${id}`);
      fetchKelas();
    } catch (err) {
      alert(err.response?.data?.message || 'Gagal menghapus kelas');
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-container-padding py-stack-md">
      <header className="mb-8">
        <h2 className="text-headline-lg text-primary">Manajemen Kelas</h2>
        <p className="text-body-md text-on-surface-variant">Kelola daftar kelas yang ada di sekolah.</p>
      </header>

      {error && <div className="mb-4 p-4 bg-error-container text-on-error-container rounded-xl">{error}</div>}

      <form onSubmit={handleAddKelas} className="mb-8 p-4 border border-outline-variant rounded-xl bg-surface-container-lowest">
        <h3 className="text-title-md font-semibold mb-4">Tambah Kelas Baru</h3>
        {addError && <p className="text-error text-body-sm mb-2">{addError}</p>}
        <div className="flex gap-4 items-center">
          <input
            type="text"
            value={newNama}
            onChange={(e) => setNewNama(e.target.value)}
            placeholder="Nama Kelas (Contoh: 10 IPA 1)"
            className="flex-1 h-12 px-4 rounded-lg border border-outline-variant bg-background focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            required
          />
          <button
            type="submit"
            disabled={adding || !newNama.trim()}
            className="h-12 px-6 rounded-lg bg-primary text-on-primary font-semibold hover:bg-primary/90 disabled:opacity-50"
          >
            {adding ? 'Menambah...' : 'Tambah'}
          </button>
        </div>
      </form>

      <div className="border border-outline-variant rounded-xl overflow-hidden bg-surface-container-lowest">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[400px]">
            <thead className="bg-surface-container-low border-b border-outline-variant">
              <tr>
              <th className="px-6 py-4 text-label-md text-on-surface-variant">Nama Kelas</th>
              <th className="px-6 py-4 text-label-md text-on-surface-variant text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant">
            {loading ? (
              <tr>
                <td colSpan={2} className="px-6 py-8 text-center text-on-surface-variant">Memuat data...</td>
              </tr>
            ) : kelasList.length === 0 ? (
              <tr>
                <td colSpan={2} className="px-6 py-8 text-center text-on-surface-variant">Belum ada kelas yang terdaftar.</td>
              </tr>
            ) : (
              kelasList.map((k) => (
                <tr key={k.id} className="hover:bg-surface-container-low">
                  <td className="px-6 py-4 text-body-md font-semibold text-on-surface">{k.nama}</td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => handleDelete(k.id, k.nama)}
                      disabled={deletingId === k.id}
                      className="text-error hover:underline text-label-sm inline-flex items-center gap-1 disabled:opacity-50"
                    >
                      <span className="material-symbols-outlined text-[18px]">delete</span>
                      Hapus
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}
