import { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import api from '../../services/api';
import AiProgressBar from '../../components/AiProgressBar';

/**
 * UploadMateri.jsx - Guru upload PDF materi (FR-2, FR-3, FR-4).
 * Requires internet aktif sesaat karena trigger ai-service.
 *
 * Guru TIDAK perlu memilih jenis konten -- sekali upload, ai-service otomatis
 * menghasilkan ketiga jenis konten sekaligus (flashcard, rangkuman, bank
 * soal) dari satu file yang sama (lihat ARCHITECTURE.md 3.1 & backend-api
 * materiController.js). Kegagalan sebagian jenis (mis. rangkuman gagal karena
 * rate limit) tidak menggagalkan jenis lain -- guru tetap bisa review yang
 * berhasil di halaman Review Draft AI.
 */
export default function UploadMateri() {
  const [judul, setJudul] = useState('');
  const [file, setFile] = useState(null);
  const [generatePpt, setGeneratePpt] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [aiProgress, setAiProgress] = useState(null);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const groupId = searchParams.get('groupId');

  function formatProgress(progress) {
    if (!progress) return null;

    return {
      title:
        progress.status === 'done'
          ? 'Generate AI selesai'
          : progress.status === 'error'
            ? 'Generate AI gagal'
            : progress.status === 'queued'
              ? 'Menunggu proses AI'
              : 'AI sedang memproses materi',
      description: progress.message || 'Proses AI sedang berjalan.',
      progress: progress.progress || 0,
      active: !['done', 'error', 'unknown'].includes(progress.status),
      status: progress.status,
    };
  }

  async function pollGenerateProgress(materiId) {
    const maxAttempts = 240; // sekitar 8 menit, interval 2 detik

    try {
      for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        const response = await api.get(`/materi/${materiId}/generate-progress`);
        const nextProgress = formatProgress(response.data.progress);
        if (nextProgress) setAiProgress(nextProgress);

        if (nextProgress?.status === 'done') {
          Swal.fire({
            icon: 'success',
            title: 'Generate AI Selesai!',
            text: 'Materi siap direview.',
            showConfirmButton: false,
            timer: 1500,
            customClass: {
              popup: 'bg-surface-container-lowest rounded-xl shadow-xl border border-outline-variant',
              title: 'text-headline-md font-bold text-on-surface font-sans',
              htmlContainer: 'text-body-md text-on-surface-variant'
            }
          }).then(() => {
            navigate('/guru/dashboard', { state: { returnGroupId: groupId ? Number(groupId) : null } });
          });
          return;
        }
        if (nextProgress?.status === 'error') {
          setStatus({
            type: 'error',
            message: nextProgress.description || 'Generate AI gagal. Gunakan input manual jika diperlukan.',
          });
          return;
        }

        await new Promise((resolve) => {
          window.setTimeout(resolve, 2000);
        });
      }

      setStatus({
        type: 'success',
        message: 'Generate AI masih berjalan. Cek dashboard beberapa saat lagi.',
      });
    } catch (err) {
      setStatus({
        type: 'error',
        message: err.response?.data?.message || 'Gagal memantau progress AI. Cek dashboard beberapa saat lagi.',
      });
    }
  }

  function handleDrop(e) {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files?.[0]) setFile(e.dataTransfer.files[0]);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!file) {
      setStatus({ type: 'error', message: 'Pilih file PDF terlebih dahulu.' });
      return;
    }
    setLoading(true);
    setStatus(null);
    setAiProgress({
      title: 'Mengunggah materi ke server',
      description: 'File PDF sedang dikirim. Setelah diterima, AI akan membuat flashcard, rangkuman, bank soal, dan PPT jika dipilih.',
      progress: 35,
      active: true,
    });

    const formData = new FormData();
    formData.append('file', file);
    formData.append('judul', judul);
    formData.append('generate_ppt', generatePpt ? 'true' : 'false');
    if (groupId) {
      formData.append('groupId', groupId);
    }

    try {
      const response = await api.post('/materi/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setStatus({ type: 'success', message: response.data.message });
      setAiProgress(formatProgress(response.data.progress));
      setJudul('');
      setFile(null);
      setGeneratePpt(false);
      if (response.data.materi?.id) {
        pollGenerateProgress(response.data.materi.id);
      }
    } catch (err) {
      setAiProgress(null);
      setStatus({
        type: 'error',
        message:
          err.response?.data?.message ||
          'Gagal upload materi. Jika AI sedang bermasalah, gunakan menu input manual flashcard.',
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-container-padding py-stack-md">
      <h2 className="text-headline-lg text-primary">Upload Materi Pembelajaran</h2>
      <p className="text-body-md text-on-surface-variant mt-1 mb-6">
        Cukup unggah PDF materi — flashcard, rangkuman, bank soal, dan PPT opsional akan dibuatkan AI.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-[1fr_320px] gap-6">
        <form onSubmit={handleSubmit} className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-label-md text-on-surface" htmlFor="judul">
              Judul Materi
            </label>
            <input
              id="judul"
              className="w-full h-touch-target-min px-4 border border-outline rounded-lg bg-surface focus:border-primary focus:ring-1 focus:ring-primary transition-all text-body-md outline-none"
              placeholder="Contoh: Sejarah Kemerdekaan Indonesia Kelas IX"
              value={judul}
              onChange={(e) => setJudul(e.target.value)}
              required
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-label-md text-on-surface">File Materi (PDF)</label>
            <label
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-xl p-10 flex flex-col items-center justify-center text-center cursor-pointer transition-colors ${
                isDragging ? 'border-primary bg-primary-fixed/10' : 'border-outline-variant bg-surface-container-low'
              }`}
            >
              <span className="material-symbols-outlined text-primary text-[40px] mb-2">picture_as_pdf</span>
              {file ? (
                <p className="text-body-md text-on-surface font-semibold">{file.name}</p>
              ) : (
                <>
                  <p className="text-body-md text-on-surface">Tarik dan lepas file PDF di sini</p>
                  <p className="text-label-sm text-on-surface-variant mt-1">Atau klik untuk memilih file dari komputer</p>
                </>
              )}
              <input
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={(e) => setFile(e.target.files[0])}
                required
              />
            </label>
          </div>

          <div className="flex items-start gap-2 bg-surface-container-low border border-outline-variant rounded-lg p-3">
            <span className="material-symbols-outlined text-on-surface-variant text-[18px]">info</span>
            <p className="text-label-sm text-on-surface-variant">
              Flashcard, rangkuman, dan bank soal dibuat otomatis sekaligus. Proses AI butuh internet sesaat, hasil bisa diedit sebelum publish.
            </p>
          </div>

          <label className="flex items-start gap-3 bg-surface-container-lowest border border-outline-variant rounded-lg p-3 cursor-pointer">
            <input
              type="checkbox"
              checked={generatePpt}
              onChange={(e) => setGeneratePpt(e.target.checked)}
              className="mt-1 w-5 h-5 accent-primary shrink-0"
            />
            <span>
              <span className="block text-label-md text-on-surface">Generate PPT dari materi ini</span>
              <span className="block text-label-sm text-on-surface-variant mt-1">
                Opsional. Setelah proses background selesai, tombol download PPT muncul di dashboard dan halaman review materi.
              </span>
            </span>
          </label>

          <button
            type="submit"
            disabled={loading}
            className="w-full h-touch-target-min bg-primary text-on-primary rounded-xl text-label-md flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all disabled:opacity-60"
          >
            <span className="material-symbols-outlined">bolt</span>
            {loading ? 'Mengunggah...' : generatePpt ? 'Upload & Generate Semua + PPT' : 'Upload & Generate Semua'}
          </button>

          {aiProgress && (
            <AiProgressBar
              title={aiProgress.title}
              description={aiProgress.description}
              progress={aiProgress.progress}
              active={aiProgress.active}
            />
          )}

          {status && (
            <p className={status.type === 'error' ? 'error-text' : 'success-text'}>{status.message}</p>
          )}
        </form>

        <aside className="bg-surface-container-lowest border border-outline-variant rounded-xl p-5 h-fit">
          <div className="flex items-center gap-2 mb-3">
            <span className="material-symbols-outlined text-secondary">lightbulb</span>
            <h3 className="text-label-md text-on-surface">Tips Upload</h3>
          </div>
          <ul className="space-y-3">
            <li className="flex gap-2 text-label-sm text-on-surface-variant">
              <span className="w-5 h-5 rounded-full bg-secondary-container text-on-secondary-container flex items-center justify-center text-[11px] font-bold flex-shrink-0">1</span>
              Pastikan teks pada PDF terbaca dengan jelas (bukan hasil scan gambar buram).
            </li>
            <li className="flex gap-2 text-label-sm text-on-surface-variant">
              <span className="w-5 h-5 rounded-full bg-secondary-container text-on-secondary-container flex items-center justify-center text-[11px] font-bold flex-shrink-0">2</span>
              File maksimal berukuran 10MB untuk proses optimasi yang lebih cepat.
            </li>
            <li className="flex gap-2 text-label-sm text-on-surface-variant">
              <span className="w-5 h-5 rounded-full bg-secondary-container text-on-secondary-container flex items-center justify-center text-[11px] font-bold flex-shrink-0">3</span>
              Fokuskan konten pada satu sub-topik agar hasil AI lebih mendalam.
            </li>
          </ul>
        </aside>
      </div>
    </div>
  );
}
