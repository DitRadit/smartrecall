import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
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
  const location = useLocation();
  const [isOffline, setIsOffline] = useState(() => typeof navigator !== 'undefined' && !navigator.onLine);
  const [isPwaMode, setIsPwaMode] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;
  });
  const homePath = user?.role === 'guru' ? '/guru/dashboard' : '/siswa/materi';
  const showBackButton = Boolean(user && location.pathname !== homePath);
  const showLogout = Boolean(user && !isOffline && !isPwaMode);

  useEffect(() => {
    function updateOnlineStatus() {
      setIsOffline(!navigator.onLine);
    }

    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
    updateOnlineStatus();

    return () => {
      window.removeEventListener('online', updateOnlineStatus);
      window.removeEventListener('offline', updateOnlineStatus);
    };
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia?.('(display-mode: standalone)');
    function updatePwaMode() {
      setIsPwaMode(mediaQuery?.matches || window.navigator.standalone === true);
    }

    updatePwaMode();
    mediaQuery?.addEventListener?.('change', updatePwaMode);
    return () => mediaQuery?.removeEventListener?.('change', updatePwaMode);
  }, []);

  function handleLogout() {
    logout();
    navigate('/login');
  }

  function handleBack() {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate(homePath);
    }
  }

  return (
    <div className="min-h-screen bg-background text-on-surface pb-24 md:pb-0">
      <InstallPrompt />
      {user && (
        <>
          <header className="flex justify-between items-center px-container-padding h-touch-target-min w-full bg-surface border-b border-outline-variant sticky top-0 z-30">
            <div className="flex items-center gap-2 min-w-0">
              {showBackButton && (
                <button
                  type="button"
                  onClick={handleBack}
                  aria-label="Kembali"
                  className="w-10 h-10 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container-high hover:text-primary active:scale-95 transition-all shrink-0"
                >
                  <span className="material-symbols-outlined text-[22px]">arrow_back</span>
                </button>
              )}
              <span className="material-symbols-outlined text-primary">school</span>
              <h1 className="font-headline-md text-headline-md font-bold text-primary truncate">SmartRecall</h1>
            </div>
            <div className="flex items-center gap-3">
              <span className="hidden sm:inline font-label-sm text-label-sm text-on-surface-variant">{user.nama}</span>
              {showLogout && (
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-1 text-on-surface-variant hover:text-primary text-label-sm font-label-sm px-2 py-1"
                >
                  <span className="material-symbols-outlined text-[20px]">logout</span>
                  Keluar
                </button>
              )}
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
                  <Link
                    to="/guru/statistik"
                    className="rounded-full px-4 py-3 flex items-center gap-3 text-on-surface-variant hover:bg-surface-container-high transition-colors"
                  >
                    <span className="material-symbols-outlined">insights</span>
                    <span className="font-label-md text-label-md">Statistik Kelas</span>
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
