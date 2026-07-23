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
  const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [draggedItem, setDraggedItem] = useState(null);
  const [dropTargetId, setDropTargetId] = useState(null);
  const [renamingGroup, setRenamingGroup] = useState(null);
  const [renameGroupName, setRenameGroupName] = useState('');
  const [renamingBusy, setRenamingBusy] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);

  const [currentParentId, setCurrentParentId] = useState(null);
  const [breadcrumb, setBreadcrumb] = useState([{ id: null, nama: 'Beranda' }]);

  // Sesi Aktif: folder yang sedang dibagikan ke siswa
  const [activeGroupId, setActiveGroupId] = useState(null);
  const [activeGroupNama, setActiveGroupNama] = useState(null);
  const [activeKelasId, setActiveKelasId] = useState(null);
  const [activeKelasNama, setActiveKelasNama] = useState(null);
  const [sessionBusy, setSessionBusy] = useState(false);
  const [sessionError, setSessionError] = useState('');
  // Daftar folder root dan kelas untuk dropdown pilih sesi
  const [rootGroups, setRootGroups] = useState([]);
  const [kelasList, setKelasList] = useState([]);
  const [showSessionPicker, setShowSessionPicker] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [selectedKelasId, setSelectedKelasId] = useState('');

  useEffect(() => {
    loadContents();
  }, [currentParentId]);

  useEffect(() => {
    // Ambil daftar kelas
    api.get('/kelas').then((res) => {
      setKelasList(res.data.kelas || []);
    }).catch(() => {});

    // Ambil status sesi aktif guru saat mount
    api.get('/auth/me')
      .then((res) => {
        const agId = res.data.user?.activeGroupId || null;
        const akId = res.data.user?.activeKelasId || null;
        setActiveGroupId(agId);
        setActiveKelasId(akId);
        if (agId) {
          // Cari nama foldernya dari daftar grup yang sudah/akan di-load
          api.get('/groups').then((r) => {
            const allFolders = r.data.groups || [];
            setRootGroups(allFolders);
            const found = allFolders.find((g) => g.id === agId);
            setActiveGroupNama(found?.nama || `Folder #${agId}`);
          }).catch(() => {});
        } else {
          api.get('/groups').then((r) => setRootGroups(r.data.groups || [])).catch(() => {});
        }
        
        if (akId) {
          api.get('/kelas').then(r => {
            const foundK = (r.data.kelas || []).find(k => k.id === akId);
            setActiveKelasNama(foundK?.nama || `Kelas #${akId}`);
          }).catch(() => {});
        }
      })
      .catch(() => {});
  }, []);

  async function handleStartSession() {
    if (!selectedGroupId || !selectedKelasId) {
      setSessionError('Pilih folder materi dan kelas terlebih dahulu');
      return;
    }
    const groupId = parseInt(selectedGroupId, 10);
    const kelasId = parseInt(selectedKelasId, 10);
    const groupNama = rootGroups.find(g => g.id === groupId)?.nama || '';
    const kelasNama = kelasList.find(k => k.id === kelasId)?.nama || '';

    setSessionBusy(true);
    setSessionError('');
    try {
      await api.put('/auth/active-group', { groupId, kelasId });
      setActiveGroupId(groupId);
      setActiveGroupNama(groupNama);
      setActiveKelasId(kelasId);
      setActiveKelasNama(kelasNama);
      setShowSessionPicker(false);
      setSelectedGroupId('');
      setSelectedKelasId('');
    } catch (err) {
      setSessionError(err.response?.data?.message || 'Gagal memulai sesi');
    } finally {
      setSessionBusy(false);
    }
  }

  async function handleEndSession() {
    setSessionBusy(true);
    setSessionError('');
    try {
      await api.put('/auth/active-group', { groupId: null, kelasId: null });
      setActiveGroupId(null);
      setActiveGroupNama(null);
      setActiveKelasId(null);
      setActiveKelasNama(null);
    } catch (err) {
      setSessionError(err.response?.data?.message || 'Gagal mengakhiri sesi');
    } finally {
      setSessionBusy(false);
    }
  }

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

  async function handleCreateGroup(event) {
    event.preventDefault();
    if (!newGroupName.trim()) return;

    setCreatingGroup(true);
    setError('');
    try {
      await api.post('/groups', { nama: newGroupName.trim(), parentId: currentParentId });
      setNewGroupName('');
      setIsCreateGroupOpen(false);
      loadContents();
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal membuat folder');
    } finally {
      setCreatingGroup(false);
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

  function handleBack() {
    if (breadcrumb.length <= 1) return;
    handleBreadcrumbClick(breadcrumb.length - 2);
  }

  function handleDragStart(event, item) {
    setDraggedItem(item);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('application/json', JSON.stringify(item));
  }

  function readDraggedItem(event) {
    if (draggedItem) return draggedItem;

    try {
      return JSON.parse(event.dataTransfer.getData('application/json'));
    } catch (err) {
      return null;
    }
  }

  function handleDragOver(event, targetGroupId) {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    setDropTargetId(targetGroupId ?? 'root');
  }

  function handleDragLeave() {
    setDropTargetId(null);
  }

  async function handleDrop(event, targetGroupId) {
    event.preventDefault();
    event.stopPropagation();

    const item = readDraggedItem(event);
    setDraggedItem(null);
    setDropTargetId(null);
    if (!item) return;

    if (item.type === 'group' && item.id === targetGroupId) return;
    if (item.type === 'group' && item.parentId === targetGroupId) return;
    if (item.type === 'materi' && item.groupId === targetGroupId) return;

    setError('');
    try {
      if (item.type === 'group') {
        await api.put(`/groups/${item.id}`, { parentId: targetGroupId });
      } else {
        await api.put(`/materi/${item.id}/move`, { groupId: targetGroupId });
      }
      loadContents();
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal memindahkan item.');
    }
  }

  async function deleteGroup(group) {
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

  function handleDeleteGroup(group) {
    setConfirmAction({
      title: 'Hapus Folder',
      message: `Folder "${group.nama}" beserta seluruh subfolder dan materi di dalamnya akan dihapus permanen.`,
      confirmLabel: 'Hapus Folder',
      tone: 'danger',
      onConfirm: () => deleteGroup(group),
    });
  }

  function handleRenameGroup(group) {
    setRenamingGroup(group);
    setRenameGroupName(group.nama);
  }

  async function submitRenameGroup(event) {
    event.preventDefault();
    const nama = renameGroupName.trim();
    if (!renamingGroup || !nama || nama === renamingGroup.nama) return;

    setRenamingBusy(true);
    setError('');
    try {
      await api.put(`/groups/${renamingGroup.id}`, { nama });
      setRenamingGroup(null);
      setRenameGroupName('');
      loadContents();
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal mengubah nama folder');
    } finally {
      setRenamingBusy(false);
    }
  }

  async function deleteMateri(materi) {
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

  function handleDelete(materi) {
    setConfirmAction({
      title: 'Hapus Materi',
      message: `Materi "${materi.judul}" beserta flashcard, rangkuman, dan bank soal yang terhubung akan dihapus permanen.`,
      confirmLabel: 'Hapus Materi',
      tone: 'danger',
      onConfirm: () => deleteMateri(materi),
    });
  }

  async function handleConfirmAction() {
    const action = confirmAction;
    if (!action) return;

    setConfirmAction(null);
    await action.onConfirm();
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
      {isCreateGroupOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-inverse-surface/40 px-4">
          <form
            onSubmit={handleCreateGroup}
            className="w-full max-w-md rounded-xl border border-outline-variant bg-surface-container-lowest p-6 shadow-xl"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-headline-md text-on-surface font-bold">Buat Folder</h3>
                <p className="text-label-sm text-on-surface-variant mt-1">
                  Folder baru akan dibuat di lokasi yang sedang dibuka.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsCreateGroupOpen(false);
                  setNewGroupName('');
                }}
                className="h-9 w-9 rounded-full hover:bg-surface-container flex items-center justify-center"
                aria-label="Tutup dialog"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <label className="block mt-5 text-label-md text-on-surface" htmlFor="nama-folder">
              Nama folder
            </label>
            <input
              id="nama-folder"
              autoFocus
              value={newGroupName}
              onChange={(event) => setNewGroupName(event.target.value)}
              className="mt-2 w-full h-12 rounded-lg border border-outline-variant bg-background px-4 text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Contoh: Biologi Kelas 8"
            />

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setIsCreateGroupOpen(false);
                  setNewGroupName('');
                }}
                className="h-10 px-4 rounded-lg border border-outline-variant text-label-md text-on-surface-variant hover:bg-surface-container"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={!newGroupName.trim() || creatingGroup}
                className="h-10 px-5 rounded-lg bg-primary text-on-primary text-label-md disabled:opacity-50"
              >
                {creatingGroup ? 'Membuat...' : 'Buat'}
              </button>
            </div>
          </form>
        </div>
      )}

      {renamingGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-inverse-surface/40 px-4">
          <form
            onSubmit={submitRenameGroup}
            className="w-full max-w-md rounded-xl border border-outline-variant bg-surface-container-lowest p-6 shadow-xl"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-headline-md text-on-surface font-bold">Ganti Nama Folder</h3>
                <p className="text-label-sm text-on-surface-variant mt-1">
                  Perubahan nama tidak mengubah isi folder.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setRenamingGroup(null);
                  setRenameGroupName('');
                }}
                className="h-9 w-9 rounded-full hover:bg-surface-container flex items-center justify-center"
                aria-label="Tutup dialog"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <label className="block mt-5 text-label-md text-on-surface" htmlFor="rename-folder">
              Nama folder
            </label>
            <input
              id="rename-folder"
              autoFocus
              value={renameGroupName}
              onChange={(event) => setRenameGroupName(event.target.value)}
              className="mt-2 w-full h-12 rounded-lg border border-outline-variant bg-background px-4 text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
            />

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setRenamingGroup(null);
                  setRenameGroupName('');
                }}
                className="h-10 px-4 rounded-lg border border-outline-variant text-label-md text-on-surface-variant hover:bg-surface-container"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={!renameGroupName.trim() || renameGroupName.trim() === renamingGroup.nama || renamingBusy}
                className="h-10 px-5 rounded-lg bg-primary text-on-primary text-label-md disabled:opacity-50"
              >
                {renamingBusy ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </form>
        </div>
      )}

      {confirmAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-inverse-surface/40 px-4">
          <div className="w-full max-w-md rounded-xl border border-outline-variant bg-surface-container-lowest p-6 shadow-xl">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-full bg-error-container flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-error">warning</span>
              </div>
              <div>
                <h3 className="text-headline-md text-on-surface font-bold">{confirmAction.title}</h3>
                <p className="text-body-md text-on-surface-variant mt-2">{confirmAction.message}</p>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmAction(null)}
                className="h-10 px-4 rounded-lg border border-outline-variant text-label-md text-on-surface-variant hover:bg-surface-container"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmAction}
                className={`h-10 px-5 rounded-lg text-label-md ${
                  confirmAction.tone === 'danger'
                    ? 'bg-error text-on-error'
                    : 'bg-primary text-on-primary'
                }`}
              >
                {confirmAction.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Panel Sesi Kelas ── */}
      <div className="px-container-padding pt-gutter">
        <div className={`rounded-xl border p-4 flex flex-wrap items-center gap-4 ${activeGroupId ? 'border-tertiary-container bg-tertiary-container/30' : 'border-outline-variant bg-surface-container-lowest'}`}>
          <div className="flex items-center gap-3 flex-grow min-w-0">
            <span className={`material-symbols-outlined text-[28px] ${activeGroupId ? 'text-on-tertiary-container' : 'text-on-surface-variant'}`}>
              {activeGroupId ? 'wifi' : 'wifi_off'}
            </span>
            <div className="min-w-0">
              <p className="text-label-md font-semibold text-on-surface">Sesi Kelas</p>
              {activeGroupId && activeKelasId ? (
                <p className="text-body-sm text-on-tertiary-container truncate">
                  Aktif: <strong>{activeGroupNama}</strong> untuk <strong>{activeKelasNama}</strong> — siswa di kelas tersebut dapat melihat materi ini
                </p>
              ) : (
                <p className="text-body-sm text-on-surface-variant">Belum ada sesi aktif — siswa tidak melihat materi apapun</p>
              )}
              {sessionError && <p className="text-label-sm text-error mt-1">{sessionError}</p>}
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            {activeGroupId ? (
              <button
                type="button"
                onClick={handleEndSession}
                disabled={sessionBusy}
                className="h-9 px-4 rounded-lg border border-error text-label-md text-error hover:bg-error-container disabled:opacity-60"
              >
                {sessionBusy ? 'Memproses...' : 'Akhiri Sesi'}
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => setShowSessionPicker((v) => !v)}
              disabled={sessionBusy}
              className="h-9 px-4 rounded-lg bg-primary text-on-primary text-label-md font-semibold hover:bg-primary/90 disabled:opacity-60"
            >
              {activeGroupId ? 'Ganti Sesi' : 'Mulai Sesi'}
            </button>
          </div>
        </div>

        {/* Dropdown pilih folder sesi */}
        {showSessionPicker && (
          <div className="mt-2 rounded-xl border border-outline-variant bg-surface-container-lowest shadow-lg p-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-label-md text-on-surface mb-1">Folder Materi</label>
                <select
                  value={selectedGroupId}
                  onChange={(e) => setSelectedGroupId(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-outline-variant bg-background text-body-md focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">-- Pilih Folder Materi --</option>
                  {rootGroups.map(g => (
                    <option key={g.id} value={g.id}>{g.nama}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-label-md text-on-surface mb-1">Kelas Tujuan</label>
                <select
                  value={selectedKelasId}
                  onChange={(e) => setSelectedKelasId(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-outline-variant bg-background text-body-md focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">-- Pilih Kelas --</option>
                  {kelasList.map(k => (
                    <option key={k.id} value={k.id}>{k.nama}</option>
                  ))}
                </select>
              </div>
            </div>
            
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowSessionPicker(false)}
                className="h-9 px-4 rounded-lg border border-outline-variant text-label-md hover:bg-surface-container"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleStartSession}
                disabled={sessionBusy || !selectedGroupId || !selectedKelasId}
                className="h-9 px-4 rounded-lg bg-primary text-on-primary text-label-md font-semibold disabled:opacity-50"
              >
                {sessionBusy ? 'Memproses...' : 'Terapkan'}
              </button>
            </div>
          </div>
        )}
      </div>

      <header className="flex flex-wrap justify-between items-center gap-4 px-container-padding py-stack-md">
        <div className="flex flex-col">
          <h2 className="text-headline-lg text-primary">Materi Saya</h2>
          <p className="text-body-md text-on-surface-variant">Kelola konten edukasi untuk siswa Anda.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setIsCreateGroupOpen(true)}
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
        {currentParentId && (
          <button
            type="button"
            onClick={handleBack}
            className="mb-3 inline-flex items-center gap-2 h-10 px-4 rounded-lg border border-outline-variant text-label-md text-primary hover:bg-surface-container"
          >
            <span className="material-symbols-outlined text-[20px]">arrow_back</span>
            Kembali
          </button>
        )}
        <div className="flex items-center gap-2 text-label-md text-on-surface-variant bg-surface-container-lowest p-3 rounded-xl border border-outline-variant">
          {breadcrumb.map((crumb, index) => (
            <div key={crumb.id || 'root'} className="flex items-center gap-2">
              <button
                onClick={() => handleBreadcrumbClick(index)}
                onDragOver={(event) => handleDragOver(event, crumb.id)}
                onDragLeave={handleDragLeave}
                onDrop={(event) => handleDrop(event, crumb.id)}
                className={`rounded-md px-2 py-1 hover:underline ${
                  dropTargetId === (crumb.id ?? 'root')
                    ? 'bg-primary text-on-primary'
                    : index === breadcrumb.length - 1
                      ? 'font-bold text-primary'
                      : 'text-on-surface-variant'
                }`}
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
                  <tr
                    key={`group-${g.id}`}
                    draggable
                    onDragStart={(event) => handleDragStart(event, { type: 'group', id: g.id, parentId: currentParentId })}
                    onDragEnd={() => {
                      setDraggedItem(null);
                      setDropTargetId(null);
                    }}
                    onDragOver={(event) => handleDragOver(event, g.id)}
                    onDragLeave={handleDragLeave}
                    onDrop={(event) => handleDrop(event, g.id)}
                    className={`hover:bg-surface-container-low transition-colors cursor-pointer ${
                      dropTargetId === g.id ? 'bg-primary-container/40' : ''
                    }`}
                    onClick={(e) => {
                      // Mencegah klik navigasi kalau yang diklik adalah tombol aksi
                      if (e.target.closest('.aksi-buttons')) return;
                      handleNavigateFolder(g);
                    }}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-secondary-container flex items-center justify-center shrink-0">
                          <span className="material-symbols-outlined text-on-secondary-container">folder</span>
                        </div>
                        <div className="min-w-0">
                          <p className="text-label-md text-on-surface font-semibold truncate">{g.nama}</p>
                          <p className="text-label-sm text-on-surface-variant">Tarik item ke folder ini untuk memindahkan</p>
                        </div>
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
                  <tr
                    key={`materi-${m.id}`}
                    draggable
                    onDragStart={(event) => handleDragStart(event, { type: 'materi', id: m.id, groupId: currentParentId })}
                    onDragEnd={() => {
                      setDraggedItem(null);
                      setDropTargetId(null);
                    }}
                    className="hover:bg-surface-container-low transition-colors cursor-grab active:cursor-grabbing"
                  >
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
