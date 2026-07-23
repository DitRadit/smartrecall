import { useEffect, useState } from 'react';
import api from '../../services/api';
import { useAuth } from '../../services/authContext';

/**
 * ManajemenPengguna.jsx - Guru mengelola akun siswa dan guru.
 * Fitur: tambah siswa, tambah guru, hapus akun, reset password.
 */

const TABS = ['Siswa', 'Guru'];

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-inverse-surface/40 px-4">
      <div className="w-full max-w-md rounded-xl border border-outline-variant bg-surface-container-lowest p-6 shadow-xl">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-headline-md text-on-surface font-bold">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="h-9 w-9 rounded-full hover:bg-surface-container flex items-center justify-center"
            aria-label="Tutup"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ConfirmDialog({ title, message, confirmLabel = 'Hapus', tone = 'danger', onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-inverse-surface/40 px-4">
      <div className="w-full max-w-sm rounded-xl border border-outline-variant bg-surface-container-lowest p-6 shadow-xl space-y-4">
        <h3 className="text-headline-md text-on-surface font-bold">{title}</h3>
        <p className="text-body-md text-on-surface-variant">{message}</p>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onCancel} className="h-10 px-4 rounded-lg border border-outline-variant text-label-md text-on-surface hover:bg-surface-container">
            Batal
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`h-10 px-4 rounded-lg text-label-md font-semibold ${tone === 'danger' ? 'bg-error text-on-error hover:bg-error/90' : 'bg-primary text-on-primary hover:bg-primary/90'}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ManajemenPengguna() {
  const { user: currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState('Siswa');
  const [users, setUsers] = useState([]);
  const [kelasList, setKelasList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  
  const [searchQuery, setSearchQuery] = useState('');
  const [filterKelas, setFilterKelas] = useState('all');

  // Modal tambah
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({ nama: '', username: '', password: '', nis: '', kelasId: '' });
  const [addBusy, setAddBusy] = useState(false);
  const [addError, setAddError] = useState('');

  // Modal reset password
  const [resetTarget, setResetTarget] = useState(null); // { id, nama }
  const [resetPassword, setResetPassword] = useState('');
  const [resetBusy, setResetBusy] = useState(false);
  const [resetError, setResetError] = useState('');

  // Konfirmasi hapus
  const [deleteTarget, setDeleteTarget] = useState(null); // { id, nama }

  useEffect(() => {
    loadUsers();
    setSearchQuery('');
    setFilterKelas('all');
    if (activeTab === 'Siswa') {
      loadKelas();
    }
  }, [activeTab]);

  async function loadKelas() {
    try {
      const res = await api.get('/kelas');
      setKelasList(res.data.kelas || []);
    } catch (err) {
      console.error('Gagal memuat daftar kelas', err);
    }
  }

  async function loadUsers() {
    setLoading(true);
    setError('');
    try {
      const role = activeTab === 'Siswa' ? 'siswa' : 'guru';
      const res = await api.get(`/users?role=${role}`);
      setUsers(res.data.users || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal memuat daftar pengguna');
    } finally {
      setLoading(false);
    }
  }

  function openAddModal() {
    setAddForm({ nama: '', username: '', password: '', nis: '', kelasId: '' });
    setAddError('');
    setShowAddModal(true);
  }

  async function handleAdd(e) {
    e.preventDefault();
    setAddBusy(true);
    setAddError('');
    try {
      const endpoint = activeTab === 'Siswa' ? '/users/siswa' : '/users/guru';
      const body = activeTab === 'Siswa'
        ? { nama: addForm.nama, username: addForm.username, password: addForm.password, nis: addForm.nis || undefined, kelasId: addForm.kelasId || undefined }
        : { nama: addForm.nama, username: addForm.username, password: addForm.password };
      await api.post(endpoint, body);
      setShowAddModal(false);
      setSuccessMsg(`${activeTab} "${addForm.nama}" berhasil ditambahkan.`);
      setTimeout(() => setSuccessMsg(''), 3000);
      loadUsers();
    } catch (err) {
      setAddError(err.response?.data?.message || 'Gagal menambah pengguna');
    } finally {
      setAddBusy(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await api.delete(`/users/${deleteTarget.id}`);
      setSuccessMsg(`Akun "${deleteTarget.nama}" berhasil dihapus.`);
      setTimeout(() => setSuccessMsg(''), 3000);
      setDeleteTarget(null);
      loadUsers();
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal menghapus pengguna');
      setDeleteTarget(null);
    }
  }

  async function handleResetPassword(e) {
    e.preventDefault();
    if (!resetTarget) return;
    setResetBusy(true);
    setResetError('');
    try {
      await api.put(`/users/${resetTarget.id}/password`, { password: resetPassword });
      setSuccessMsg(`Password "${resetTarget.nama}" berhasil direset.`);
      setTimeout(() => setSuccessMsg(''), 3000);
      setResetTarget(null);
      setResetPassword('');
    } catch (err) {
      setResetError(err.response?.data?.message || 'Gagal mereset password');
    } finally {
      setResetBusy(false);
    }
  }

  const filteredUsers = users.filter(u => {
    const matchesSearch = 
      u.nama.toLowerCase().includes(searchQuery.toLowerCase()) || 
      u.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.nis && u.nis.toLowerCase().includes(searchQuery.toLowerCase()));
      
    if (activeTab === 'Siswa' && filterKelas !== 'all') {
      return matchesSearch && u.kelasId === parseInt(filterKelas);
    }
    return matchesSearch;
  });

  return (
    <div className="max-w-3xl mx-auto px-container-padding pt-gutter pb-8 space-y-gutter">
      <div>
        <h2 className="text-headline-lg-mobile text-on-surface">Manajemen Pengguna</h2>
        <p className="text-body-md text-on-surface-variant mt-1">Tambah, hapus, atau reset password akun siswa dan guru.</p>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-error-container px-4 py-3 text-label-md text-on-error-container">
          <span className="material-symbols-outlined text-[18px]">error</span>
          {error}
        </div>
      )}
      {successMsg && (
        <div className="flex items-center gap-2 rounded-lg bg-tertiary-container px-4 py-3 text-label-md text-on-tertiary-container">
          <span className="material-symbols-outlined text-[18px]">check_circle</span>
          {successMsg}
        </div>
      )}

      {/* Tab */}
      <div className="flex border-b border-outline-variant">
        {TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`px-5 py-3 text-label-md font-semibold border-b-2 transition-colors ${
              activeTab === tab
                ? 'border-primary text-primary'
                : 'border-transparent text-on-surface-variant hover:text-on-surface'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tombol tambah & Filter */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px]">search</span>
            <input 
              type="text" 
              placeholder="Cari nama, username..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-10 pr-4 py-2 w-full sm:w-[240px] bg-surface-container-lowest border border-outline-variant rounded-lg text-body-md focus:border-primary focus:ring-1 focus:ring-primary outline-none"
            />
          </div>
          
          {activeTab === 'Siswa' && (
            <div className="relative inline-flex items-center">
              <select 
                value={filterKelas} 
                onChange={e => setFilterKelas(e.target.value)}
                className="appearance-none bg-surface-container-lowest text-on-surface text-body-md pl-3 pr-9 py-2 rounded-lg border border-outline-variant focus:border-primary focus:ring-1 focus:ring-primary outline-none min-w-[140px] cursor-pointer"
              >
                <option value="all">Semua Kelas</option>
                {kelasList.map(k => (
                  <option key={k.id} value={k.id}>{k.nama}</option>
                ))}
              </select>
              <span className="material-symbols-outlined absolute right-2 text-on-surface-variant pointer-events-none text-[20px]">expand_more</span>
            </div>
          )}
        </div>
        
        <button
          type="button"
          onClick={openAddModal}
          className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-lg bg-primary text-on-primary text-label-md font-semibold hover:bg-primary/90 shrink-0"
        >
          <span className="material-symbols-outlined text-[18px]">person_add</span>
          Tambah {activeTab}
        </button>
      </div>

      {/* Tabel pengguna */}
      {loading ? (
        <p className="text-body-md text-on-surface-variant">Memuat...</p>
      ) : users.length === 0 ? (
        <p className="text-body-md text-on-surface-variant">Belum ada {activeTab.toLowerCase()} yang terdaftar.</p>
      ) : filteredUsers.length === 0 ? (
        <p className="text-body-md text-on-surface-variant">Tidak ada {activeTab.toLowerCase()} yang sesuai dengan pencarian atau filter.</p>
      ) : (
        <div className="space-y-3">
          {filteredUsers.map((u) => (
            <div
              key={u.id}
              className="bg-surface-container-lowest border border-outline-variant rounded-xl p-4 flex items-center gap-4"
            >
              <div className="w-10 h-10 rounded-full bg-secondary-container flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[20px] text-on-secondary-container">
                  {u.role === 'guru' ? 'school' : 'person'}
                </span>
              </div>
              <div className="flex-grow min-w-0">
                <p className="text-label-md font-semibold text-on-surface truncate">{u.nama}</p>
                <p className="text-label-sm text-on-surface-variant">@{u.username}{u.nis ? ` · NIS ${u.nis}` : ''}{u.kelas?.nama ? ` · Kelas ${u.kelas.nama}` : ''}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => { setResetTarget(u); setResetPassword(''); setResetError(''); }}
                  title="Reset password"
                  className="h-9 w-9 rounded-full border border-outline-variant hover:bg-surface-container flex items-center justify-center text-on-surface-variant"
                >
                  <span className="material-symbols-outlined text-[18px]">lock_reset</span>
                </button>
                {u.id !== currentUser?.id && (
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(u)}
                    title="Hapus akun"
                    className="h-9 w-9 rounded-full border border-outline-variant hover:bg-error-container hover:border-error flex items-center justify-center text-on-surface-variant hover:text-error"
                  >
                    <span className="material-symbols-outlined text-[18px]">delete</span>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Tambah */}
      {showAddModal && (
        <Modal title={`Tambah ${activeTab}`} onClose={() => setShowAddModal(false)}>
          <form onSubmit={handleAdd} className="space-y-4">
            {addError && (
              <p className="text-label-sm text-error">{addError}</p>
            )}
            <div>
              <label className="block text-label-md text-on-surface mb-1">Nama Lengkap</label>
              <input
                type="text"
                required
                value={addForm.nama}
                onChange={(e) => setAddForm((p) => ({ ...p, nama: e.target.value }))}
                className="w-full h-10 px-3 rounded-lg border border-outline-variant bg-surface text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Contoh: Budi Santoso"
              />
            </div>
            <div>
              <label className="block text-label-md text-on-surface mb-1">Username</label>
              <input
                type="text"
                required
                value={addForm.username}
                onChange={(e) => setAddForm((p) => ({ ...p, username: e.target.value }))}
                className="w-full h-10 px-3 rounded-lg border border-outline-variant bg-surface text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Contoh: budi_santoso"
              />
            </div>
            <div>
              <label className="block text-label-md text-on-surface mb-1">Password Awal</label>
              <input
                type="password"
                required
                minLength={6}
                value={addForm.password}
                onChange={(e) => setAddForm((p) => ({ ...p, password: e.target.value }))}
                className="w-full h-10 px-3 rounded-lg border border-outline-variant bg-surface text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Min. 6 karakter"
              />
            </div>
            {activeTab === 'Siswa' && (
              <>
                <div>
                  <label className="block text-label-md text-on-surface mb-1">NIS <span className="text-on-surface-variant">(opsional)</span></label>
                  <input
                    type="text"
                    value={addForm.nis}
                    onChange={(e) => setAddForm((p) => ({ ...p, nis: e.target.value }))}
                    className="w-full h-10 px-3 rounded-lg border border-outline-variant bg-surface text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Nomor Induk Siswa"
                  />
                </div>
                <div>
                  <label className="block text-label-md text-on-surface mb-1">Kelas <span className="text-on-surface-variant">(opsional)</span></label>
                  <select
                    value={addForm.kelasId}
                    onChange={(e) => setAddForm((p) => ({ ...p, kelasId: e.target.value }))}
                    className="w-full h-10 px-3 rounded-lg border border-outline-variant bg-surface text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="">Pilih Kelas (Tidak ada)</option>
                    {kelasList.map(k => (
                      <option key={k.id} value={k.id}>{k.nama}</option>
                    ))}
                  </select>
                </div>
              </>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setShowAddModal(false)} className="h-10 px-4 rounded-lg border border-outline-variant text-label-md text-on-surface hover:bg-surface-container">
                Batal
              </button>
              <button type="submit" disabled={addBusy} className="h-10 px-4 rounded-lg bg-primary text-on-primary text-label-md font-semibold hover:bg-primary/90 disabled:opacity-60">
                {addBusy ? 'Menyimpan...' : `Tambah ${activeTab}`}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal Reset Password */}
      {resetTarget && (
        <Modal title={`Reset Password — ${resetTarget.nama}`} onClose={() => setResetTarget(null)}>
          <form onSubmit={handleResetPassword} className="space-y-4">
            {resetError && <p className="text-label-sm text-error">{resetError}</p>}
            <p className="text-body-md text-on-surface-variant">
              Masukkan password baru untuk akun <strong>@{resetTarget.username}</strong>.
            </p>
            <div>
              <label className="block text-label-md text-on-surface mb-1">Password Baru</label>
              <input
                type="password"
                required
                minLength={6}
                value={resetPassword}
                onChange={(e) => setResetPassword(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-outline-variant bg-surface text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Min. 6 karakter"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setResetTarget(null)} className="h-10 px-4 rounded-lg border border-outline-variant text-label-md text-on-surface hover:bg-surface-container">
                Batal
              </button>
              <button type="submit" disabled={resetBusy} className="h-10 px-4 rounded-lg bg-primary text-on-primary text-label-md font-semibold hover:bg-primary/90 disabled:opacity-60">
                {resetBusy ? 'Menyimpan...' : 'Reset Password'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Konfirmasi Hapus */}
      {deleteTarget && (
        <ConfirmDialog
          title="Hapus Akun"
          message={`Akun "${deleteTarget.nama}" (@${deleteTarget.username}) akan dihapus permanen beserta seluruh data aktivitas belajarnya. Tindakan ini tidak bisa dibatalkan.`}
          confirmLabel="Hapus Akun"
          tone="danger"
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
