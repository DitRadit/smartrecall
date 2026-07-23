import { useEffect, useState } from 'react';
import { useAuth } from '../../services/authContext';
import { formatDateTime } from '../../utils/formatDate';
import api from '../../services/api';

export default function DashboardAdmin() {
  const { socket } = useAuth();
  const [data, setData] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/admin/dashboard')
      .then(res => {
        setData(res.data);
        setLoading(false);
      })
      .catch(err => {
        setError(err.response?.data?.message || 'Gagal memuat statistik admin');
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (!socket) return;

    socket.on('onlineUsers', (users) => {
      setOnlineUsers(users);
    });

    socket.on('userConnected', (user) => {
      setOnlineUsers(prev => {
        if (!prev.find(u => u.userId === user.userId)) {
          return [...prev, user];
        }
        return prev;
      });
    });

    socket.on('userDisconnected', ({ userId }) => {
      setOnlineUsers(prev => prev.filter(u => u.userId !== userId));
    });

    return () => {
      socket.off('onlineUsers');
      socket.off('userConnected');
      socket.off('userDisconnected');
    };
  }, [socket]);

  if (loading) return <div className="p-8 text-center text-body-md text-on-surface-variant">Memuat dashboard...</div>;
  if (error) return <div className="p-8 text-center text-error">{error}</div>;
  if (!data) return null;

  return (
    <div className="max-w-7xl mx-auto px-container-padding py-stack-md">
      <h2 className="text-headline-lg text-primary mb-6">Admin Monitoring Dashboard</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-4 flex flex-col gap-1">
          <p className="text-label-md text-on-surface-variant">Pengguna Aktif (24j)</p>
          <p className="text-headline-lg font-bold text-primary">{data.totalActiveUsers}</p>
        </div>
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-4 flex flex-col gap-1">
          <p className="text-label-md text-on-surface-variant">Jumlah Aktivitas (Hari Ini)</p>
          <p className="text-headline-lg font-bold text-on-surface">{data.totalActivitiesToday}</p>
        </div>
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-4 flex flex-col gap-1">
          <p className="text-label-md text-on-surface-variant">Siswa Aktif Belajar</p>
          <p className="text-headline-lg font-bold text-secondary">{data.totalSiswaAktif}</p>
        </div>
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-4 flex flex-col gap-1">
          <p className="text-label-md text-on-surface-variant">Total Guru Aktif</p>
          <p className="text-headline-lg font-bold text-primary">{data.materiPerGuru.length}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <h3 className="text-title-lg text-on-surface mb-4">Aktivitas Terbaru</h3>
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left min-w-[600px]">
                <thead className="bg-surface-container-low border-b border-outline-variant">
                  <tr>
                  <th className="px-6 py-4 text-label-md text-on-surface-variant">Pengguna</th>
                  <th className="px-6 py-4 text-label-md text-on-surface-variant">Aksi</th>
                  <th className="px-6 py-4 text-label-md text-on-surface-variant">Waktu</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant">
                {data.latestActivities.map(act => {
                  const isOnline = onlineUsers.some(ou => ou.userId === act.userId);
                  return (
                    <tr key={act.id} className="hover:bg-surface-container-low transition-colors">
                      <td className="px-6 py-4 font-semibold text-body-md">
                        <div className="flex items-center gap-2">
                          <span className={`w-2.5 h-2.5 rounded-full ${isOnline ? 'bg-green-500' : 'bg-outline-variant'}`} title={isOnline ? 'Online' : 'Offline'}></span>
                          {act.user?.nama || 'Unknown'} 
                          <span className="text-label-sm font-normal px-2 bg-surface-container rounded-full">{act.user?.role}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {act.action === 'LOGIN' || act.action === 'LOGOUT' ? (
                          isOnline ? (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-label-sm bg-green-100 text-green-700 font-medium">
                              <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                              Online
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-label-sm bg-surface-container text-on-surface-variant font-medium">
                              <span className="w-1.5 h-1.5 rounded-full bg-outline-variant"></span>
                              Offline
                            </span>
                          )
                        ) : (
                          <span className="text-body-md font-medium text-primary">{act.action}</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-body-sm text-on-surface-variant">{formatDateTime(act.createdAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          </div>

          <h3 className="text-title-lg text-on-surface mb-4 mt-8">Laporan Guru (Total Materi)</h3>
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left min-w-[600px]">
                <thead className="bg-surface-container-low border-b border-outline-variant">
                  <tr>
                  <th className="px-6 py-4 text-label-md text-on-surface-variant">Nama Guru</th>
                  <th className="px-6 py-4 text-label-md text-on-surface-variant">Status</th>
                  <th className="px-6 py-4 text-label-md text-on-surface-variant">Total Materi Diunggah</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant">
                {data.materiPerGuru.map(g => {
                  const isOnline = onlineUsers.some(ou => ou.userId === g.id);
                  return (
                    <tr key={g.id} className="hover:bg-surface-container-low transition-colors">
                      <td className="px-6 py-4 font-semibold text-body-md">{g.nama}</td>
                      <td className="px-6 py-4 text-body-md">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-label-sm ${isOnline ? 'bg-green-100 text-green-700' : 'bg-surface-container text-on-surface-variant'}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-green-500' : 'bg-outline-variant'}`}></span>
                          {isOnline ? 'Online' : 'Offline'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-body-md">{g.totalMateri} materi</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-title-lg text-on-surface mb-4">Pengguna Sedang Online</h3>
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-4 mb-8">
            <div className="flex items-center gap-3 mb-4">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
              </span>
              <span className="text-label-md font-semibold text-on-surface">{onlineUsers.length} Online Sekarang</span>
            </div>
            
            {onlineUsers.length === 0 ? (
              <p className="text-body-sm text-on-surface-variant">Tidak ada pengguna online selain Anda.</p>
            ) : (
              <ul className="space-y-3">
                {onlineUsers.map(ou => (
                  <li key={ou.userId} className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-secondary-container flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-[16px] text-on-secondary-container">
                        {ou.role === 'guru' ? 'school' : ou.role === 'admin' ? 'admin_panel_settings' : 'person'}
                      </span>
                    </div>
                    <div className="min-w-0 flex-grow">
                      <p className="text-label-md text-on-surface font-semibold truncate">{ou.nama}</p>
                      <p className="text-label-sm text-on-surface-variant">{ou.role}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <h3 className="text-title-lg text-on-surface mb-4">Distribusi Aktivitas</h3>
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6">
            <div className="flex flex-col gap-4">
              <div className="flex justify-between items-center py-2 border-b border-outline-variant/50">
                <span className="text-body-md font-semibold text-on-surface">Guru</span>
                <span className="text-title-md font-bold text-primary">{data.activityDistribution.guru || 0}</span>
              </div>
              
              <div className="flex justify-between items-center py-2 border-b border-outline-variant/50">
                <span className="text-body-md font-semibold text-on-surface">Siswa</span>
                <span className="text-title-md font-bold text-secondary">{data.activityDistribution.siswa || 0}</span>
              </div>

              <div className="flex justify-between items-center py-2">
                <span className="text-body-md font-semibold text-on-surface">Admin</span>
                <span className="text-title-md font-bold text-error">{data.activityDistribution.admin || 0}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
