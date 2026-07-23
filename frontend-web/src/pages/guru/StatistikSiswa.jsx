import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../../services/api';
import { formatDateTime } from '../../utils/formatDate';

export default function StatistikSiswa() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get(`/statistik/siswa/${id}`)
      .then(res => {
        setData(res.data);
        setLoading(false);
      })
      .catch(err => {
        setError(err.response?.data?.message || 'Gagal memuat statistik siswa');
        setLoading(false);
      });
  }, [id]);

  if (loading) return <div className="p-8 text-center text-body-md text-on-surface-variant">Memuat detail siswa...</div>;
  if (error) return <div className="p-8 text-center text-error">{error}</div>;
  if (!data) return null;

  const { siswa, flashcardTersedia, flashcardDireview, streak, histogram, overdueCount, kuis } = data;
  
  const lastSync = siswa.lastSyncAt ? new Date(siswa.lastSyncAt) : null;
  const isOldSync = lastSync && (new Date() - lastSync) > 1000 * 60 * 60 * 24 * 2; // Lebih dari 2 hari

  // Kalkulasi persentase flashcard
  const percentageReviewed = flashcardTersedia > 0 ? ((flashcardDireview / flashcardTersedia) * 100).toFixed(1) : 0;

  // Persiapan render histogram
  const totalReviews = Object.values(histogram).reduce((a, b) => a + b, 0);

  return (
    <div className="max-w-5xl mx-auto px-container-padding py-stack-md">
      <Link to="/guru/statistik" className="inline-flex items-center gap-2 text-primary hover:underline text-label-md mb-6">
        <span className="material-symbols-outlined text-[18px]">arrow_back</span>
        Kembali ke Statistik Kelas
      </Link>

      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8 bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant">
        <div>
          <h2 className="text-headline-md text-on-surface font-bold">{siswa.nama}</h2>
          <p className="text-body-md text-on-surface-variant">Analisis Performa Individu</p>
        </div>
        <div className={`flex items-center gap-2 px-4 py-2 rounded-xl ${!lastSync ? 'bg-surface-container text-on-surface-variant' : isOldSync ? 'bg-error/10 text-error' : 'bg-primary/10 text-primary'}`}>
          <span className="material-symbols-outlined">{!lastSync ? 'cloud_off' : isOldSync ? 'cloud_off' : 'cloud_done'}</span>
          <div className="flex flex-col">
            <span className="text-label-sm font-bold uppercase tracking-wider">Status Sinkronisasi</span>
            <span className="text-label-md">{lastSync ? formatDateTime(lastSync) : 'Belum pernah Sync'}</span>
          </div>
        </div>
      </header>

      {isOldSync && (
        <div className="mb-8 bg-error/10 border border-error/20 p-4 rounded-xl flex items-start gap-3 text-error">
          <span className="material-symbols-outlined mt-0.5">warning</span>
          <div>
            <p className="font-bold text-label-md">Data Mungkin Tidak Akurat</p>
            <p className="text-body-sm mt-1">Siswa ini sudah lebih dari 2 hari tidak terhubung ke Local Server Hub. Statistik di bawah ini hanya mencerminkan aktivitas siswa hingga proses sinkronisasi terakhir kali.</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-5 flex flex-col justify-between">
          <div>
            <p className="text-label-md text-on-surface-variant mb-1">Cakupan Flashcard</p>
            <p className="text-headline-lg font-bold text-on-surface">{percentageReviewed}%</p>
            <p className="text-body-sm text-on-surface-variant mt-1">{flashcardDireview} dari {flashcardTersedia} dipelajari</p>
          </div>
          <div className="w-full bg-surface-container rounded-full h-2 mt-4">
            <div className="bg-primary h-2 rounded-full" style={{ width: `${percentageReviewed}%` }}></div>
          </div>
        </div>

        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-5">
          <p className="text-label-md text-on-surface-variant mb-1">Tunggakan Belajar (Overdue)</p>
          <div className="flex items-center gap-3 mt-2">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${overdueCount > 0 ? 'bg-error/10 text-error' : 'bg-primary/10 text-primary'}`}>
              <span className="material-symbols-outlined text-[24px]">{overdueCount > 0 ? 'assignment_late' : 'task_alt'}</span>
            </div>
            <div>
              <p className="text-headline-md font-bold text-on-surface">{overdueCount}</p>
              <p className="text-label-sm text-on-surface-variant">Kartu menumpuk</p>
            </div>
          </div>
        </div>

        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-5">
          <p className="text-label-md text-on-surface-variant mb-1">Aktivitas Terakhir (Streak)</p>
          <p className="text-title-lg font-bold text-on-surface mt-2">{streak ? new Date(streak).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '-'}</p>
          <p className="text-body-sm text-on-surface-variant mt-1">{streak ? new Date(streak).toLocaleTimeString('id-ID') : 'Belum pernah review'}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* Histogram Kualitas */}
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6">
          <h3 className="text-title-md text-on-surface mb-6">Distribusi Pemahaman (Skor 0-5)</h3>
          {totalReviews === 0 ? (
            <p className="text-body-sm text-on-surface-variant text-center py-10">Belum ada data review.</p>
          ) : (
            <div className="flex items-end justify-between h-48 gap-2">
              {[0, 1, 2, 3, 4, 5].map(score => {
                const count = histogram[score] || 0;
                const heightPercentage = totalReviews > 0 ? (count / totalReviews) * 100 : 0;
                
                // Warnai histogram: merah (0-2), kuning (3), hijau (4-5)
                let barColor = 'bg-primary';
                if (score < 3) barColor = 'bg-error';
                else if (score === 3) barColor = 'bg-secondary';

                return (
                  <div key={score} className="flex flex-col items-center justify-end gap-2 flex-1 group h-full">
                    <span className="text-label-sm text-on-surface-variant opacity-0 group-hover:opacity-100 transition-opacity">{count}</span>
                    <div className="w-full flex-1 rounded-t-md relative flex items-end justify-center">
                      <div 
                        className={`w-full rounded-t-md transition-all duration-500 ${barColor}`} 
                        style={{ height: `${heightPercentage}%`, minHeight: count > 0 ? '4px' : '0' }}
                      ></div>
                    </div>
                    <span className="text-label-md font-bold text-on-surface mt-1">{score}</span>
                  </div>
                );
              })}
            </div>
          )}
          <div className="mt-4 pt-4 border-t border-outline-variant flex gap-4 text-[10px] uppercase font-bold text-on-surface-variant">
            <span className="flex items-center gap-1"><div className="w-3 h-3 bg-error rounded-sm"></div>Sulit (0-2)</span>
            <span className="flex items-center gap-1"><div className="w-3 h-3 bg-secondary rounded-sm"></div>Ragu (3)</span>
            <span className="flex items-center gap-1"><div className="w-3 h-3 bg-primary rounded-sm"></div>Mudah (4-5)</span>
          </div>
        </div>

        {/* Riwayat Kuis */}
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 flex flex-col">
          <h3 className="text-title-md text-on-surface mb-4">Riwayat Kuis Terakhir</h3>
          <div className="flex-1 overflow-y-auto pr-2" style={{ maxHeight: '250px' }}>
            {kuis.length === 0 ? (
              <p className="text-body-sm text-on-surface-variant text-center py-10">Belum ada riwayat pengerjaan kuis.</p>
            ) : (
              <div className="space-y-3">
                {kuis.map(k => {
                  const score = (k.skorBenar / k.totalSoal) * 100;
                  return (
                    <div key={k.id} className="p-3 border border-outline-variant rounded-lg flex justify-between items-center hover:bg-surface-container-low transition-colors">
                      <div>
                        <p className="font-semibold text-body-md text-on-surface line-clamp-1">{k.materi?.judul}</p>
                        <p className="text-label-sm text-on-surface-variant mt-1">{formatDateTime(k.submittedAt)}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className={`text-title-md font-bold ${score < 60 ? 'text-error' : 'text-primary'}`}>{score.toFixed(0)}%</p>
                        <p className="text-label-sm text-on-surface-variant">{k.skorBenar} / {k.totalSoal} benar</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
