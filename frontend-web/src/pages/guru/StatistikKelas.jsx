import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import { useAuth } from '../../services/authContext';
import { formatDateTime } from '../../utils/formatDate';

export default function StatistikKelas() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [filterKelas, setFilterKelas] = useState('all');
  const [filterPrioritas, setFilterPrioritas] = useState('all');
  const [sortMateri, setSortMateri] = useState('partisipasi_desc');
  const [sortSiswa, setSortSiswa] = useState('nama_asc');

  useEffect(() => {
    setLoading(true);
    api.get(`/statistik/kelas?kelasId=${filterKelas}`)
      .then(res => {
        setData(res.data);
        setLoading(false);
      })
      .catch(err => {
        setError(err.response?.data?.message || 'Gagal memuat statistik kelas');
        setLoading(false);
      });
  }, [filterKelas]);

  if (loading) return <div className="p-8 text-center text-body-md text-on-surface-variant">Memuat statistik...</div>;
  if (error) return <div className="p-8 text-center text-error">{error}</div>;
  if (!data) return null;

  const kelasOptions = data.daftarKelas || [];

  const filteredMateri = [...data.performaMateri].sort((a, b) => {
    if (sortMateri === 'partisipasi_desc') return b.partisipasiSiswa - a.partisipasiSiswa;
    if (sortMateri === 'skor_desc') return b.rataRataSkorKualitas - a.rataRataSkorKualitas;
    if (sortMateri === 'kuis_desc') return b.rataRataKuis - a.rataRataKuis;
    return 0;
  });

  const filteredSiswa = [...data.daftarSiswa]
    .filter(s => {
      if (filterPrioritas === 'all') return true;
      const studentLogs = data.actionLog.filter(l => l.namaItem === s.nama);
      return studentLogs.some(l => l.prioritas === filterPrioritas);
    })
    .sort((a, b) => {
      if (sortSiswa === 'nama_asc') return a.nama.localeCompare(b.nama);
      if (sortSiswa === 'nama_desc') return b.nama.localeCompare(a.nama);
      
      const timeA = a.lastSyncAt ? new Date(a.lastSyncAt).getTime() : 0;
      const timeB = b.lastSyncAt ? new Date(b.lastSyncAt).getTime() : 0;
      if (sortSiswa === 'status_terbaru') return timeB - timeA;
      if (sortSiswa === 'status_lama') return timeA - timeB;
      
      return 0;
    });

  const materiWithSkor = data.performaMateri.filter(m => m.rataRataSkorKualitas > 0);
  const rataRataKeseluruhan = materiWithSkor.length > 0
    ? (materiWithSkor.reduce((acc, curr) => acc + curr.rataRataSkorKualitas, 0) / materiWithSkor.length).toFixed(1)
    : '-';
    
  const siswaPerluPerhatianCount = new Set(data.actionLog.map(l => l.namaItem)).size;

  return (
    <div className="max-w-7xl mx-auto px-container-padding py-stack-md">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
        <h2 className="text-headline-lg text-primary">Statistik Kelas & Performa</h2>
        
        {/* Global Filters */}
        <div className="flex flex-wrap items-center gap-3 bg-surface-container-low p-2 rounded-xl border border-outline-variant">
          <div className="flex items-center gap-2 relative">
            <span className="material-symbols-outlined text-on-surface-variant text-[20px] pl-2">filter_list</span>
            <div className="relative inline-flex items-center">
              <select 
                value={filterKelas} 
                onChange={e => setFilterKelas(e.target.value)}
                className="appearance-none bg-surface-container-lowest text-on-surface text-label-md pl-3 pr-9 py-1.5 rounded-lg border border-outline-variant focus:border-primary focus:ring-1 focus:ring-primary outline-none min-w-[140px] cursor-pointer"
              >
                <option value="all">Semua Kelas</option>
                {kelasOptions.map(k => (
                  <option key={k.id} value={k.id}>{k.nama}</option>
                ))}
              </select>
              <span className="material-symbols-outlined absolute right-2 text-on-surface-variant pointer-events-none text-[20px]">expand_more</span>
            </div>
          </div>
        </div>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-4 flex flex-col gap-1">
          <p className="text-label-md text-on-surface-variant">Siswa Terdaftar</p>
          <p className="text-headline-lg font-bold text-primary">{data.totalSiswa}</p>
        </div>
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-4 flex flex-col gap-1">
          <p className="text-label-md text-on-surface-variant">Siswa Perlu Perhatian</p>
          <p className="text-headline-lg font-bold text-error">{siswaPerluPerhatianCount}</p>
        </div>
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-4 flex flex-col gap-1">
          <p className="text-label-md text-on-surface-variant">Skor Kualitas (Rata-rata)</p>
          <p className="text-headline-lg font-bold text-secondary">
            {rataRataKeseluruhan} <span className="text-title-md font-normal text-on-surface-variant">/ 5.0</span>
          </p>
        </div>
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-4 flex flex-col gap-1">
          <p className="text-label-md text-on-surface-variant">Materi (Published / Draft)</p>
          <p className="text-headline-lg font-bold text-on-surface">
            {data.progressPublikasi.published} <span className="text-title-md font-normal text-on-surface-variant">/ {data.progressPublikasi.draft}</span>
          </p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
        <h3 className="text-title-lg text-on-surface">Performa per Materi</h3>
        <div className="relative inline-flex items-center">
          <select 
            value={sortMateri} 
            onChange={e => setSortMateri(e.target.value)}
            className="appearance-none bg-surface-container-lowest text-on-surface text-label-md pl-3 pr-9 py-1.5 rounded-lg border border-outline-variant focus:border-primary focus:ring-1 focus:ring-primary outline-none min-w-[160px] cursor-pointer"
          >
            <option value="partisipasi_desc">Partisipasi Tertinggi</option>
            <option value="skor_desc">Skor SM-2 Tertinggi</option>
            <option value="kuis_desc">Skor Kuis Tertinggi</option>
          </select>
          <span className="material-symbols-outlined absolute right-2 text-on-surface-variant pointer-events-none text-[20px]">sort</span>
        </div>
      </div>
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
              {filteredMateri.map(m => (
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
              {filteredMateri.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-body-md text-on-surface-variant">Belum ada materi untuk dianalisis.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
        <h3 className="text-title-lg text-on-surface">Daftar Siswa & Tindak Lanjut</h3>
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative inline-flex items-center">
            <select 
              value={filterPrioritas} 
              onChange={e => setFilterPrioritas(e.target.value)}
              className="appearance-none bg-surface-container-lowest text-on-surface text-label-md pl-3 pr-9 py-1.5 rounded-lg border border-outline-variant focus:border-primary focus:ring-1 focus:ring-primary outline-none min-w-[150px] cursor-pointer"
            >
              <option value="all">Semua Status</option>
              <option value="Tinggi">Butuh Perhatian</option>
              <option value="Sedang">Sedang Dipantau</option>
            </select>
            <span className="material-symbols-outlined absolute right-2 text-on-surface-variant pointer-events-none text-[20px]">filter_list</span>
          </div>
          <div className="relative inline-flex items-center">
            <select 
              value={sortSiswa} 
              onChange={e => setSortSiswa(e.target.value)}
              className="appearance-none bg-surface-container-lowest text-on-surface text-label-md pl-3 pr-9 py-1.5 rounded-lg border border-outline-variant focus:border-primary focus:ring-1 focus:ring-primary outline-none min-w-[160px] cursor-pointer"
            >
              <option value="nama_asc">Nama (A-Z)</option>
              <option value="nama_desc">Nama (Z-A)</option>
              <option value="status_terbaru">Aktivitas Terbaru</option>
              <option value="status_lama">Aktivitas Terlama</option>
            </select>
            <span className="material-symbols-outlined absolute right-2 text-on-surface-variant pointer-events-none text-[20px]">sort</span>
          </div>
        </div>
      </div>
      <div className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[600px]">
            <thead className="bg-surface-container-low border-b border-outline-variant">
              <tr>
              <th className="px-6 py-4 text-label-md text-on-surface-variant">Nama Siswa</th>
              <th className="px-6 py-4 text-label-md text-on-surface-variant">Tindak Lanjut / Status</th>
              <th className="px-6 py-4 text-label-md text-on-surface-variant">Status Sinkronisasi Terakhir</th>
              <th className="px-6 py-4 text-label-md text-on-surface-variant text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant">
            {filteredSiswa.map(s => {
              const lastSync = s.lastSyncAt ? new Date(s.lastSyncAt) : null;
              const isOld = lastSync && (new Date() - lastSync) > 1000 * 60 * 60 * 24 * 2; // Lebih dari 2 hari
              const studentLogs = data.actionLog.filter(l => l.namaItem === s.nama);
              return (
                <tr key={s.id} className="hover:bg-surface-container-low transition-colors">
                  <td className="px-6 py-4 font-semibold text-body-md">
                    {s.nama}
                    <div className="text-label-sm text-on-surface-variant font-normal mt-0.5">@{s.username} &middot; {s.kelas?.nama || 'Tanpa Kelas'}</div>
                  </td>
                  <td className="px-6 py-4">
                    {studentLogs.length > 0 ? (
                      <div className="flex flex-col gap-3">
                        {studentLogs.map((log, idx) => (
                          <div key={idx} className="flex flex-col items-start">
                            <span className={`text-label-md font-bold px-3 py-1 rounded-full ${log.status === 'Butuh Perhatian' ? 'bg-error-container text-on-error-container border border-error/20' : 'bg-tertiary-container text-on-tertiary-container border border-tertiary/20'}`}>
                              {log.status}
                            </span>
                            <span className="text-label-sm text-on-surface-variant mt-1.5">{log.kategori}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="text-label-md text-on-surface-variant bg-surface-container px-3 py-1 rounded-full w-fit">
                        Aman (Tidak Ada Isu)
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {lastSync ? (
                      <span className={`text-label-md flex items-center gap-1.5 ${isOld ? 'text-error bg-error/10 px-3 py-1 rounded-full w-fit' : 'text-primary bg-primary/10 px-3 py-1 rounded-full w-fit'}`}>
                        <span className="material-symbols-outlined text-[16px]">{isOld ? 'cloud_off' : 'cloud_done'}</span>
                        {formatDateTime(lastSync)}
                        {isOld && <span className="font-bold ml-1">(Data usang)</span>}
                      </span>
                    ) : (
                      <span className="text-label-md text-on-surface-variant bg-surface-container px-3 py-1 rounded-full w-fit flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[16px]">cloud_off</span>
                        Belum pernah Sync
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right align-top pt-5">
                    <Link to={`/guru/statistik/siswa/${s.id}`} className="text-primary hover:underline text-label-md font-semibold inline-flex items-center gap-1">
                      Analisis Detail
                      <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                    </Link>
                  </td>
                </tr>
              );
            })}
            {filteredSiswa.length === 0 && (
              <tr>
                <td colSpan={4} className="px-6 py-8 text-center text-body-md text-on-surface-variant">Tidak ada siswa yang sesuai kriteria.</td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}
