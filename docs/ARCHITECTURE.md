# Arsitektur Sistem — SmartRecall

> Dokumen ini adalah referensi teknis utama untuk AI coding agent (Antigravity) dan developer. Fokus: bagaimana bagian-bagian sistem terhubung, kontrak antar service, dan aturan main saat implementasi. Untuk konteks bisnis/produk, lihat `docs/PRD.md`.

---

## 1. Prinsip Arsitektur (wajib dipegang di setiap keputusan teknis)

1. **Single point of internet dependency**: hanya `ai-service` (saat proses generate) yang boleh butuh koneksi internet. Semua service lain (backend-api, frontend-web) harus tetap berfungsi penuh tanpa internet, selama masih terhubung ke jaringan lokal.
2. **Offline-first di sisi siswa**: frontend siswa tidak boleh punya alur yang *mengharuskan* fetch ke luar jaringan lokal.
3. **Local database sebagai source of truth**: `localStorage`/`IndexedDB` di frontend hanya cache, bukan sumber data utama. Data utama selalu di SQLite via backend-api.
4. **Graceful degradation**: kegagalan `ai-service` (API AI down/limit) tidak boleh membuat `backend-api` atau `frontend-web` ikut down. Selalu ada fallback manual.
5. **Human-in-the-loop**: konten hasil AI selalu berstatus `draft` sampai guru approve — tidak ada jalur yang membuat draft AI langsung terlihat siswa.

---

## 2. Komponen & Tanggung Jawab

| Service | Bahasa/Framework | Tanggung Jawab | Butuh Internet? |
|---|---|---|---|
| `ai-service` | Python + Flask | Ekstraksi teks PDF (pdfplumber), preprocessing NLP (Sastrawi), generate flashcard/rangkuman/soal via NVIDIA NIM API | **Ya**, hanya saat generate |
| `backend-api` | Node.js + Express | Auth, orkestrasi data, CRUD materi/flashcard/soal, algoritma SM-2, API contract ke frontend | Tidak |
| `frontend-web` | React (PWA) | UI guru & siswa, offline cache (IndexedDB), Service Worker, sync manager | Tidak (siswa) / Ya sesaat (guru, saat trigger generate) |
| Database | SQLite (default) | Penyimpanan utama semua entitas | Tidak |
| Local Server Hub | Laptop/PC guru | Menjalankan ketiga service + Wi-Fi hotspot lokal | Tidak (kecuali saat generate AI) |

---

## 3. Alur Data (Data Flow)

### 3.1 Alur Guru — Generate Materi
```
Guru (browser) 
  -> POST /materi/upload [backend-api] (hanya file + judul, TANPA pilih jenis konten)
  -> backend-api simpan file & metadata (status: draft) ke SQLite
  -> backend-api trigger job ke ai-service (async, non-blocking)
  -> ai-service: pdfplumber ekstrak teks SEKALI -> Sastrawi preprocess
  -> ai-service panggil NVIDIA NIM API 3x (flashcard, rangkuman, soal) dari teks yang sama
  -> ai-service kembalikan draft ketiga jenis sekaligus ke backend-api
     (kegagalan sebagian jenis dilaporkan lewat field "errors", tidak menggagalkan jenis lain)
  -> backend-api pecah & simpan tiap jenis ke tabel masing-masing (status: draft)
  -> Guru buka halaman review -> lihat ketiganya sekaligus -> approve/edit/reject
  -> Setelah approve -> status materi/flashcard/soal/rangkuman jadi "published"
```

**Aturan penting:** satu kali upload PDF WAJIB memicu generate ketiga jenis konten sekaligus (flashcard, rangkuman, bank soal) — guru tidak memilih jenis konten satu-satu saat upload. Langkah trigger job ke `ai-service` harus **async/queue**, tidak boleh blocking request siswa yang sedang aktif mengakses `backend-api` (lih. FR-5, batch generate).

### 3.2 Alur Siswa — Review Flashcard (Offline-First)
```
Siswa (PWA di HP/PC) 
  -> connect ke Wi-Fi Hotspot Local Server Hub (tanpa internet)
  -> GET /materi (published only) [backend-api]
  -> Service Worker cache response ke IndexedDB
  -> Siswa buka flashcard -> submit skor kualitas (0-5)
  -> Jika koneksi ke backend-api OK -> POST langsung ke /review
  -> Jika koneksi terputus -> simpan ke offline queue (IndexedDB) -> sync manager retry otomatis saat koneksi kembali
  -> backend-api terima skor -> jalankan sm2Algorithm.js -> update next_review_date
```

**Aturan penting:** submit skor TIDAK BOLEH hilang walau koneksi ke Local Server Hub putus sesaat — harus masuk offline queue dulu, baru sync.

### 3.3 Kontrak API Minimal (detail lengkap di `docs/API_SPEC.md`)

| Endpoint | Method | Auth | Deskripsi |
|---|---|---|---|
| `/auth/register-guru` | POST | - | Registrasi akun guru (username+password) |
| `/auth/register-siswa` | POST | - | Registrasi akun siswa (username+password, dibuat guru/admin) |
| `/auth/login` | POST | - | Login guru/siswa (username+password, sesuai FR-9 direvisi) |
| `/materi/upload` | POST | guru | Upload PDF, trigger job ai-service |
| `/materi` | GET | siswa/guru | List materi (siswa hanya lihat published) |
| `/materi/:id/draft` | GET | guru | Lihat draft AI (flashcard/soal/rangkuman) untuk review |
| `/materi/:id/approve` | POST | guru | Approve/edit/reject draft (termasuk rangkuman) |
| `/flashcard/manual` | POST | guru | Input manual (fallback tanpa AI) |
| `/review` | POST | siswa | Submit skor kualitas jawaban flashcard (0-5) |
| `/review/schedule/:siswa_id` | GET | siswa | Ambil jadwal review terkini (hasil SM-2) |
| `/soal/materi/:id` | GET | siswa/guru | Ambil soal kuis materi published (tanpa jawaban_benar) |
| `/soal/submit` | POST | siswa | Submit & nilai jawaban kuis di server, simpan QuizAttempt |
| `/soal/riwayat/:siswa_id` | GET | siswa/guru | Riwayat percobaan kuis siswa |
| `/rangkuman/materi/:id` | GET | siswa/guru | Ambil rangkuman materi published |

**Catatan penting:** `/materi/:id/draft` HANYA untuk guru. Endpoint siswa
untuk soal & rangkuman dipisah (`/soal/materi/:id`, `/rangkuman/materi/:id`)
agar tidak tercampur dengan alur review guru dan tidak membocorkan konten
draft yang belum di-approve.

---

## 4. Data Model (ringkas — skema lengkap di `docs/PRD.md` bagian 9)

```
User          (id, nama, role[guru/siswa], username, password_hash, nis?, kelas_id)
Materi        (id, guru_id, judul, file_original, status[draft/published], created_at)
Flashcard     (id, materi_id, pertanyaan, jawaban, status[draft/approved])
BankSoal      (id, materi_id, pertanyaan, opsi_jawaban, jawaban_benar, status)
Rangkuman     (id, materi_id[unique], konten [JSON string, lihat 6.2], status[draft/approved])
ReviewProgress(id, siswa_id, flashcard_id, repetition_number, ease_factor, interval, next_review_date)
ReviewLog     (id, siswa_id, flashcard_id, skor_kualitas, timestamp)
QuizAttempt   (id, siswa_id, materi_id, skor_benar, total_soal, jawaban_detail, submitted_at)
RangkumanRead (id, rangkuman_id, siswa_id, read_at) — opsional, tracking baca
```

**Relasi inti yang wajib dipertahankan:** `Materi → Flashcard/BankSoal/Rangkuman`, `Siswa → ReviewProgress/QuizAttempt`. Perubahan skema wajib lewat file migration, bukan edit langsung.

---

## 5. Algoritma SM-2 (implementasi di `backend-api/src/services/sm2Algorithm.js`)

Input: `q` (skor kualitas 0-5), state sebelumnya (`n`, `EF`, `I`).

```
jika q < 3:
    n = 0
    I = 1 (hari)
jika q >= 3:
    n = n + 1
    EF = EF + (0.1 - (5-q) * (0.08 + (5-q) * 0.02))   // clamp EF minimum 1.3
    jika n == 1: I = 1
    jika n == 2: I = 6
    jika n > 2:  I = round(I_sebelumnya * EF)

next_review_date = today + I hari
```

**Wajib ada unit test** untuk kasus: `q < 3` (reset), `q >= 3` (progresi normal), dan EF di batas minimum 1.3.

---

## 6. Struktur Folder

Lihat `docs/PRD.md` bagian 10 untuk struktur folder lengkap. Ringkasnya:

```
smartrecall/
├── ai-service/        # Flask — hanya dipanggil backend-api, tidak diakses langsung frontend
├── backend-api/        # Node.js + Express — satu-satunya yang diakses frontend
├── frontend-web/        # React PWA — guru & siswa dalam 1 app, dibedakan lewat role & routing
├── docs/
└── docker-compose.yml   # opsional, jalankan semua service jadi 1 Local Server Hub
```

**Aturan penting:** `frontend-web` TIDAK BOLEH memanggil `ai-service` secara langsung. Semua request dari frontend wajib lewat `backend-api` sebagai satu-satunya gateway.

---

## 6.1 Design System (frontend-web)

Styling `frontend-web` mengikuti design system Stitch ("Contextual Learning
Guide") yang diekspor lengkap ke `docs/design/`:
- `docs/design/contextual_learning_guide/DESIGN.md` -- dokumen desain penuh
  (warna, tipografi, spacing, komponen). **Sumber kebenaran untuk styling.**
- `docs/design/<nama_screen>/code.html` + `screen.png` -- referensi markup
  Tailwind & tangkapan layar per halaman (login, dashboard guru, upload,
  review draft AI, daftar materi siswa, flashcard, kuis, rangkuman).

Implementasi teknis di `frontend-web`:
- `tailwind.config.js` -- token warna/tipografi/spacing disalin dari
  `DESIGN.md`. AI Agent WAJIB pakai token ini (mis. `bg-primary`,
  `text-on-surface-variant`, `rounded-xl`), bukan warna hex baru.
- `src/components/OfflineBanner.jsx`, `BottomNav.jsx` -- komponen bersama,
  dipakai ulang di semua halaman alih-alih menulis ulang markup banner/nav.
- Font "Be Vietnam Pro" + ikon Material Symbols dimuat dari Google Fonts di
  `index.html` (butuh internet sesaat saat pertama kali load; fallback ke
  system font stack sudah diset di `tailwind.config.js` kalau gagal muat).
  **Rekomendasi sebelum rilis:** self-host font ini di `public/fonts` supaya
  tidak bergantung sama sekali pada koneksi ke Google, konsisten dengan
  prinsip #1 (single point of internet dependency).
- Elemen dekoratif berat di mockup asli (blur animasi, ilustrasi hero dari
  Google-hosted image) SENGAJA dihapus dari implementasi -- bertentangan
  dengan target perf di perangkat kelas rendah 3T (DESIGN.md sendiri
  menyebut "avoiding heavy blurs... optimized for performance on low-spec
  hardware", jadi blob animasi di mockup login sebenarnya kontradiktif
  dengan prinsip itu).

## 6.2 Skema Konten Rangkuman (block-based)

Kolom `Rangkuman.konten` (String di Prisma) berisi **JSON string dari array
blok konten terstruktur**, bukan prosa polos -- supaya siswa lebih mudah
memahami materi lewat kombinasi heading, poin-poin, contoh, dan catatan
penting (bukan cuma paragraf panjang). Prompt yang menghasilkan skema ini ada
di `ai-service/services/nim_client.py` `_build_prompt("rangkuman")`.

Setiap elemen array adalah salah satu dari:
```
{ "type": "paragraf", "teks": "..." }
{ "type": "heading",  "teks": "..." }
{ "type": "list",     "items": ["...", "..."] }
{ "type": "contoh",   "teks": "..." }
{ "type": "tip",      "teks": "..." }   // disarankan tepat satu di akhir array
```

**Siapa yang parse/serialize apa:**
- `ai-service`: LLM mengembalikan array ini langsung sebagai JSON (bukan dibungkus object `{konten: ...}` lagi).
- `backend-api` (`materiController.js`): `JSON.stringify()` array tsb sebelum disimpan ke kolom `konten`. Endpoint `GET /rangkuman/materi/:id` mengembalikan string ini apa adanya (tidak di-parse ulang di backend).
- `frontend-web`: komponen `src/components/RangkumanBlocks.jsx` yang `JSON.parse()` dan merender tiap tipe blok. Dipakai di halaman siswa (`Rangkuman.jsx`) dan review guru (`ReviewDraftAI.jsx`).

**Kompatibilitas mundur:** rangkuman yang dibuat sebelum perubahan skema ini
tersimpan sebagai string prosa biasa (bukan JSON array). `RangkumanBlocks.jsx`
menangani ini dengan fallback: jika `JSON.parse` gagal atau hasilnya bukan
array, konten ditampilkan sebagai daftar paragraf (perilaku lama), bukan
error atau halaman kosong.

## 7. Environment & Konfigurasi

- API key NVIDIA NIM wajib via environment variable (`.env`, jangan hardcode).
- Free tier NVIDIA NIM dipakai untuk MVP. **Catatan status saat ini:** skeleton baru memanggil `ai-service` secara fire-and-forget per upload (`materiController.js`), BELUM ada queue asli dengan concurrency limit (mis. BullMQ) — jadi rate-limit/kontrol kuota belum benar-benar dijaga di kode, baru di level dokumentasi/rencana. Prioritaskan ini sebelum demo dengan traffic banyak guru bersamaan.
- `nim_client.py` sudah mengembalikan `token_usage` (prompt/completion/total tokens) dari response NVIDIA NIM dan dicatat lewat log (`routes/generate.py`), tapi belum ada agregasi/budget tracking lintas request.
- Default database: SQLite file lokal. Opsi migrasi ke PostgreSQL harus tetap kompatibel dengan skema di atas.

### 7.1 PWA Installability
- `manifest.json` + `service-worker.js` + ikon (`public/icons/icon-192.png`, `icon-512.png`) sudah lengkap — syarat minimal browser (Chrome/Edge/Android) untuk menganggap app "installable".
- **Precaching app shell**: file JS/CSS hasil build Vite punya nama ber-hash (berubah tiap build), jadi TIDAK bisa di-precache dengan daftar tetap. `service-worker.js` memakai strategi "cache falling back to network, lalu populate cache" untuk semua asset non-API -- setiap asset yang sukses di-fetch (biasanya saat kunjungan pertama, online) otomatis tersimpan ke cache, sehingga kunjungan berikutnya (termasuk saat Local Server Hub mati TOTAL, bukan cuma backend-api-nya) tetap bisa boot dari cache. Sebelumnya app shell hanya cache-first tanpa populate -- bug ini sudah diperbaiki, tapi WAJIB diuji ulang manual (matikan network sepenuhnya setelah 1x kunjungan online, reload app) sebelum demo, karena Service Worker sulit di-unit-test dengan Vitest/jsdom.
- `InstallPrompt.jsx` menangkap event `beforeinstallprompt` dan menampilkan tombol "Install App" eksplisit di semua halaman (lewat `Layout.jsx`), supaya siswa tidak perlu tahu cara install manual dari menu browser.
- iOS Safari tidak mendukung `beforeinstallprompt` sama sekali — `InstallPrompt.jsx` mendeteksi platform iOS dan menampilkan instruksi manual "Add to Home Screen" sebagai gantinya.
- Ikon yang ada saat ini adalah **placeholder sederhana** (warna solid + bentuk kartu) — ganti dengan logo asli sebelum rilis/demo final.

---

## 8. Batasan yang Tidak Boleh Dilanggar AI Agent Saat Coding

- Jangan tambah dependency yang mengharuskan koneksi internet aktif di sisi siswa.
- Jangan hilangkan jalur input manual guru (fallback tanpa AI) saat menambah fitur AI baru.
- Jangan jadikan `localStorage`/`sessionStorage` sebagai satu-satunya sumber data siswa — hanya cache.
- Jangan ubah skema database tanpa file migration.
- Jangan buat `frontend-web` memanggil `ai-service` langsung — selalu lewat `backend-api`.
- Jangan buat siswa mengakses endpoint yang di-restrict `requireRole('guru')` (mis. `/materi/:id/draft`) — gunakan endpoint siswa yang sudah dipisah (`/soal/materi/:id`, `/rangkuman/materi/:id`).
