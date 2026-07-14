import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../../services/api';
import { cacheSoal, getCachedSoal } from '../../offline/indexedDbCache';
import { submitQuizWithFallback } from '../../offline/syncManager';
import OfflineBanner from '../../components/OfflineBanner';

const OPSI_LABELS = ['A', 'B', 'C', 'D'];

/**
 * KerjakanSoal.jsx - Siswa mengerjakan bank soal/kuis dari materi published (FR-13).
 *
 * Menggunakan GET /soal/materi/:id (bukan lagi /materi/:id/draft yang
 * role-restricted guru -- sebelumnya siswa selalu mendapat 403 di sini).
 * Skor dihitung & divalidasi di server saat submit (POST /soal/submit),
 * bukan hanya di klien, dan hasilnya persisten (QuizAttempt) alih-alih
 * hilang saat halaman di-refresh. Sesuai ARCHITECTURE.md 3.2, submit hasil
 * kuis tetap tersimpan lewat offline queue jika koneksi terputus.
 */
export default function KerjakanSoal() {
  const { id: materiId } = useParams();
  const [judul, setJudul] = useState('');
  const [soalList, setSoalList] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [jawabanTerpilih, setJawabanTerpilih] = useState({});
  const [hasil, setHasil] = useState(null); // { skor_benar, total_soal } setelah submit
  const [isOffline, setIsOffline] = useState(false);
  const [submitMessage, setSubmitMessage] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadSoal();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [materiId]);

  async function loadSoal() {
    try {
      const res = await api.get(`/soal/materi/${materiId}`);
      setJudul(res.data.judul);
      setSoalList(res.data.soal);
      setIsOffline(false);
      await cacheSoal(Number(materiId), { judul: res.data.judul, soal: res.data.soal });
    } catch (err) {
      const cached = await getCachedSoal(Number(materiId));
      if (cached) {
        setJudul(cached.judul);
        setSoalList(cached.soal);
        setIsOffline(true);
      } else {
        setError('Soal belum tersedia offline. Sambungkan ke Local Server Hub minimal sekali untuk mengunduh soal ini.');
      }
    }
  }

  function pilihJawaban(soalId, label) {
    setJawabanTerpilih((prev) => ({ ...prev, [soalId]: label }));
  }

  async function handleSelesai() {
    setSubmitting(true);
    const jawaban = soalList.map((soal) => ({
      soal_id: soal.id,
      jawaban_dipilih: jawabanTerpilih[soal.id] ?? null,
    }));

    try {
      const result = await submitQuizWithFallback({ materi_id: Number(materiId), jawaban });

      if (result.synced) {
        setHasil({ skor_benar: result.data.skor_benar, total_soal: result.data.total_soal });
        setSubmitMessage('Hasil kuis tersimpan.');
      } else {
        setSubmitMessage(
          'Koneksi terputus — jawaban kamu disimpan di antrian lokal dan akan otomatis dinilai saat koneksi ke Local Server Hub kembali.'
        );
        setHasil({ pending: true });
      }
    } catch (err) {
      setError('Gagal mengirim jawaban. Silakan coba lagi.');
    } finally {
      setSubmitting(false);
    }
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-container-padding">
        <p className="error-text text-center">{error}</p>
      </div>
    );
  }

  if (hasil) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-container-padding text-center">
        <span className="material-symbols-outlined text-[56px] text-on-tertiary-container mb-3">check_circle</span>
        <h2 className="text-headline-lg-mobile text-primary mb-2">Hasil Kuis</h2>
        {hasil.pending ? (
          <p className="hint-text max-w-sm">{submitMessage}</p>
        ) : (
          <>
            <p className="text-headline-md text-on-surface">
              Skor kamu: {hasil.skor_benar} / {hasil.total_soal}
            </p>
            <p className="hint-text mt-2">{submitMessage}</p>
          </>
        )}
      </div>
    );
  }

  const soal = soalList[currentIndex];
  const progressPct = soalList.length ? Math.round(((currentIndex + 1) / soalList.length) * 100) : 0;

  return (
    <div className="min-h-screen bg-background">
      {isOffline && <OfflineBanner>Offline Mode</OfflineBanner>}

      <div className="px-container-padding pt-gutter pb-8 max-w-xl mx-auto">
        <h2 className="text-headline-md text-primary mb-4">{judul || 'Kerjakan Soal'}</h2>

        {soalList.length === 0 && <p className="text-body-md text-on-surface-variant">Belum ada soal untuk materi ini.</p>}

        {soal && (
          <>
            <div className="flex justify-between items-baseline mb-2">
              <span className="text-label-md text-on-surface-variant">
                Soal {currentIndex + 1} dari {soalList.length}
              </span>
              <span className="text-label-md font-bold text-primary">{progressPct}% Selesai</span>
            </div>
            <div className="w-full bg-surface-container h-2 rounded-full overflow-hidden mb-6">
              <div className="bg-primary h-full rounded-full transition-all" style={{ width: `${progressPct}%` }} />
            </div>

            <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 mb-4">
              <h3 className="text-headline-md text-primary">{soal.pertanyaan}</h3>
            </div>

            <div className="space-y-3">
              {soal.opsi_jawaban.map((o, i) => {
                const label = OPSI_LABELS[i];
                const selected = jawabanTerpilih[soal.id] === label;
                return (
                  <button
                    key={i}
                    onClick={() => pilihJawaban(soal.id, label)}
                    className={`w-full flex items-center gap-3 border rounded-xl p-4 text-left transition-colors ${
                      selected ? 'border-primary bg-primary-fixed/20' : 'border-outline-variant'
                    }`}
                  >
                    <span
                      className={`w-5 h-5 rounded-full border-2 flex-shrink-0 ${
                        selected ? 'border-primary bg-primary' : 'border-outline'
                      }`}
                    />
                    <span className="text-body-md text-on-surface">{o}</span>
                  </button>
                );
              })}
            </div>

            <div className="mt-6 flex justify-between gap-3">
              <button
                onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
                disabled={currentIndex === 0}
                className="h-touch-target-min px-6 rounded-xl border border-outline-variant text-label-md text-on-surface-variant disabled:opacity-40"
              >
                Sebelumnya
              </button>
              {currentIndex + 1 < soalList.length ? (
                <button
                  onClick={() => setCurrentIndex((i) => i + 1)}
                  className="flex-1 h-touch-target-min bg-secondary-container text-on-secondary-container rounded-xl text-label-md flex items-center justify-center gap-2"
                >
                  Selanjutnya
                  <span className="material-symbols-outlined">chevron_right</span>
                </button>
              ) : (
                <button
                  onClick={handleSelesai}
                  disabled={submitting}
                  className="flex-1 h-touch-target-min bg-secondary-container text-on-secondary-container rounded-xl text-label-md flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {submitting ? 'Mengirim...' : 'Selesai'}
                  {!submitting && <span className="material-symbols-outlined">chevron_right</span>}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}