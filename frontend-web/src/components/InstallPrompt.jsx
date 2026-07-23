import { useEffect, useState } from 'react';

/**
 * InstallPrompt.jsx - Tombol "Install App" eksplisit di UI.
 *
 * Tanpa ini, instalasi PWA hanya mengandalkan prompt otomatis browser (ikon
 * install di address bar / menu "Add to Home Screen"), yang kurang terlihat
 * bagi siswa dengan literasi digital rendah (PRD.md NFR Usability).
 *
 * Android/Desktop Chrome & Edge: menangkap event `beforeinstallprompt` dan
 * memicunya lewat tombol.
 * iOS Safari: TIDAK mendukung `beforeinstallprompt` sama sekali -- browser
 * tidak pernah mengirim event ini, jadi kita deteksi platform iOS secara
 * manual dan tampilkan instruksi "Add to Home Screen" lewat menu Share.
 */
export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;
    setIsStandalone(standalone);

    const ua = window.navigator.userAgent || '';
    setIsIOS(/iPad|iPhone|iPod/.test(ua) && !window.MSStream);

    function handleBeforeInstallPrompt(event) {
      event.preventDefault();
      setDeferredPrompt(event);
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  async function handleInstallClick() {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice; // { outcome: 'accepted' | 'dismissed' }
    setDeferredPrompt(null); // event hanya bisa dipakai sekali
  }

  // Sudah terinstall (berjalan sebagai app standalone) -> tidak perlu tampilkan apa pun.
  if (isStandalone) return null;

  // Jika bukan iOS, paksa tampilkan tombol (meskipun deferredPrompt belum ada).
  // Jika deferredPrompt null saat diklik, kita beri tahu alasannya lewat alert.
  if (!isIOS) {
    return (
      <div className="flex flex-wrap items-center gap-3 bg-secondary-container text-on-secondary-container px-4 py-2 text-label-md font-label-md">
        <span className="material-symbols-outlined">install_mobile</span>
        <span className="flex-1">Install SmartRecall ke perangkat ini supaya lebih cepat dibuka & bisa dipakai offline.</span>
        <button
          onClick={() => {
            if (deferredPrompt) {
              handleInstallClick();
            } else {
              alert('Opsi install otomatis diblokir oleh browser karena koneksi bukan HTTPS/localhost. Sebagai alternatif, ketuk ikon "titik tiga" di pojok kanan atas browser Anda, lalu pilih "Tambahkan ke Layar Utama" (Add to Home Screen).');
            }
          }}
          className="h-9 px-4 rounded-full bg-primary text-on-primary text-label-sm font-label-sm whitespace-nowrap"
        >
          Install App
        </button>
      </div>
    );
  }

  // iOS: tidak ada API untuk trigger otomatis, tampilkan instruksi manual.
  if (isIOS) {
    return (
      <div className="flex flex-col gap-2 bg-secondary-container text-on-secondary-container px-4 py-2 text-label-md font-label-md">
        <div className="flex flex-wrap items-center gap-3">
          <span className="material-symbols-outlined">ios_share</span>
          <span className="flex-1">
            Install SmartRecall: ketuk tombol Share, lalu pilih "Add to Home Screen".
          </span>
          <button
            onClick={() => setShowIOSInstructions((v) => !v)}
            className="h-9 px-4 rounded-full bg-primary text-on-primary text-label-sm font-label-sm whitespace-nowrap"
          >
            {showIOSInstructions ? 'Sembunyikan' : 'Lihat Caranya'}
          </button>
        </div>
        {showIOSInstructions && (
          <ol className="list-decimal list-inside text-label-sm font-label-sm pl-2">
            <li>Buka menu Share di Safari (ikon kotak dengan panah ke atas di bagian bawah layar).</li>
            <li>Gulir dan ketuk "Add to Home Screen".</li>
            <li>Ketuk "Add" di pojok kanan atas.</li>
          </ol>
        )}
      </div>
    );
  }

  return null;
}
