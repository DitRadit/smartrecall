import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';

export default function StatistikKelas() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/statistik/kelas')
      .then(res => {
        setData(res.data);
        setLoading(false);
      })
      .catch(err => {
        setError(err.response?.data?.message || 'Gagal memuat statistik kelas');
        setLoading(false);
      });
  }, []);

  if (loading) return <div className="p-8 text-center text-body-md text-on-surface-variant">Memuat statistik...</div>;
  if (error) return <div className="p-8 text-center text-error">{error}</div>;
  if (!data) return null;

  return (
    <div className="max-w-7xl mx-auto px-container-padding py-stack-md">
      <h2 className="text-headline-lg text-primary mb-6">Statistik Kelas & Performa</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-4 flex flex-col gap-1">
          <p className="text-label-md text-on-surface-variant">Siswa Terdaftar</p>
          <p className="text-headline-lg font-bold text-primary">{data.totalSiswa}</p>
        </div>
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-4 flex flex-col gap-1">
          <p className="text-label-md text-on-surface-variant">Materi (Draft)</p>
          <p className="text-headline-lg font-bold text-on-surface">{data.progressPublikasi.draft}</p>
        </div>
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-4 flex flex-col gap-1">
          <p className="text-label-md text-on-surface-variant">Materi (Published)</p>
          <p className="text-headline-lg font-bold text-secondary">{data.progressPublikasi.published}</p>
        </div>
      </div>

      <h3 className="text-title-lg text-on-surface mb-4">Performa per Materi</h3>
      <div className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden mb-8">
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[800px]">
            <thead className="bg-surface-container-low border-b border-outline-variant">
              <tr>
                <th className="px-6 py-4 text-label-md text-on-surface-variant">Materi</th>
                <th className="px-6 py-4 text-label-md text-on-surface-variant">Partisipasi Siswa</th>
                <th className="px-6 py-4 text-label-md text-on-surface-variant">Skor Kualitas (SM-2)</th>
                <th className="px-6 py-4 text-label-md text-on-surface-variant">Rata-rata Kuis</th>
                <th className="px-6 py-4 text-label-md text-on-surface-variant">Konsep Tersulit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant">
              {data.performaMateri.map(m => (
                <tr key={m.id} className="hover:bg-surface-container-low transition-colors">
                  <td className="px-6 py-4">
                    <p className="font-semibold text-body-md text-on-surface mb-1">{m.judul}</p>
                    <span className="text-[10px] uppercase font-bold tracking-wider bg-surface-container px-2 py-1 rounded-full text-on-surface-variant">
                      {m.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-body-md">{m.partisipasiSiswa} <span className="text-on-surface-variant">/ {data.totalSiswa} siswa</span></p>
                    <div className="w-full bg-surface-container rounded-full h-1.5 mt-2">
                      <div className="bg-primary h-1.5 rounded-full" style={{ width: `${m.persentasePartisipasi}%` }}></div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`text-title-md font-bold ${m.rataRataSkorKualitas < 2.5 && m.rataRataSkorKualitas > 0 ? 'text-error' : 'text-primary'}`}>
                      {m.rataRataSkorKualitas > 0 ? m.rataRataSkorKualitas.toFixed(1) : '-'}
                    </span>
                    <span className="text-label-sm text-on-surface-variant ml-1">/ 5.0</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-title-md font-bold text-on-surface">{m.rataRataKuis > 0 ? m.rataRataKuis.toFixed(1) + '%' : '-'}</span>
                  </td>
                  <td className="px-6 py-4">
                    {m.flashcardTersulit ? (
                      <div className="max-w-[250px]">
                        <p className="text-error font-semibold text-[11px] mb-1 flex items-center gap-1 uppercase tracking-wider">
                          <span className="material-symbols-outlined text-[14px]">warning</span>
                          {m.flashcardTersulit.salahCount}x dijawab sulit
                        </p>
                        <p className="text-body-sm text-on-surface line-clamp-2" title={m.flashcardTersulit.pertanyaan}>
                          {m.flashcardTersulit.pertanyaan}
                        </p>
                      </div>
                    ) : (
                      <span className="text-label-sm text-on-surface-variant">-</span>
                    )}
                  </td>
                </tr>
              ))}
              {data.performaMateri.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-body-md text-on-surface-variant">Belum ada materi untuk dianalisis.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <h3 className="text-title-lg text-on-surface mb-4">Daftar Siswa (Drill-down)</h3>
      <div className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-surface-container-low border-b border-outline-variant">
            <tr>
              <th className="px-6 py-4 text-label-md text-on-surface-variant">Nama Siswa</th>
              <th className="px-6 py-4 text-label-md text-on-surface-variant">Username</th>
              <th className="px-6 py-4 text-label-md text-on-surface-variant">Status Sinkronisasi Terakhir</th>
              <th className="px-6 py-4 text-label-md text-on-surface-variant text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant">
            {data.daftarSiswa.map(s => {
              const lastSync = s.lastSyncAt ? new Date(s.lastSyncAt) : null;
              const isOld = lastSync && (new Date() - lastSync) > 1000 * 60 * 60 * 24 * 2; // Lebih dari 2 hari
              return (
                <tr key={s.id} className="hover:bg-surface-container-low transition-colors">
                  <td className="px-6 py-4 font-semibold text-body-md">{s.nama}</td>
                  <td className="px-6 py-4 text-body-md text-on-surface-variant">@{s.username}</td>
                  <td className="px-6 py-4">
                    {lastSync ? (
                      <span className={`text-label-md flex items-center gap-1.5 ${isOld ? 'text-error bg-error/10 px-3 py-1 rounded-full w-fit' : 'text-primary bg-primary/10 px-3 py-1 rounded-full w-fit'}`}>
                        <span className="material-symbols-outlined text-[16px]">{isOld ? 'cloud_off' : 'cloud_done'}</span>
                        {lastSync.toLocaleString('id-ID')}
                        {isOld && <span className="font-bold ml-1">(Data usang)</span>}
                      </span>
                    ) : (
                      <span className="text-label-md text-on-surface-variant bg-surface-container px-3 py-1 rounded-full w-fit flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[16px]">cloud_off</span>
                        Belum pernah Sync
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Link to={`/guru/statistik/siswa/${s.id}`} className="text-primary hover:underline text-label-md font-semibold inline-flex items-center gap-1">
                      Analisis Detail
                      <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                    </Link>
                  </td>
                </tr>
              );
            })}
            {data.daftarSiswa.length === 0 && (
              <tr>
                <td colSpan={4} className="px-6 py-8 text-center text-body-md text-on-surface-variant">Belum ada siswa terdaftar.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
