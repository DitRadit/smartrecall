import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import { useAuth } from '../../services/authContext';
import { cacheMateriList, getCachedMateriList } from '../../offline/indexedDbCache';
import { downloadMateriForOffline, getMateriOfflineStatus } from '../../offline/prefetchMateri';
import OfflineBanner from '../../components/OfflineBanner';

/**
 * DaftarMateri.jsx - Siswa melihat daftar materi published (FR-10).
 * Offline-first: coba fetch dari backend-api, fallback ke cache IndexedDB
 * jika koneksi ke Local Server Hub sedang terputus (FR-14).
 */

// Variasi warna kartu (mengikuti pola desain Stitch: primary/tertiary/secondary/surface-dim
// bergantian per kartu), dan tidak bergantung pada field kategori mata pelajaran yang
// belum ada di data model saat ini.
const CARD_STYLES = [
  { bg: 'bg-primary-container', fg: 'text-on-primary' },
  { bg: 'bg-tertiary-container', fg: 'text-on-tertiary-container' },
  { bg: 'bg-secondary-container', fg: 'text-on-secondary-container' },
  { bg: 'bg-surface-dim', fg: 'text-primary' },
];

export default function DaftarMateri() {
  const { user } = useAuth();
  const [groupList, setGroupList] = useState([]);
  const [materiList, setMateriList] = useState([]);
  const [currentParentId, setCurrentParentId] = useState(null);
  const [breadcrumb, setBreadcrumb] = useState([]);
  const [isOffline, setIsOffline] = useState(false);
  // offlineStatus[materiId] = { rangkuman, flashcard, soal } (Boolean tiap jenis)
  const [offlineStatus, setOfflineStatus] = useState({});
  // downloadingId = materi yang sedang diunduh (disable tombol + tampilkan progres)
  const [downloadingId, setDownloadingId] = useState(null);

  useEffect(() => {
    loadMateri();
  }, []);

  async function loadMateri(parentId = null) {
    try {
      const query = parentId ? `?parentId=${parentId}` : '';
      const response = await api.get(`/groups${query}`);
      const visibleMateri = response.data.materi || [];
      setGroupList(response.data.groups || []);
      setMateriList(visibleMateri);
      setCurrentParentId(parentId);
      setIsOffline(false);

      const allMateriResponse = await api.get('/materi');
      await cacheMateriList(allMateriResponse.data.materi || []); // refresh cache, source of truth tetap backend-api
      await refreshOfflineStatus(visibleMateri);
    } catch (err) {
      // Gagal terhubung ke backend-api -> tampilkan data dari cache (bukan source of truth,
      // hanya untuk memastikan siswa tetap bisa lanjut belajar, ARCHITECTURE.md prinsip #2).
      const cached = await getCachedMateriList();
      setGroupList([]);
      setMateriList(cached);
      setCurrentParentId(null);
      setBreadcrumb([]);
      setIsOffline(true);
      await refreshOfflineStatus(cached);
    }
  }

  // Cek status "sudah tersimpan offline atau belum" untuk tiap materi, supaya
  // badge di kartu langsung akurat tanpa perlu klik Download dulu.
  async function refreshOfflineStatus(list) {
    const entries = await Promise.all(
      list.map(async (m) => [m.id, await getMateriOfflineStatus(m.id)]),
    );
    setOfflineStatus(Object.fromEntries(entries));
  }

  async function handleDownload(materiId) {
    if (!user) return;
    setDownloadingId(materiId);
    try {
      await downloadMateriForOffline(materiId, user.id);
    } finally {
      const status = await getMateriOfflineStatus(materiId);
      setOfflineStatus((prev) => ({ ...prev, [materiId]: status }));
      setDownloadingId(null);
    }
  }

  function handleNavigateFolder(group) {
    setBreadcrumb((prev) => [...prev, { id: group.id, nama: group.nama }]);
    loadMateri(group.id);
  }

  function handleNavigateBreadcrumb(index) {
    if (index === -1) {
      setBreadcrumb([]);
      loadMateri(null);
      return;
    }

    const nextBreadcrumb = breadcrumb.slice(0, index + 1);
    setBreadcrumb(nextBreadcrumb);
    loadMateri(nextBreadcrumb[index].id);
  }

  function handleBack() {
    if (breadcrumb.length <= 1) {
      setBreadcrumb([]);
      loadMateri(null);
      return;
    }

    const nextBreadcrumb = breadcrumb.slice(0, -1);
    setBreadcrumb(nextBreadcrumb);
    loadMateri(nextBreadcrumb[nextBreadcrumb.length - 1].id);
  }

  return (
    <div className="min-h-screen bg-background">
      {isOffline && <OfflineBanner>Sedang offline — menampilkan data tersimpan</OfflineBanner>}

      <div className="px-container-padding pt-gutter pb-8 space-y-gutter max-w-3xl mx-auto">
        <div className="py-2">
          <h2 className="text-headline-lg-mobile text-on-surface">Materi Saya</h2>
          <p className="text-body-md text-on-surface-variant mt-1">Daftar pelajaran yang tersedia untuk dipelajari.</p>
        </div>

        {!isOffline && (
          <div className="space-y-3">
            {currentParentId && (
              <button
                type="button"
                onClick={handleBack}
                className="inline-flex items-center gap-2 h-10 px-4 rounded-lg border border-outline-variant text-label-md text-primary hover:bg-surface-container"
              >
                <span className="material-symbols-outlined text-[20px]">arrow_back</span>
                Kembali
              </button>
            )}

            <div className="flex flex-wrap items-center gap-2 text-label-md text-on-surface-variant">
              <button
                type="button"
                onClick={() => handleNavigateBreadcrumb(-1)}
                className={`inline-flex items-center gap-1 hover:text-primary ${currentParentId ? '' : 'text-primary font-semibold'}`}
              >
                <span className="material-symbols-outlined text-[18px]">home</span>
                Beranda
              </button>
              {breadcrumb.map((item, index) => (
                <span key={item.id} className="inline-flex items-center gap-2">
                  <span className="material-symbols-outlined text-[16px]">chevron_right</span>
                  <button
                    type="button"
                    onClick={() => handleNavigateBreadcrumb(index)}
                    className={`hover:text-primary ${index === breadcrumb.length - 1 ? 'text-primary font-semibold' : ''}`}
                  >
                    {item.nama}
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}

        {groupList.length === 0 && materiList.length === 0 && (
          <p className="text-body-md text-on-surface-variant">Belum ada materi yang tersedia.</p>
        )}

        <div className="space-y-4">
          {groupList.map((g) => (
            <button
              key={`group-${g.id}`}
              type="button"
              onClick={() => handleNavigateFolder(g)}
              className="w-full text-left bg-surface-container-lowest border border-outline-variant rounded-xl p-gutter hover:bg-surface-container-low transition-colors"
            >
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-lg bg-secondary-container flex items-center justify-center flex-shrink-0">
                  <span className="material-symbols-outlined text-[32px] text-on-secondary-container">folder</span>
                </div>
                <div className="flex-grow min-w-0">
                  <h3 className="text-headline-md text-primary truncate">{g.nama}</h3>
                  <span className="mt-1 inline-flex items-center gap-1 text-label-sm text-on-surface-variant">
                    <span className="material-symbols-outlined text-[16px]">folder_open</span>
                    Buka folder
                  </span>
                </div>
                <span className="material-symbols-outlined text-on-surface-variant">chevron_right</span>
              </div>
            </button>
          ))}

          {materiList.map((m, i) => {
            const style = CARD_STYLES[i % CARD_STYLES.length];
            return (
              <div
                key={m.id}
                className="bg-surface-container-lowest border border-outline-variant rounded-xl p-gutter border-t-4 border-t-secondary-container"
              >
                <div className="flex items-start gap-4">
                  <div className={`w-14 h-14 rounded-lg ${style.bg} flex items-center justify-center flex-shrink-0`}>
                    <span className={`material-symbols-outlined text-[32px] ${style.fg}`}>menu_book</span>
                  </div>
                  <div className="flex-grow min-w-0">
                    <h3 className="text-headline-md text-primary truncate">{m.judul}</h3>
                    {(() => {
                      const status = offlineStatus[m.id] || { rangkuman: false, flashcard: false, soal: false };
                      const lengkap = status.rangkuman && status.flashcard && status.soal;
                      const adaSebagian = status.rangkuman || status.flashcard || status.soal;

                      if (lengkap) {
                        return (
                          <span className="mt-1 inline-flex items-center gap-1 text-label-sm text-on-tertiary-container">
                            <span className="material-symbols-outlined text-[16px]">offline_pin</span>
                            Tersedia offline
                          </span>
                        );
                      }
                      if (!adaSebagian) {
                        return (
                          <span className="mt-1 inline-flex items-center gap-1 text-label-sm text-on-surface-variant">
                            <span className="material-symbols-outlined text-[16px]">cloud_off</span>
                            Belum diunduh
                          </span>
                        );
                      }
                      // Sebagian: rinci per jenis konten supaya siswa tahu persis apa yang
                      // masih perlu diunduh ulang, bukan cuma label "sebagian" yang ambigu.
                      return (
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-label-sm text-on-surface-variant">
                          <span className={`inline-flex items-center gap-1 ${status.rangkuman ? 'text-on-tertiary-container' : ''}`}>
                            <span className="material-symbols-outlined text-[14px]">
                              {status.rangkuman ? 'check_circle' : 'cancel'}
                            </span>
                            Rangkuman
                          </span>
                          <span className={`inline-flex items-center gap-1 ${status.flashcard ? 'text-on-tertiary-container' : ''}`}>
                            <span className="material-symbols-outlined text-[14px]">
                              {status.flashcard ? 'check_circle' : 'cancel'}
                            </span>
                            Flashcard
                          </span>
                          <span className={`inline-flex items-center gap-1 ${status.soal ? 'text-on-tertiary-container' : ''}`}>
                            <span className="material-symbols-outlined text-[14px]">
                              {status.soal ? 'check_circle' : 'cancel'}
                            </span>
                            Kuis
                          </span>
                        </div>
                      );
                    })()}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDownload(m.id)}
                    disabled={downloadingId === m.id}
                    title="Unduh rangkuman, flashcard & kuis untuk dipakai offline"
                    className="flex items-center gap-1 h-9 px-3 rounded-full border border-outline-variant text-label-sm text-primary hover:bg-surface-container disabled:opacity-50 shrink-0"
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      {downloadingId === m.id ? 'sync' : 'download'}
                    </span>
                    {downloadingId === m.id ? 'Mengunduh...' : 'Download'}
                  </button>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link
                    to={`/siswa/rangkuman/${m.id}`}
                    className="flex items-center gap-1 h-9 px-4 rounded-full border border-outline-variant text-label-sm text-on-surface-variant hover:bg-surface-container"
                  >
                    <span className="material-symbols-outlined text-[18px]">description</span>
                    Rangkuman
                  </Link>
                  <Link
                    to={`/siswa/review/${m.id}`}
                    className="flex items-center gap-1 h-9 px-4 rounded-full border border-outline-variant text-label-sm text-on-surface-variant hover:bg-surface-container"
                  >
                    <span className="material-symbols-outlined text-[18px]">style</span>
                    Flashcard
                  </Link>
                  <Link
                    to={`/siswa/soal/${m.id}`}
                    className="flex items-center gap-1 h-9 px-4 rounded-full border border-outline-variant text-label-sm text-on-surface-variant hover:bg-surface-container"
                  >
                    <span className="material-symbols-outlined text-[18px]">quiz</span>
                    Kuis
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
