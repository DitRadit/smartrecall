import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';

/**
 * DashboardGuru.jsx - Daftar materi milik guru + status masing-masing (FR-8, opsional MVP+).
 * Sekarang mendukung fitur Folder/Grouping.
 */
export default function DashboardGuru() {
  const [materiList, setMateriList] = useState([]);
  const [groupList, setGroupList] = useState([]);
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState(null);
  const [deletingGroupId, setDeletingGroupId] = useState(null);

  const [currentParentId, setCurrentParentId] = useState(null);
  const [breadcrumb, setBreadcrumb] = useState([{ id: null, nama: 'Beranda' }]);

  useEffect(() => {
    loadContents();
  }, [currentParentId]);

  function loadContents() {
    const query = currentParentId ? `?parentId=${currentParentId}` : '';
    api
      .get(`/groups${query}`)
      .then((res) => {
        setGroupList(res.data.groups || []);
        setMateriList(res.data.materi || []);
        setError('');
      })
      .catch((err) => setError(err.response?.data?.message || 'Gagal memuat daftar materi dan folder.'));
  }

  async function handleCreateGroup() {
    const nama = window.prompt('Masukkan nama folder baru:');
    if (!nama?.trim()) return;
    
    try {
      await api.post('/groups', { nama: nama.trim(), parentId: currentParentId });
      loadContents();
    } catch (err) {
      alert(err.response?.data?.message || 'Gagal membuat folder');
    }
  }

  function handleNavigateFolder(group) {
    setCurrentParentId(group.id);
    setBreadcrumb((prev) => [...prev, { id: group.id, nama: group.nama }]);
  }

  function handleBreadcrumbClick(index) {
    const newBreadcrumb = breadcrumb.slice(0, index + 1);
    const target = newBreadcrumb[newBreadcrumb.length - 1];
    setBreadcrumb(newBreadcrumb);
    setCurrentParentId(target.id);
  }

  async function handleDeleteGroup(group) {
    const konfirmasi = window.confirm(
      `Hapus folder "${group.nama}"? SELURUH isi (folder lain dan materi) di dalamnya akan ikut terhapus permanen.`,
    );
    if (!konfirmasi) return;

    setDeletingGroupId(group.id);
    setError('');
    try {
      await api.delete(`/groups/${group.id}`);
      setGroupList((prev) => prev.filter((g) => g.id !== group.id));
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal menghapus folder.');
    } finally {
      setDeletingGroupId(null);
    }
  }

  async function handleRenameGroup(group) {
    const nama = window.prompt('Masukkan nama folder baru:', group.nama);
    if (!nama?.trim() || nama.trim() === group.nama) return;

    try {
      await api.put(`/groups/${group.id}`, { nama: nama.trim() });
      loadContents();
    } catch (err) {
      alert(err.response?.data?.message || 'Gagal mengubah nama folder');
    }
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

  async function downloadPpt(materi) {
    setError('');
    try {
      const response = await api.get(`/materi/${materi.id}/ppt`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${materi.judul || 'materi'}.pptx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.response?.data?.message || 'PPT belum tersedia atau gagal didownload.');
    }
  }

  return (
    <div className="max-w-7xl mx-auto">
      <header className="flex flex-wrap justify-between items-center gap-4 px-container-padding py-stack-md">
        <div className="flex flex-col">
          <h2 className="text-headline-lg text-primary">Materi Saya</h2>
          <p className="text-body-md text-on-surface-variant">Kelola konten edukasi untuk siswa Anda.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleCreateGroup}
            className="bg-secondary-container text-on-secondary-container h-touch-target-min px-6 rounded-xl flex items-center gap-2 hover:opacity-90 transition-opacity active:scale-95"
          >
            <span className="material-symbols-outlined">create_new_folder</span>
            <span className="text-label-md">Buat Folder</span>
          </button>
          <Link
            to={currentParentId ? `/guru/upload?groupId=${currentParentId}` : `/guru/upload`}
            className="bg-primary text-on-primary h-touch-target-min px-6 rounded-xl flex items-center gap-2 hover:opacity-90 transition-opacity active:scale-95"
          >
            <span className="material-symbols-outlined">upload_file</span>
            <span className="text-label-md">Upload Materi Baru</span>
          </Link>
        </div>
      </header>

      <div className="px-container-padding pb-4">
        <div className="flex items-center gap-2 text-label-md text-on-surface-variant bg-surface-container-lowest p-3 rounded-xl border border-outline-variant">
          {breadcrumb.map((crumb, index) => (
            <div key={crumb.id || 'root'} className="flex items-center gap-2">
              <button
                onClick={() => handleBreadcrumbClick(index)}
                className={`hover:underline ${index === breadcrumb.length - 1 ? 'font-bold text-primary' : 'text-on-surface-variant'}`}
              >
                {crumb.nama}
              </button>
              {index < breadcrumb.length - 1 && <span className="material-symbols-outlined text-[16px]">chevron_right</span>}
            </div>
          ))}
        </div>
      </div>

      {error && <p className="error-text px-container-padding">{error}</p>}

      <div className="px-container-padding pb-8">
        <div className="border border-outline-variant rounded-xl overflow-hidden bg-surface-container-lowest">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[480px]">
              <thead className="bg-surface-container-low border-b border-outline-variant">
                <tr>
                  <th className="px-6 py-4 text-label-md text-on-surface-variant">Nama / Judul</th>
                  <th className="px-6 py-4 text-label-md text-on-surface-variant">Status</th>
                  <th className="px-6 py-4 text-label-md text-on-surface-variant">Tipe</th>
                  <th className="px-6 py-4 text-label-md text-on-surface-variant text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant">
                
                {/* RENDER FOLDERS (GROUPS) FIRST */}
                {groupList.map((g) => (
                  <tr key={`group-${g.id}`} className="hover:bg-surface-container-low transition-colors cursor-pointer" onClick={(e) => {
                    // Mencegah klik navigasi kalau yang diklik adalah tombol aksi
                    if (e.target.closest('.aksi-buttons')) return;
                    handleNavigateFolder(g);
                  }}>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-secondary-container flex items-center justify-center shrink-0">
                          <span className="material-symbols-outlined text-on-secondary-container">folder</span>
                        </div>
                        <p className="text-label-md text-on-surface font-semibold">{g.nama}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-label-sm text-on-surface-variant">-</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-label-sm text-on-surface-variant font-medium">Folder</span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="aksi-buttons flex items-center justify-end gap-4">
                        <button
                          type="button"
                          onClick={() => handleRenameGroup(g)}
                          className="text-primary hover:underline text-label-sm inline-flex items-center gap-1"
                        >
                          <span className="material-symbols-outlined text-[18px]">edit</span>
                          Ganti Nama
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteGroup(g)}
                          disabled={deletingGroupId === g.id}
                          className="text-error hover:underline text-label-sm inline-flex items-center gap-1 disabled:opacity-50"
                        >
                          <span className="material-symbols-outlined text-[18px]">delete</span>
                          {deletingGroupId === g.id ? 'Hapus...' : 'Hapus'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}

                {/* RENDER MATERI */}
                {materiList.map((m) => (
                  <tr key={`materi-${m.id}`} className="hover:bg-surface-container-low transition-colors">
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
                    <td className="px-6 py-4">
                      <span className="text-label-sm text-on-surface-variant flex flex-col gap-1">
                        Materi
                        {m.pptFile && (
                          <button
                            type="button"
                            onClick={() => downloadPpt(m)}
                            className="text-primary hover:underline text-xs inline-flex items-center"
                          >
                            <span className="material-symbols-outlined text-[14px]">download</span> PPT
                          </button>
                        )}
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
                
                {groupList.length === 0 && materiList.length === 0 && !error && (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-body-md text-on-surface-variant">
                      Folder kosong. Buat folder baru atau upload materi di sini.
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
