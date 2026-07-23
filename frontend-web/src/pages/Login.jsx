import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../services/authContext';

/**
 * Login.jsx - Halaman login guru/siswa (FR-1, FR-9).
 * UI sengaja sederhana: tombol besar, alur linear (NFR: Usability, PRD.md bagian 8).
 */
export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const user = await login(username, password);
      if (user.role === 'admin') {
        navigate('/admin/dashboard', { replace: true });
      } else {
        navigate(user.role === 'guru' ? '/guru/dashboard' : '/siswa/materi', { replace: true });
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Login gagal. Periksa username/password.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-background px-container-padding">
      <main className="w-full max-w-[400px] flex flex-col items-center">
        <div className="mb-stack-lg text-center flex flex-col items-center">
          <div className="w-20 h-20 bg-primary flex items-center justify-center rounded-[24px] mb-stack-sm shadow-sm">
            <span className="material-symbols-outlined text-[48px] text-on-primary">school</span>
          </div>
          <h1 className="text-headline-lg-mobile text-primary tracking-tight">SmartRecall</h1>
          <p className="text-body-md text-on-surface-variant max-w-[280px] leading-tight mt-1">
            Belajar Kapan Saja, Di Mana Saja Tanpa Internet
          </p>
        </div>

        <div className="w-full bg-surface-container-lowest border border-outline-variant rounded-xl p-6 shadow-sm">
          <form onSubmit={handleSubmit} className="flex flex-col gap-base">
            <div className="flex flex-col gap-1">
              <label className="text-label-md text-on-surface px-1" htmlFor="username">
                Nama Pengguna
              </label>
              <div className="relative flex items-center">
                <span className="material-symbols-outlined absolute left-4 text-outline">person</span>
                <input
                  id="username"
                  className="w-full h-touch-target-min pl-12 pr-4 border border-outline rounded-lg bg-surface focus:border-primary focus:ring-1 focus:ring-primary transition-all text-body-md outline-none"
                  placeholder="Masukkan nama pengguna"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="flex flex-col gap-1 mt-2">
              <label className="text-label-md text-on-surface px-1" htmlFor="password">
                Kata Sandi
              </label>
              <div className="relative flex items-center">
                <span className="material-symbols-outlined absolute left-4 text-outline">lock</span>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  className="w-full h-touch-target-min pl-12 pr-12 border border-outline rounded-lg bg-surface focus:border-primary focus:ring-1 focus:ring-primary transition-all text-body-md outline-none"
                  placeholder="Masukkan kata sandi"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-4 text-outline hover:text-primary transition-colors"
                  aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                >
                  <span className="material-symbols-outlined">{showPassword ? 'visibility_off' : 'visibility'}</span>
                </button>
              </div>
            </div>

            {error && <p className="error-text px-1">{error}</p>}

            <div className="mt-stack-md flex flex-col gap-stack-sm">
              <button
                type="submit"
                disabled={loading}
                className="w-full h-touch-target-min bg-primary text-on-primary text-label-md rounded-full shadow-sm hover:opacity-90 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {loading ? 'Memproses...' : 'Masuk'}
                {!loading && <span className="material-symbols-outlined text-[20px]">login</span>}
              </button>
            </div>
          </form>
        </div>

        {/* <div className="mt-stack-lg flex items-center gap-2 text-on-surface-variant bg-secondary-container/20 px-4 py-2 rounded-full border border-secondary-container/30">
          <span className="material-symbols-outlined text-[18px] text-secondary">wifi_off</span>
          <span className="text-label-sm">Bekerja penuh secara offline</span>
        </div> */}
      </main>
    </div>
  );
}
