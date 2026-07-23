import { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import api from '../../services/api';
import RangkumanBlocks from '../../components/RangkumanBlocks';
import AiProgressBar from '../../components/AiProgressBar';
import Swal from 'sweetalert2';

/**
 * ReviewDraftAI.jsx - Guru mereview, mengedit, approve/reject draft AI (FR-6).
 * Human-in-the-loop: draft tidak pernah terlihat siswa sampai di-approve di sini.
 * Juga menyediakan form input manual flashcard sebagai fallback (FR-7).
 *
 * Guru juga bisa mengedit/menghapus flashcard, mengedit blok rangkuman, dan
 * mengedit (pertanyaan/opsi/jawaban benar) atau menghapus soal bank soal --
 * baik untuk draft AI maupun konten yang sudah di-approve/published, karena
 * kesalahan atau kebutuhan koreksi bisa ditemukan guru kapan saja, bukan
 * cuma saat masih draft.
 */

const OPSI_LABELS = ['A', 'B', 'C', 'D'];

function parseOpsiJawaban(opsiJawaban) {
  try {
    const parsed = JSON.parse(opsiJawaban || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

export default function ReviewDraftAI() {
  const { id } = useParams();
  const [materi, setMateri] = useState(null);
  const [error, setError] = useState('');
  const [manualPertanyaan, setManualPertanyaan] = useState('');
  const [manualJawaban, setManualJawaban] = useState('');

  const navigate = useNavigate();
  const location = useLocation();

  // --- Flashcard edit state ---
  const [editingFlashcardId, setEditingFlashcardId] = useState(null);
  const [flashcardForm, setFlashcardForm] = useState({ pertanyaan: '', jawaban: '' });
  const [flashcardBusyId, setFlashcardBusyId] = useState(null);
  const [flashcardBatchBusy, setFlashcardBatchBusy] = useState(false);

  // --- Bank soal edit state ---
  const [editingSoalId, setEditingSoalId] = useState(null);
  const [soalForm, setSoalForm] = useState({ pertanyaan: '', opsi_jawaban: ['', '', '', ''], jawaban_benar: 'A' });
  const [soalBusyId, setSoalBusyId] = useState(null);
  const [soalBatchBusy, setSoalBatchBusy] = useState(false);

  // --- Rangkuman edit state ---
  const [editingRangkuman, setEditingRangkuman] = useState(false);
  const [rangkumanBlocks, setRangkumanBlocks] = useState([]);
  const [rangkumanBusy, setRangkumanBusy] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);
  const [aiProgress, setAiProgress] = useState(null);

  useEffect(() => {
    loadDraft();
  }, [id]);

  async function loadDraft() {
    try {
      const response = await api.get(`/materi/${id}/draft`);
      setMateri(response.data.materi);
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal memuat draft materi.');
    }
  }

  async function handleApprove(action) {
    try {
      await api.post(`/materi/${id}/approve`, { action });
      if (action === 'publish') {
        Swal.fire({
          icon: 'success',
          title: 'Berhasil mempublish materi!',
          showConfirmButton: false,
          timer: 1000,
          customClass: {
            popup: 'bg-surface-container-lowest rounded-xl shadow-xl border border-outline-variant',
            title: 'text-headline-md font-bold text-on-surface font-sans',
          }
        }).then(() => {
          navigate('/guru/dashboard', { 
            state: location.state || { returnGroupId: materi.groupId || null } 
          });
        });
      } else {
        await loadDraft();
      }
    } catch (err) {
      setError(err.response?.data?.message || `Gagal ${action} materi.`);
    }
  }

  async function handleManualSubmit(e) {
    e.preventDefault();
    try {
      await api.post('/flashcard/manual', {
        materi_id: id,
        pertanyaan: manualPertanyaan,
        jawaban: manualJawaban,
      });
      setManualPertanyaan('');
      setManualJawaban('');
      await loadDraft();
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal menambah flashcard manual.');
    }
  }

  // ================= Flashcard: edit & hapus =================

  function startEditFlashcard(f) {
    setEditingFlashcardId(f.id);
    setFlashcardForm({ pertanyaan: f.pertanyaan, jawaban: f.jawaban });
  }

  function cancelEditFlashcard() {
    setEditingFlashcardId(null);
  }

  async function saveEditFlashcard(fId) {
    setFlashcardBusyId(fId);
    setError('');
    try {
      await api.put(`/flashcard/${fId}`, flashcardForm);
      setEditingFlashcardId(null);
      await loadDraft();
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal menyimpan perubahan flashcard.');
    } finally {
      setFlashcardBusyId(null);
    }
  }

  async function deleteFlashcard(fId) {
    setFlashcardBusyId(fId);
    setError('');
    try {
      await api.delete(`/flashcard/${fId}`);
      await loadDraft();
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal menghapus flashcard.');
    } finally {
      setFlashcardBusyId(null);
    }
  }

  function deleteFlashcardHandler(fId) {
    setConfirmAction({
      title: 'Hapus Flashcard',
      message: 'Flashcard ini akan dihapus dari materi.',
      confirmLabel: 'Hapus',
      tone: 'danger',
      onConfirm: () => deleteFlashcard(fId),
    });
  }

  async function regenerateAllFlashcards() {
    setFlashcardBatchBusy(true);
    setError('');
    setAiProgress({
      title: 'AI sedang generate ulang flashcard',
      description: 'Pertanyaan dan jawaban lama sedang dianalisis untuk dibuatkan versi baru.',
      progress: null,
    });
    try {
      await api.post(`/flashcard/materi/${id}/regenerate`);
      setEditingFlashcardId(null);
      await loadDraft();
      setAiProgress(null);
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal generate ulang semua flashcard.');
      setAiProgress(null);
    } finally {
      setFlashcardBatchBusy(false);
    }
  }

  function regenerateAllFlashcardsHandler() {
    setConfirmAction({
      title: 'Generate Ulang Flashcard',
      message: 'Semua flashcard lama pada materi ini akan diganti dengan versi baru.',
      confirmLabel: 'Generate Ulang',
      tone: 'default',
      onConfirm: regenerateAllFlashcards,
    });
  }

  // ================= Bank soal: edit & hapus =================

  function startEditSoal(s) {
    setEditingSoalId(s.id);
    const opsi = parseOpsiJawaban(s.opsiJawaban);
    setSoalForm({
      pertanyaan: s.pertanyaan,
      opsi_jawaban: [0, 1, 2, 3].map((i) => opsi[i] ?? ''),
      jawaban_benar: s.jawabanBenar || 'A',
    });
  }

  function cancelEditSoal() {
    setEditingSoalId(null);
  }

  function updateSoalOpsi(index, value) {
    setSoalForm((prev) => {
      const next = [...prev.opsi_jawaban];
      next[index] = value;
      return { ...prev, opsi_jawaban: next };
    });
  }

  async function saveEditSoal(sId) {
    setSoalBusyId(sId);
    setError('');
    try {
      await api.put(`/soal/${sId}`, soalForm);
      setEditingSoalId(null);
      await loadDraft();
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal menyimpan perubahan soal.');
    } finally {
      setSoalBusyId(null);
    }
  }

  async function deleteSoal(sId) {
    setSoalBusyId(sId);
    setError('');
    try {
      await api.delete(`/soal/${sId}`);
      await loadDraft();
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal menghapus soal.');
    } finally {
      setSoalBusyId(null);
    }
  }

  function deleteSoalHandler(sId) {
    setConfirmAction({
      title: 'Hapus Soal',
      message: 'Soal ini akan dihapus dari bank soal materi.',
      confirmLabel: 'Hapus',
      tone: 'danger',
      onConfirm: () => deleteSoal(sId),
    });
  }

  async function regenerateAllSoal() {
    setSoalBatchBusy(true);
    setError('');
    setAiProgress({
      title: 'AI sedang generate ulang bank soal',
      description: 'Opsi jawaban dan kunci jawaban sedang disusun ulang.',
      progress: null,
    });
    try {
      await api.post(`/soal/materi/${id}/regenerate`);
      setEditingSoalId(null);
      await loadDraft();
      setAiProgress(null);
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal generate ulang semua bank soal.');
      setAiProgress(null);
    } finally {
      setSoalBatchBusy(false);
    }
  }

  function regenerateAllSoalHandler() {
    setConfirmAction({
      title: 'Generate Ulang Bank Soal',
      message: 'Semua soal lama pada materi ini akan diganti dengan versi baru.',
      confirmLabel: 'Generate Ulang',
      tone: 'default',
      onConfirm: regenerateAllSoal,
    });
  }

  // ================= Rangkuman: edit & hapus =================

  function parseKontenBlocks(konten) {
    try {
      const parsed = JSON.parse(konten || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }

  function startEditRangkuman() {
    setRangkumanBlocks(parseKontenBlocks(materi.rangkuman?.konten).map((b) => ({ ...b })));
    setEditingRangkuman(true);
  }

  function cancelEditRangkuman() {
    setEditingRangkuman(false);
  }

  function updateBlockTeks(index, teks) {
    setRangkumanBlocks((prev) => prev.map((b, i) => (i === index ? { ...b, teks } : b)));
  }

  function updateBlockItems(index, itemsText) {
    const items = itemsText.split('\n').map((s) => s.trim()).filter(Boolean);
    setRangkumanBlocks((prev) => prev.map((b, i) => (i === index ? { ...b, items } : b)));
  }

  function removeBlock(index) {
    setRangkumanBlocks((prev) => prev.filter((_, i) => i !== index));
  }

  async function saveRangkuman() {
    setRangkumanBusy(true);
    setError('');
    try {
      await api.put(`/rangkuman/${materi.rangkuman.id}`, { konten: rangkumanBlocks });
      setEditingRangkuman(false);
      await loadDraft();
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal menyimpan perubahan rangkuman.');
    } finally {
      setRangkumanBusy(false);
    }
  }

  async function deleteRangkuman() {
    setRangkumanBusy(true);
    setError('');
    try {
      await api.delete(`/rangkuman/${materi.rangkuman.id}`);
      setEditingRangkuman(false);
      await loadDraft();
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal menghapus rangkuman.');
    } finally {
      setRangkumanBusy(false);
    }
  }

  function deleteRangkumanHandler() {
    setConfirmAction({
      title: 'Hapus Rangkuman',
      message: 'Rangkuman ini akan dihapus dan siswa tidak akan lagi bisa membacanya.',
      confirmLabel: 'Hapus',
      tone: 'danger',
      onConfirm: deleteRangkuman,
    });
  }

  async function regenerateRangkuman() {
    setRangkumanBusy(true);
    setError('');
    setAiProgress({
      title: 'AI sedang generate ulang rangkuman',
      description: 'Blok rangkuman lama sedang dirapikan menjadi versi baru.',
      progress: null,
    });
    try {
      await api.post(`/rangkuman/${materi.rangkuman.id}/regenerate`);
      setEditingRangkuman(false);
      await loadDraft();
      setAiProgress(null);
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal generate ulang rangkuman.');
      setAiProgress(null);
    } finally {
      setRangkumanBusy(false);
    }
  }

  function regenerateRangkumanHandler() {
    setConfirmAction({
      title: 'Generate Ulang Rangkuman',
      message: 'Isi rangkuman lama akan diganti dengan versi baru.',
      confirmLabel: 'Generate Ulang',
      tone: 'default',
      onConfirm: regenerateRangkuman,
    });
  }

  async function handleConfirmAction() {
    const action = confirmAction;
    if (!action) return;

    setConfirmAction(null);
    await action.onConfirm();
  }

  async function downloadPpt() {
    setError('');
    try {
      const response = await api.get(`/materi/${id}/ppt`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${materi.judul || 'materi'}.pptx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.response?.data?.message || 'PPT belum tersedia atau gagal didownload.');
    }
  }

  if (error && !materi) {
    return (
      <div className="max-w-5xl mx-auto px-container-padding py-stack-md">
        <p className="error-text">{error}</p>
      </div>
    );
  }
  if (!materi) {
    return (
      <div className="max-w-5xl mx-auto px-container-padding py-stack-md">
        <p className="text-body-md text-on-surface-variant">Memuat draft...</p>
      </div>
    );
  }

  const flashcardCount = materi.flashcards?.length || 0;
  const soalCount = materi.bankSoal?.length || 0;

  return (
    <div className="max-w-6xl mx-auto px-container-padding py-stack-md">
      {confirmAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-inverse-surface/40 px-4">
          <div className="w-full max-w-md rounded-xl border border-outline-variant bg-surface-container-lowest p-6 shadow-xl">
            <div className="flex items-start gap-3">
              <div
                className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${
                  confirmAction.tone === 'danger' ? 'bg-error-container' : 'bg-primary-fixed'
                }`}
              >
                <span
                  className={`material-symbols-outlined ${
                    confirmAction.tone === 'danger' ? 'text-error' : 'text-primary'
                  }`}
                >
                  {confirmAction.tone === 'danger' ? 'warning' : 'autorenew'}
                </span>
              </div>
              <div>
                <h3 className="text-headline-md text-on-surface font-bold">{confirmAction.title}</h3>
                <p className="text-body-md text-on-surface-variant mt-2">{confirmAction.message}</p>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmAction(null)}
                className="h-10 px-4 rounded-lg border border-outline-variant text-label-md text-on-surface-variant hover:bg-surface-container"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmAction}
                className={`h-10 px-5 rounded-lg text-label-md ${
                  confirmAction.tone === 'danger'
                    ? 'bg-error text-on-error'
                    : 'bg-primary text-on-primary'
                }`}
              >
                {confirmAction.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-wrap justify-between items-start gap-3 bg-secondary-container/20 border border-secondary-container/40 rounded-xl p-4 mb-6">
        <div className="flex items-start gap-2">
          <span className="material-symbols-outlined text-secondary">auto_awesome</span>
          <div>
            <h2 className="text-headline-md text-primary">AI Review Mode: {materi.judul}</h2>
            <p className="text-label-sm text-on-surface-variant">
              {flashcardCount} kartu, {soalCount} soal, dan rangkuman ditemukan dari dokumen Anda.
            </p>
          </div>
        </div>
        <span className="text-label-sm font-bold uppercase tracking-wider bg-surface-container-lowest border border-outline-variant px-3 py-1 rounded-full">
          {materi.status}
        </span>
      </div>

      {error && <p className="error-text mb-4">{error}</p>}
      {aiProgress && (
        <div className="mb-4">
          <AiProgressBar
            title={aiProgress.title}
            description={aiProgress.description}
            progress={aiProgress.progress}
          />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
        <div className="space-y-6">
          {/* ================= FLASHCARD ================= */}
          <section>
            <div className="flex items-center justify-between gap-3 mb-3">
              <h3 className="text-headline-md text-primary">Flashcard Draft ({flashcardCount})</h3>
              {flashcardCount > 0 && (
                <button
                  type="button"
                  onClick={regenerateAllFlashcardsHandler}
                  disabled={flashcardBatchBusy}
                  className="text-secondary hover:underline text-label-sm inline-flex items-center gap-1 disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[18px]">autorenew</span>
                  {flashcardBatchBusy ? 'Generate...' : 'Generate Ulang Semua'}
                </button>
              )}
            </div>
            <div className="space-y-3">
              {(materi.flashcards || []).map((f) => {
                const isEditing = editingFlashcardId === f.id;
                const isBusy = flashcardBusyId === f.id;
                return (
                  <div key={f.id} className="bg-surface-container-lowest border border-outline-variant rounded-xl p-4">
                    {isEditing ? (
                      <div className="flex flex-col gap-3">
                        <div className="flex flex-col gap-1">
                          <label className="text-label-sm text-on-surface-variant">Pertanyaan</label>
                          <textarea
                            className="w-full border border-outline rounded-lg p-3 text-body-md outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                            rows={2}
                            value={flashcardForm.pertanyaan}
                            onChange={(e) => setFlashcardForm((p) => ({ ...p, pertanyaan: e.target.value }))}
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-label-sm text-on-surface-variant">Jawaban</label>
                          <textarea
                            className="w-full border border-outline rounded-lg p-3 text-body-md outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                            rows={2}
                            value={flashcardForm.jawaban}
                            onChange={(e) => setFlashcardForm((p) => ({ ...p, jawaban: e.target.value }))}
                          />
                        </div>
                        <div className="flex gap-2 justify-end">
                          <button
                            type="button"
                            onClick={cancelEditFlashcard}
                            disabled={isBusy}
                            className="h-touch-target-min px-4 border border-outline-variant text-on-surface-variant rounded-lg text-label-md"
                          >
                            Batal
                          </button>
                          <button
                            type="button"
                            onClick={() => saveEditFlashcard(f.id)}
                            disabled={isBusy}
                            className="h-touch-target-min px-4 bg-primary text-on-primary rounded-lg text-label-md disabled:opacity-50"
                          >
                            {isBusy ? 'Menyimpan...' : 'Simpan'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className="text-label-sm text-on-surface-variant uppercase tracking-wide mb-1">Pertanyaan</p>
                        <p className="text-body-md text-on-surface mb-3">{f.pertanyaan}</p>
                        <p className="text-label-sm text-on-surface-variant uppercase tracking-wide mb-1">Jawaban</p>
                        <p className="text-body-md text-on-surface-variant mb-3">{f.jawaban}</p>
                        <div className="flex gap-4">
                          <button
                            type="button"
                            onClick={() => startEditFlashcard(f)}
                            disabled={isBusy}
                            className="text-primary hover:underline text-label-sm inline-flex items-center gap-1"
                          >
                            <span className="material-symbols-outlined text-[18px]">edit</span>
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteFlashcardHandler(f.id)}
                            disabled={isBusy}
                            className="text-error hover:underline text-label-sm inline-flex items-center gap-1 disabled:opacity-50"
                          >
                            <span className="material-symbols-outlined text-[18px]">delete</span>
                            {isBusy ? 'Menghapus...' : 'Hapus'}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
              {flashcardCount === 0 && <p className="hint-text">Belum ada flashcard draft.</p>}
            </div>
          </section>

          {/* ================= RANGKUMAN ================= */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-headline-md text-primary">Rangkuman Draft</h3>
              {materi.rangkuman && !editingRangkuman && (
                <div className="flex gap-4">
                  <button
                    type="button"
                    onClick={regenerateRangkumanHandler}
                    disabled={rangkumanBusy}
                    className="text-secondary hover:underline text-label-sm inline-flex items-center gap-1 disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined text-[18px]">autorenew</span>
                    {rangkumanBusy ? 'Generate...' : 'Generate Ulang'}
                  </button>
                  <button
                    type="button"
                    onClick={startEditRangkuman}
                    disabled={rangkumanBusy}
                    className="text-primary hover:underline text-label-sm inline-flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined text-[18px]">edit</span>
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={deleteRangkumanHandler}
                    disabled={rangkumanBusy}
                    className="text-error hover:underline text-label-sm inline-flex items-center gap-1 disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined text-[18px]">delete</span>
                    Hapus
                  </button>
                </div>
              )}
            </div>

            {materi.rangkuman ? (
              editingRangkuman ? (
                <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-4 space-y-4">
                  {rangkumanBlocks.map((block, i) => (
                    <div key={i} className="border border-outline-variant rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-label-sm font-bold uppercase tracking-wide text-on-surface-variant">
                          {block.type}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeBlock(i)}
                          className="text-error hover:underline text-label-sm inline-flex items-center gap-1"
                        >
                          <span className="material-symbols-outlined text-[16px]">close</span>
                          Hapus blok
                        </button>
                      </div>
                      {block.type === 'list' ? (
                        <textarea
                          className="w-full border border-outline rounded-lg p-3 text-body-md outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                          rows={Math.max(3, (block.items || []).length)}
                          placeholder="Satu poin per baris"
                          value={(block.items || []).join('\n')}
                          onChange={(e) => updateBlockItems(i, e.target.value)}
                        />
                      ) : (
                        <textarea
                          className="w-full border border-outline rounded-lg p-3 text-body-md outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                          rows={block.type === 'heading' ? 1 : 3}
                          value={block.teks || ''}
                          onChange={(e) => updateBlockTeks(i, e.target.value)}
                        />
                      )}
                    </div>
                  ))}
                  {rangkumanBlocks.length === 0 && (
                    <p className="hint-text">Semua blok sudah dihapus. Simpan untuk mengosongkan rangkuman, atau batalkan.</p>
                  )}
                  <div className="flex gap-2 justify-end">
                    <button
                      type="button"
                      onClick={cancelEditRangkuman}
                      disabled={rangkumanBusy}
                      className="h-touch-target-min px-4 border border-outline-variant text-on-surface-variant rounded-lg text-label-md"
                    >
                      Batal
                    </button>
                    <button
                      type="button"
                      onClick={saveRangkuman}
                      disabled={rangkumanBusy}
                      className="h-touch-target-min px-4 bg-primary text-on-primary rounded-lg text-label-md disabled:opacity-50"
                    >
                      {rangkumanBusy ? 'Menyimpan...' : 'Simpan Rangkuman'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-4">
                  <RangkumanBlocks konten={materi.rangkuman.konten} />
                </div>
              )
            ) : (
              <p className="hint-text">Rangkuman belum tersedia (mungkin gagal di-generate — cek log guru/admin).</p>
            )}
          </section>

          {/* ================= BANK SOAL ================= */}
          <section>
            <div className="flex items-center justify-between gap-3 mb-3">
              <h3 className="text-headline-md text-primary">Bank Soal Draft ({soalCount})</h3>
              {soalCount > 0 && (
                <button
                  type="button"
                  onClick={regenerateAllSoalHandler}
                  disabled={soalBatchBusy}
                  className="text-secondary hover:underline text-label-sm inline-flex items-center gap-1 disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[18px]">autorenew</span>
                  {soalBatchBusy ? 'Generate...' : 'Generate Ulang Semua'}
                </button>
              )}
            </div>
            <div className="space-y-3">
              {(materi.bankSoal || []).map((s) => {
                const isEditing = editingSoalId === s.id;
                const isBusy = soalBusyId === s.id;
                const opsiTampil = parseOpsiJawaban(s.opsiJawaban);
                return (
                  <div key={s.id} className="bg-surface-container-lowest border border-outline-variant rounded-xl p-4">
                    {isEditing ? (
                      <div className="flex flex-col gap-3">
                        <div className="flex flex-col gap-1">
                          <label className="text-label-sm text-on-surface-variant">Pertanyaan</label>
                          <textarea
                            className="w-full border border-outline rounded-lg p-3 text-body-md outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                            rows={2}
                            value={soalForm.pertanyaan}
                            onChange={(e) => setSoalForm((p) => ({ ...p, pertanyaan: e.target.value }))}
                          />
                        </div>
                        <div className="flex flex-col gap-2">
                          <label className="text-label-sm text-on-surface-variant">
                            Opsi jawaban (pilih tombol radio untuk menandai jawaban yang benar)
                          </label>
                          {OPSI_LABELS.map((label, i) => (
                            <div key={label} className="flex items-center gap-2">
                              <input
                                type="radio"
                                name={`jawaban-benar-${s.id}`}
                                checked={soalForm.jawaban_benar === label}
                                onChange={() => setSoalForm((p) => ({ ...p, jawaban_benar: label }))}
                                className="w-5 h-5 accent-primary shrink-0"
                                aria-label={`Tandai opsi ${label} sebagai jawaban benar`}
                              />
                              <span className="text-label-sm text-on-surface-variant w-5 shrink-0">{label}.</span>
                              <input
                                type="text"
                                className="flex-1 border border-outline rounded-lg p-2 text-body-md outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                                value={soalForm.opsi_jawaban[i]}
                                onChange={(e) => updateSoalOpsi(i, e.target.value)}
                              />
                            </div>
                          ))}
                        </div>
                        <div className="flex gap-2 justify-end">
                          <button
                            type="button"
                            onClick={cancelEditSoal}
                            disabled={isBusy}
                            className="h-touch-target-min px-4 border border-outline-variant text-on-surface-variant rounded-lg text-label-md"
                          >
                            Batal
                          </button>
                          <button
                            type="button"
                            onClick={() => saveEditSoal(s.id)}
                            disabled={isBusy}
                            className="h-touch-target-min px-4 bg-primary text-on-primary rounded-lg text-label-md disabled:opacity-50"
                          >
                            {isBusy ? 'Menyimpan...' : 'Simpan'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className="text-body-md text-on-surface mb-2">{s.pertanyaan}</p>
                        <ul className="space-y-1 mb-3">
                          {opsiTampil.map((opsi, i) => (
                            <li
                              key={i}
                              className={`text-label-sm px-2 py-1 rounded ${
                                OPSI_LABELS[i] === s.jawabanBenar
                                  ? 'bg-on-tertiary-container/10 text-on-tertiary-container font-bold'
                                  : 'text-on-surface-variant'
                              }`}
                            >
                              {OPSI_LABELS[i]}. {opsi}
                              {OPSI_LABELS[i] === s.jawabanBenar ? ' (jawaban benar)' : ''}
                            </li>
                          ))}
                        </ul>
                        <div className="flex gap-4">
                          <button
                            type="button"
                            onClick={() => startEditSoal(s)}
                            disabled={isBusy}
                            className="text-primary hover:underline text-label-sm inline-flex items-center gap-1"
                          >
                            <span className="material-symbols-outlined text-[18px]">edit</span>
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteSoalHandler(s.id)}
                            disabled={isBusy}
                            className="text-error hover:underline text-label-sm inline-flex items-center gap-1 disabled:opacity-50"
                          >
                            <span className="material-symbols-outlined text-[18px]">delete</span>
                            {isBusy ? 'Menghapus...' : 'Hapus'}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
              {soalCount === 0 && <p className="hint-text">Belum ada bank soal draft.</p>}
            </div>
          </section>
        </div>

        <aside className="space-y-4">
          {materi.pptFile && (
            <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-5">
              <h3 className="text-label-md text-on-surface mb-2 flex items-center gap-2">
                <span className="material-symbols-outlined text-[20px]">slideshow</span>
                PPT Materi
              </h3>
              <p className="text-label-sm text-on-surface-variant mb-3">
                File PPT hasil AI sudah tersedia dari template yang dipilih.
              </p>
              <button
                type="button"
                onClick={downloadPpt}
                className="h-touch-target-min w-full bg-primary text-on-primary rounded-lg text-label-md flex items-center justify-center gap-2 hover:opacity-90"
              >
                <span className="material-symbols-outlined text-[20px]">download</span>
                Download PPT
              </button>
            </div>
          )}

          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-5">
            <h3 className="text-label-md text-on-surface mb-3 flex items-center gap-2">
              <span className="material-symbols-outlined text-[20px]">add_circle</span>
              Tambah Manual
            </h3>
            <form onSubmit={handleManualSubmit} className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-label-sm text-on-surface-variant">Pertanyaan</label>
                <textarea
                  className="w-full border border-outline rounded-lg p-3 text-body-md outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  rows={3}
                  placeholder="Masukkan pertanyaan baru..."
                  value={manualPertanyaan}
                  onChange={(e) => setManualPertanyaan(e.target.value)}
                  required
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-label-sm text-on-surface-variant">Jawaban</label>
                <textarea
                  className="w-full border border-outline rounded-lg p-3 text-body-md outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  rows={3}
                  placeholder="Masukkan jawaban yang benar..."
                  value={manualJawaban}
                  onChange={(e) => setManualJawaban(e.target.value)}
                  required
                />
              </div>
              <button
                type="submit"
                className="h-touch-target-min bg-primary text-on-primary rounded-lg text-label-md flex items-center justify-center gap-2 hover:opacity-90"
              >
                <span className="material-symbols-outlined text-[20px]">save</span>
                Simpan Draft Baru
              </button>
            </form>
          </div>

          <div className="flex flex-col gap-2">
            <button
              onClick={() => handleApprove('approve')}
              className="h-touch-target-min bg-secondary-container text-on-secondary-container rounded-xl text-label-md flex items-center justify-center gap-2 shadow-sm active:scale-95 transition-transform"
            >
              <span className="material-symbols-outlined">rocket_launch</span>
              Approve Semua & Publish
            </button>
            <button
              onClick={() => handleApprove('reject')}
              className="h-touch-target-min border border-outline-variant text-on-surface-variant rounded-xl text-label-md flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined">delete</span>
              Reject Draft
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}
