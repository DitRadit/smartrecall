import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { useAuth } from '../../services/authContext';
import { cacheFlashcards, getCachedFlashcards } from '../../offline/indexedDbCache';
import { submitReviewWithFallback } from '../../offline/syncManager';
import OfflineBanner from '../../components/OfflineBanner';

/**
 * ReviewFlashcard.jsx - Siswa mereview flashcard & submit skor kualitas (0-5).
 * (FR-11, FR-12, FR-14).
 *
 * Alur offline-first (ARCHITECTURE.md bagian 3.2):
 * - GET jadwal review: coba backend-api, fallback ke cache jika offline.
 * - Submit skor: submitReviewWithFallback akan otomatis masuk offline queue
 *   jika koneksi ke backend-api sedang terputus, lalu di-sync otomatis nanti.
 */
export default function ReviewFlashcard() {
  const { id: materiId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [flashcards, setFlashcards] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [selectedScore, setSelectedScore] = useState(null);
  const [submittingScore, setSubmittingScore] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [submitMessage, setSubmitMessage] = useState('');

  useEffect(() => {
    loadFlashcards();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [materiId]);

  async function loadFlashcards() {
    try {
      const response = await api.get(`/review/schedule/${user.id}`, { params: { materi_id: materiId } });
      const dueCards = response.data.due_for_review.map((p) => p.flashcard);
      const newCards = response.data.new_flashcards;
      const combined = [...dueCards, ...newCards];
      setFlashcards(combined);
      setIsOffline(false);
      await cacheFlashcards(combined);
    } catch (err) {
      const cached = await getCachedFlashcards(Number(materiId));
      setFlashcards(cached);
      setIsOffline(true);
    }
  }

  async function handleSubmitScore(skor) {
    const current = flashcards[currentIndex];
    if (!current) return;

    setSubmittingScore(true);
    try {
      const result = await submitReviewWithFallback({
        flashcard_id: current.id,
        skor_kualitas: skor,
      });

      setSelectedScore(skor);
      setShowAnswer(true);
      setSubmitMessage(
        result.synced
          ? 'Skor tersimpan.'
          : 'Koneksi terputus — skor disimpan di antrian lokal dan akan otomatis dikirim saat koneksi kembali.'
      );
    } catch (err) {
      setSubmitMessage('Gagal menyimpan skor. Silakan coba lagi.');
    } finally {
      setSubmittingScore(false);
    }
  }

  function goToNextCard() {
    setShowAnswer(false);
    setSelectedScore(null);
    setSubmitMessage('');
    if (currentIndex + 1 < flashcards.length) {
      setCurrentIndex(currentIndex + 1);
    } else {
      navigate('/siswa/materi');
    }
  }

  if (flashcards.length === 0) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-container-padding">
        <p className="text-body-md text-on-surface-variant text-center">
          Tidak ada flashcard untuk direview saat ini. Kerja bagus!
        </p>
      </div>
    );
  }

  const current = flashcards[currentIndex];
  const progressPct = Math.round(((currentIndex + (showAnswer ? 0.5 : 0)) / flashcards.length) * 100);

  return (
    <div className="min-h-screen bg-background">
      {isOffline && <OfflineBanner>Offline Mode</OfflineBanner>}

      <div className="px-container-padding pt-gutter pb-8 max-w-xl mx-auto">
        <div className="flex justify-between items-baseline mb-2">
          <h2 className="text-headline-md text-primary">Flashcard</h2>
          <span className="text-label-md text-on-surface-variant">
            Kartu {currentIndex + 1} dari {flashcards.length}
          </span>
        </div>
        <div className="w-full bg-surface-container h-2 rounded-full overflow-hidden mb-6">
          <div className="bg-primary h-full rounded-full transition-all" style={{ width: `${progressPct}%` }} />
        </div>

        <div className="bg-surface-container-lowest border border-outline-variant border-t-4 border-t-secondary-container rounded-xl p-6 min-h-[280px] flex flex-col items-center text-center">
          <span className="material-symbols-outlined text-secondary text-[40px] mb-4">lightbulb</span>
          <h3 className="text-headline-md text-primary mb-3">{current.pertanyaan}</h3>
          {showAnswer && (
            <>
              <p className="text-label-sm text-on-surface-variant uppercase tracking-wide mb-2">Jawaban</p>
              <p className="text-body-md text-on-surface-variant">{current.jawaban}</p>
            </>
          )}
        </div>

        <div className="mt-6">
          {!showAnswer ? (
            <div>
              <p className="text-body-md text-on-surface-variant text-center mb-3">
                Sebelum melihat jawaban, seberapa yakin jawabanmu benar?
              </p>
              <div className="grid grid-cols-6 gap-2">
                {[0, 1, 2, 3, 4, 5].map((skor) => (
                  <button
                    key={skor}
                    onClick={() => handleSubmitScore(skor)}
                    disabled={submittingScore}
                    className="h-touch-target-min rounded-lg border border-outline-variant text-label-md text-on-surface hover:bg-primary hover:text-on-primary hover:border-primary transition-colors disabled:opacity-50"
                  >
                    {skor}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div>
              <p className="text-body-md text-on-surface-variant text-center mb-3">
                Tingkat yakin kamu: <span className="font-bold text-primary">{selectedScore}</span>
              </p>
              <button
                onClick={goToNextCard}
                className="w-full h-touch-target-min bg-secondary-container text-on-secondary-container rounded-xl text-label-md flex items-center justify-center gap-2 shadow-sm active:scale-95 transition-transform"
              >
                {currentIndex + 1 < flashcards.length ? 'Kartu Berikutnya' : 'Selesai'}
                <span className="material-symbols-outlined">chevron_right</span>
              </button>
            </div>
          )}
        </div>

        {submitMessage && <p className="hint-text mt-4 text-center">{submitMessage}</p>}
      </div>
    </div>
  );
}
