import { useNavigate } from 'react-router-dom';
import { useAuth } from '../services/authContext';

/**
 * Profil.jsx - Halaman profil sederhana, dirujuk oleh BottomNav.jsx.
 * Menampilkan info akun & tombol keluar (pelengkap top bar Layout.jsx yang
 * juga punya tombol keluar, supaya link "Profil" di bottom nav tidak 404).
 */
export default function Profil() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login');
  }

  if (!user) return null;

  return (
    <div className="max-w-md mx-auto px-container-padding py-stack-lg">
      <div className="flex flex-col items-center text-center mb-6">
        <div className="w-20 h-20 rounded-full bg-primary-container flex items-center justify-center mb-3">
          <span className="material-symbols-outlined text-on-primary text-[40px]">person</span>
        </div>
        <h2 className="text-headline-md text-primary">{user.nama}</h2>
        <p className="text-label-sm text-on-surface-variant capitalize">{user.role}</p>
      </div>

      <div className="bg-surface-container-lowest border border-outline-variant rounded-xl divide-y divide-outline-variant">
        <div className="p-4 flex justify-between items-center">
          <span className="text-body-md text-on-surface-variant">Nama Pengguna</span>
          <span className="text-body-md text-on-surface">{user.username}</span>
        </div>
        {user.nis && (
          <div className="p-4 flex justify-between items-center">
            <span className="text-body-md text-on-surface-variant">NIS</span>
            <span className="text-body-md text-on-surface">{user.nis}</span>
          </div>
        )}
      </div>

      <button
        onClick={handleLogout}
        className="w-full h-touch-target-min mt-6 border border-outline-variant rounded-xl text-label-md text-error flex items-center justify-center gap-2"
      >
        <span className="material-symbols-outlined">logout</span>
        Keluar
      </button>
    </div>
  );
}
