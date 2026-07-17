import { useState } from 'react';
import api from '../../services/api';

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

    const formData = new FormData();
    formData.append('file', file);
    formData.append('judul', judul);
    formData.append('generate_ppt', generatePpt ? 'true' : 'false');

    try {
      const response = await api.post('/materi/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setStatus({ type: 'success', message: response.data.message });
      setJudul('');
      setFile(null);
      setGeneratePpt(false);
    } catch (err) {
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
        Cukup unggah PDF materi — flashcard, rangkuman, dan bank soal akan otomatis dibuatkan AI sekaligus.
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
                Opsional. AI akan membuat slide rangkuman dan poin-poin penting memakai template PPT yang sudah disediakan.
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
