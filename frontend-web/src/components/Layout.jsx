import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../services/authContext';
import InstallPrompt from './InstallPrompt';
import BottomNav from './BottomNav';

/**
 * Layout.jsx - Top bar + navigasi, mengikuti pola desain Stitch:
 *  - Mobile (semua role): top bar ringkas + bottom nav (BottomNav.jsx)
 *  - Desktop guru: tambahan sidebar kiri (mirip guru_dashboard_materi)
 */
export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <div className="min-h-screen bg-background text-on-surface pb-24 md:pb-0">
      <InstallPrompt />
      {user && (
        <>
          <header className="flex justify-between items-center px-container-padding h-touch-target-min w-full bg-surface border-b border-outline-variant sticky top-0 z-30">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">school</span>
              <h1 className="font-headline-md text-headline-md font-bold text-primary">SmartRecall</h1>
            </div>
            <div className="flex items-center gap-3">
              <span className="hidden sm:inline font-label-sm text-label-sm text-on-surface-variant">{user.nama}</span>
              <button
                onClick={handleLogout}
                className="flex items-center gap-1 text-on-surface-variant hover:text-primary text-label-sm font-label-sm px-2 py-1"
              >
                <span className="material-symbols-outlined text-[20px]">logout</span>
                Keluar
              </button>
            </div>
          </header>

          {user.role === 'guru' && (
            <div className="hidden md:flex">
              <aside className="w-60 shrink-0 border-r border-outline-variant min-h-[calc(100vh-64px)] p-4">
                <nav className="flex flex-col gap-2">
                  <Link
                    to="/guru/dashboard"
                    className="rounded-full px-4 py-3 flex items-center gap-3 text-on-surface-variant hover:bg-surface-container-high transition-colors"
                  >
                    <span className="material-symbols-outlined">menu_book</span>
                    <span className="font-label-md text-label-md">Materi Saya</span>
                  </Link>
                  <Link
                    to="/guru/upload"
                    className="rounded-full px-4 py-3 flex items-center gap-3 text-on-surface-variant hover:bg-surface-container-high transition-colors"
                  >
                    <span className="material-symbols-outlined">cloud_upload</span>
                    <span className="font-label-md text-label-md">Upload</span>
                  </Link>
                </nav>
              </aside>
              <main className="flex-1">{children}</main>
            </div>
          )}
        </>
      )}

      {(!user || user.role !== 'guru') && <main>{children}</main>}
      {user?.role === 'guru' && <main className="md:hidden">{children}</main>}

      {user && <BottomNav role={user.role} />}
    </div>
  );
}
