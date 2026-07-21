import { NavLink } from 'react-router-dom';

/**
 * BottomNav.jsx - Navigasi bawah untuk mobile (DESIGN.md "Lists"/"Bottom
 * Navigation" pattern), role-aware: item berbeda untuk guru vs siswa.
 * Disembunyikan di layar >= md (desktop guru pakai sidebar, lih. Layout.jsx).
 */
const NAV_ITEMS = {
  siswa: [
    { to: '/siswa/materi', icon: 'local_library', label: 'Belajar' },
    { to: '/profil', icon: 'person', label: 'Profil' },
  ],
  guru: [
    { to: '/guru/dashboard', icon: 'menu_book', label: 'Materi' },
    { to: '/guru/upload', icon: 'cloud_upload', label: 'Upload' },
    { to: '/guru/statistik', icon: 'insights', label: 'Statistik' },
    { to: '/profil', icon: 'person', label: 'Profil' },
  ],
};

export default function BottomNav({ role }) {
  const items = NAV_ITEMS[role] || NAV_ITEMS.siswa;

  return (
    <nav className="md:hidden fixed bottom-0 left-0 w-full flex justify-around items-center px-4 py-2 bg-surface border-t border-outline-variant z-50 shadow-sm">
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          className={({ isActive }) =>
            `flex flex-col items-center justify-center gap-0.5 rounded-xl px-6 py-1 transition-transform active:scale-90 ${
              isActive ? 'bg-secondary-container text-on-secondary-container' : 'text-on-surface-variant'
            }`
          }
        >
          <span className="material-symbols-outlined">{item.icon}</span>
          <span className="font-label-sm text-label-sm">{item.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
