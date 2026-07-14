/**
 * OfflineBanner.jsx - Banner amber persisten di atas viewport saat offline,
 * sesuai DESIGN.md: "Offline Banners & Toasts... persistent Amber banner...
 * simple icon and concise text."
 */
export default function OfflineBanner({ children }) {
  return (
    <div className="w-full flex items-center justify-center py-2 px-4 gap-2 sticky top-0 z-40 bg-secondary-container text-on-secondary-container">
      <span className="material-symbols-outlined text-[20px]">cloud_off</span>
      <span className="font-label-md text-label-md font-bold text-center">{children}</span>
    </div>
  );
}
