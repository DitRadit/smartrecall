import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { cacheRangkuman, getCachedRangkuman } from '../../offline/indexedDbCache';
import OfflineBanner from '../../components/OfflineBanner';
import RangkumanBlocks from '../../components/RangkumanBlocks';

/**
 * Rangkuman.jsx - Siswa membaca rangkuman materi (pelengkap FR terkait
 * ringkasan AI). Sebelumnya rangkuman digenerate AI tapi tidak pernah
 * disimpan/ditampilkan -- halaman ini melengkapi jalur baca untuk siswa,
 * dengan pola offline-first yang sama seperti ReviewFlashcard.jsx.
 *
 * Rendering blok konten (heading/paragraf/list/contoh/tip) didelegasikan ke
 * RangkumanBlocks -- komponen yang sama yang dipakai di halaman guru
 * (ReviewDraftAI.jsx) -- supaya konsisten dengan format JSON array yang
 * benar-benar dihasilkan ai-service/services/nim_client.py _build_prompt
 * ("rangkuman"). Sebelumnya halaman ini punya parser markdown-lite sendiri
 * (renderKonten) yang mengasumsikan format lama ("## heading", "- list")
 * yang sudah tidak dipakai, sehingga JSON mentah malah tertampil apa adanya
 * ke siswa alih-alih diformat.
 */
export default function Rangkuman() {
  const { id: materiId } = useParams();
  const navigate = useNavigate();
  const [judul, setJudul] = useState('');
  const [konten, setKonten] = useState('');
  const [isOffline, setIsOffline] = useState(false);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    loadRangkuman();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [materiId]);

  async function loadRangkuman() {
    try {
      const res = await api.get(`/rangkuman/materi/${materiId}`);
      setJudul(res.data.judul);
      setKonten(res.data.rangkuman.konten);
      setIsOffline(false);
      setNotFound(false);
      await cacheRangkuman(Number(materiId), { judul: res.data.judul, konten: res.data.rangkuman.konten });
    } catch (err) {
      const cached = await getCachedRangkuman(Number(materiId));
      if (cached) {
        setJudul(cached.judul);
        setKonten(cached.konten);
        setIsOffline(true);
      } else {
        setNotFound(true);
      }
    }
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-container-padding">
        <p className="text-body-md text-on-surface-variant text-center">
          Rangkuman untuk materi ini belum tersedia. Coba lagi saat terhubung ke Local Server Hub.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {isOffline && <OfflineBanner>Sedang offline</OfflineBanner>}

      <header className="flex items-center gap-3 px-container-padding h-touch-target-min border-b border-outline-variant bg-surface">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-primary text-label-md">
          <span className="material-symbols-outlined">arrow_back</span>
          Kembali
        </button>
      </header>

      <div className="px-container-padding pt-gutter pb-10 max-w-2xl mx-auto">
        <span className="inline-block bg-surface-container text-on-surface-variant text-label-sm px-3 py-1 rounded-full mb-2">
          Rangkuman
        </span>
        <h2 className="text-headline-lg-mobile text-primary mb-4">{judul}</h2>

        <RangkumanBlocks konten={konten} />
      </div>
    </div>
  );
}