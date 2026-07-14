# Product Requirements Document (PRD)
## SmartRecall — Platform Micro-Learning Berbasis AI dengan Spaced Repetition

**Tim:** Siasat LDS — Telkom University
**Versi Dokumen:** 1.0
**Tanggal:** 9 Juli 2026
**Status:** Draft untuk kickoff development (Antigravity + AI Coding Agent)

---

## 1. Ringkasan Eksekutif

SmartRecall adalah platform *micro-learning* berbasis AI dengan mekanisme *spaced repetition* (algoritma SM-2), dirancang **offline-first** untuk sekolah di wilayah 3T (Tertinggal, Terdepan, Terluar) dengan konektivitas internet terbatas.

Prinsip inti: **internet hanya dibutuhkan sesaat di sisi guru** (saat generate materi via AI). Setelah itu, seluruh aktivitas belajar siswa (akses materi, flashcard, kuis, review terjadwal) berjalan sepenuhnya di **jaringan lokal (intranet/Wi-Fi hotspot)** tanpa kuota data sama sekali.

Dokumen ini menjadi acuan utama bagi AI coding agent (Antigravity) dan tim developer agar tidak terjadi kesalahpahaman scope, arsitektur, maupun pembagian kerja selama development.

---

## 2. Latar Belakang & Masalah

- Sekolah di wilayah 3T (mis. Maluku Utara, Kalimantan Tengah) mengalami keterbatasan internet dan listrik yang stabil.
- Kurikulum Merdeka menuntut belajar mandiri & reflektif, tapi siswa 3T tidak punya akses ke mekanisme review terstruktur.
- Guru kewalahan menyusun rangkuman/flashcard/bank soal secara manual.
- Solusi EdTech mainstream mensyaratkan koneksi stabil di sisi siswa — model ini **tidak kompatibel** dengan kondisi 3T.

**Insight kunci:** Pusatkan kebutuhan konektivitas hanya di satu titik (guru, saat generate), bukan didistribusikan ke semua siswa.

---

## 2.1 Success Metrics (MVP)

Target terukur untuk validasi keberhasilan MVP saat demo/evaluasi:

| Metrik | Target |
|---|---|
| Waktu generate materi (upload PDF → draft flashcard/rangkuman/soal siap direview) | < 2 menit per materi |
| Tingkat approval draft AI oleh guru tanpa edit besar | ≥ 80% |
| Waktu siswa menyelesaikan 1 sesi review flashcard (per materi) | < 5 menit |
| Kegagalan sesi belajar siswa akibat koneksi ke Local Server Hub putus | 0 (harus tetap bisa lanjut via offline cache) |
| Uptime demo Local Server Hub selama sesi presentasi | 100% (lih. 15.4 Demo Environment) |

> Catatan: angka-angka ini adalah target awal untuk MVP kompetisi, bukan hasil pengukuran final — akan divalidasi ulang saat testing di Fase 6-7.

---

## 3. Tujuan Produk (Goals)

1. Guru dapat mengunggah materi (PDF/modul) dan otomatis menghasilkan flashcard, rangkuman, dan bank soal via AI.
2. Siswa dapat mengakses materi dan review flashcard **tanpa internet**, melalui jaringan lokal sekolah (Wi-Fi hotspot dari Local Server Hub).
3. Sistem menjadwalkan ulang review flashcard secara personal per siswa menggunakan algoritma SM-2.
4. Sistem tetap berfungsi meski internet, listrik, atau koneksi AI tidak stabil (graceful degradation).
5. Guru punya kontrol penuh (human-in-the-loop) atas kualitas konten AI sebelum dipublikasikan ke siswa.

### Non-Goals (Di luar scope MVP)
- Tidak membangun infrastruktur jaringan fisik (satelit, tower, dsb) — itu di luar scope aplikasi.
- Tidak menyediakan video conference / kelas daring real-time.
- Tidak menggantikan LMS penuh (nilai rapor, absensi, dsb) — fokus hanya pada micro-learning & spaced repetition.
- Multi-sekolah/cloud sync antar Local Server Hub **tidak wajib** di MVP (opsional untuk fase berikutnya).

---

## 4. User Persona

| Persona | Kebutuhan | Perangkat |
|---|---|---|
| **Guru** | Upload materi, generate & review konten AI, pantau progres siswa | Laptop/PC (Local Server Hub) |
| **Siswa** | Akses materi, review flashcard harian, kerjakan kuis | HP Android spek rendah / PC lab sekolah |
| **Admin Sekolah** (opsional) | Kelola akun guru/siswa, monitoring server | Local Server Hub |

---

## 5. Arsitektur Sistem (High-Level)

```
[Guru] --upload PDF--> [Local Server Hub]
                              |
                    [Python AI Service (Flask)]
                              | (butuh internet, HANYA di sini)
                    [NVIDIA NIM API - Llama 3.1 8B Instruct]
                              |
                  generate: flashcards, rangkuman, bank soal
                              |
                    [Database Lokal: SQLite/PostgreSQL]
                              |
              [Node.js + Express API (orkestrasi)]
                              |
                  [Wi-Fi Hotspot Lokal / Intranet]
                              |
        [Siswa - React PWA] <---- akses tanpa internet ----
                              |
                  [Review flashcard -> Algoritma SM-2]
                              |
                  [Update jadwal review personal]
```

**Prinsip arsitektur:**
- **Hanya 1 titik yang butuh internet**: proses generate AI oleh guru.
- Semua proses belajar siswa berjalan di jaringan lokal (LAN/Wi-Fi tanpa internet).
- Semua data (materi, progres SM-2, riwayat review) tersimpan lokal — tahan terhadap gangguan listrik/internet.

---

## 6. Tech Stack (sesuai proposal)

| Komponen | Teknologi |
|---|---|
| Backend AI Service | Python, Flask, Flask-CORS, pdfplumber, Sastrawi, requests |
| AI/LLM Engine | NVIDIA NIM API — model Llama 3.1 8B Instruct |
| Main API Backend | Node.js + Express |
| Database | SQLite (default), opsi migrasi PostgreSQL |
| Frontend | React (SPA/PWA), IndexedDB, localStorage (cache offline), Service Worker |
| Algoritma Pembelajaran | SM-2 (SuperMemo 2), diimplementasikan di backend Node.js |
| Jaringan | Wi-Fi Hotspot Lokal (intranet) |

> **Catatan untuk AI Agent:** Gunakan versi library terbaru yang stabil per Juli 2026. Jangan gunakan localStorage/sessionStorage sebagai satu-satunya sumber kebenaran data siswa — gunakan sebagai cache saja; data utama tetap di database lokal (SQLite) via API.

---

## 7. Functional Requirements

### 7.1 Modul Guru
- FR-1: Guru dapat login/registrasi sebagai akun guru di Local Server Hub.
- FR-2: Guru dapat mengunggah materi PDF atau dokumen Kurikulum Merdeka.
- FR-3: Sistem mengekstrak teks dari PDF (pdfplumber) di sisi Python AI Service.
- FR-4: Sistem otomatis memicu proses generate AI untuk KETIGA jenis konten sekaligus (flashcard, rangkuman, bank soal) dari satu file yang sama via NVIDIA NIM API — guru tidak perlu memilih jenis konten satu-satu saat upload. Kegagalan pada sebagian jenis (mis. rate limit) tidak menggagalkan jenis lain yang berhasil.
- FR-5: Sistem mendukung **batch generate** — antrekan beberapa materi, diproses saat koneksi tersedia, tidak blocking siswa yang sedang belajar.
- FR-6: Guru dapat **mereview, mengedit, menyetujui, atau menolak** draft hasil AI sebelum dipublikasikan (human-in-the-loop).
- FR-7: Guru dapat **input manual** flashcard/soal tanpa AI (fallback jika API gagal/limit).
- FR-8: Guru dapat melihat dashboard progres belajar siswa (opsional MVP+).

### 7.2 Modul Siswa
- FR-9: Siswa dapat login menggunakan username & password melalui jaringan lokal (tanpa internet) — autentikasi sepenuhnya diproses oleh `backend-api` di Local Server Hub (bcrypt + JWT), tidak memerlukan OTP/SMS gateway karena tidak ada koneksi internet. Akun siswa (username & password awal) dibuatkan oleh guru/admin sekolah saat onboarding.
- FR-10: Siswa dapat melihat daftar materi yang sudah dipublikasikan guru.
- FR-11: Siswa dapat melakukan sesi review flashcard sesuai jadwal (ditentukan SM-2).
- FR-12: Setiap selesai review kartu, siswa memberi skor kualitas ingatan (0–5).
- FR-13: Siswa dapat mengerjakan bank soal/kuis dari materi yang dipublikasikan.
- FR-14: Aplikasi tetap bisa dibuka meski koneksi ke Local Server Hub sempat terputus (Service Worker + cache offline), lalu sync ulang saat terhubung kembali.

### 7.3 Modul Algoritma SM-2
- FR-15: Sistem menyimpan 3 variabel per kartu per siswa: `repetition_number (n)`, `ease_factor (EF)`, `interval (I)`.
- FR-16: Setelah siswa submit skor kualitas jawaban (q, 0–5):
  - Jika `q < 3`: reset `n = 0`, interval pendek (mis. 1 hari).
  - Jika `q >= 3`: `n += 1`, update `EF`, hitung ulang `interval = interval_sebelumnya * EF`.
- FR-17: Sistem menjadwalkan `next_review_date` otomatis berdasarkan hasil perhitungan di atas.

### 7.4 Modul Sistem/Infrastruktur
- FR-18: Semua data tersimpan di database lokal (SQLite default), tidak bergantung pada cloud.
- FR-19: Sistem menyediakan Wi-Fi Hotspot lokal dari Local Server Hub untuk diakses siswa.
- FR-20: Sistem tahan terhadap listrik mati mendadak — data terakhir tersimpan, proses bisa dilanjutkan tanpa reset progres.

---

## 8. Non-Functional Requirements

| Kategori | Requirement |
|---|---|
| **Offline-first** | Seluruh fitur siswa harus berfungsi tanpa internet, hanya bergantung pada jaringan lokal. |
| **Low-spec device support** | UI harus ringan & responsif di HP Android spesifikasi rendah. |
| **Usability** | UI sederhana, tombol besar, alur linear — untuk siswa dengan literasi digital rendah. |
| **Reliability** | Kegagalan API AI tidak boleh menghentikan proses belajar siswa yang sedang berjalan. |
| **Data integrity** | Progres SM-2 per siswa tidak boleh hilang akibat mati listrik/koneksi. |
| **Scalability** | Arsitektur harus bisa berkembang dari 1 kelas ke banyak sekolah tanpa rombak total (opsi migrasi SQLite → PostgreSQL). |
| **Security** | Autentikasi dasar guru/siswa; data siswa tidak diekspos ke internet publik. |

---

## 9. Data Model (Awal — untuk didiskusikan lebih lanjut oleh tim)

```
User (id, nama, role[guru/siswa], username, password_hash, nis?, kelas_id)
Materi (id, guru_id, judul, file_original, status[draft/published], created_at)
Flashcard (id, materi_id, pertanyaan, jawaban, status[draft/approved])
BankSoal (id, materi_id, pertanyaan, opsi_jawaban, jawaban_benar, status)
Rangkuman (id, materi_id, konten [JSON string berisi blok heading/paragraf/list/contoh/tip], status)
ReviewProgress (id, siswa_id, flashcard_id, repetition_number, ease_factor, interval, next_review_date, last_reviewed_at)
ReviewLog (id, siswa_id, flashcard_id, skor_kualitas, timestamp)
QuizAttempt (id, siswa_id, materi_id, skor_benar, total_soal, jawaban_detail, submitted_at)
```

> AI Agent: skema ini adalah baseline, silakan disesuaikan saat implementasi migrasi database, tapi relasi inti (Materi → Flashcard/BankSoal/Rangkuman, Siswa → ReviewProgress/QuizAttempt) harus dipertahankan.

---

## 10. Struktur Proyek yang Disarankan

```
smartrecall/
├── ai-service/                  # Python AI Service (Flask)
│   ├── app.py
│   ├── requirements.txt
│   ├── services/
│   │   ├── pdf_extractor.py     # pdfplumber logic
│   │   ├── nlp_processor.py     # Sastrawi NLP preprocessing
│   │   └── nim_client.py        # NVIDIA NIM API wrapper
│   ├── routes/
│   │   └── generate.py          # endpoint generate flashcard/rangkuman/soal
│   └── tests/
│
├── backend-api/                 # Node.js + Express (orkestrasi utama)
│   ├── src/
│   │   ├── config/
│   │   │   └── db.js
│   │   ├── models/
│   │   │   ├── User.js
│   │   │   ├── Materi.js
│   │   │   ├── Flashcard.js
│   │   │   ├── BankSoal.js
│   │   │   └── ReviewProgress.js
│   │   ├── controllers/
│   │   │   ├── authController.js
│   │   │   ├── materiController.js
│   │   │   ├── flashcardController.js
│   │   │   └── reviewController.js
│   │   ├── services/
│   │   │   ├── sm2Algorithm.js   # implementasi algoritma SM-2
│   │   │   └── aiServiceClient.js # panggil ai-service via HTTP
│   │   ├── routes/
│   │   │   ├── authRoutes.js
│   │   │   ├── materiRoutes.js
│   │   │   ├── flashcardRoutes.js
│   │   │   └── reviewRoutes.js
│   │   ├── middleware/
│   │   │   └── auth.js
│   │   └── app.js
│   ├── database/
│   │   ├── migrations/
│   │   └── seeds/
│   ├── package.json
│   └── tests/
│
├── frontend-web/                 # React PWA (siswa & guru)
│   ├── public/
│   │   ├── manifest.json
│   │   └── service-worker.js
│   ├── src/
│   │   ├── pages/
│   │   │   ├── guru/
│   │   │   │   ├── UploadMateri.jsx
│   │   │   │   ├── ReviewDraftAI.jsx
│   │   │   │   └── DashboardGuru.jsx
│   │   │   └── siswa/
│   │   │       ├── DaftarMateri.jsx
│   │   │       ├── ReviewFlashcard.jsx
│   │   │       └── KerjakanSoal.jsx
│   │   ├── components/
│   │   ├── services/
│   │   │   └── api.js            # axios instance ke backend-api
│   │   ├── offline/
│   │   │   ├── indexedDbCache.js
│   │   │   └── syncManager.js
│   │   ├── App.jsx
│   │   └── index.jsx
│   ├── package.json
│   └── tests/
│
├── docs/
│   ├── PRD.md                    # dokumen ini
│   ├── ERD.png
│   └── API_SPEC.md
│
├── docker-compose.yml             # opsional: container semua service jadi 1 Local Server Hub
└── README.md
```

---

## 11. Pembagian Kerja Tim (4 Anggota)

### 1. Felly Adhiansyah Putra N. — Project Lead & Backend API (Node.js)
- Memimpin koordinasi tim, timeline, dan integrasi antar modul.
- Membangun **backend-api** (Node.js + Express): routing, auth, orkestrasi request antara frontend, database, dan ai-service.
- Mendesain API contract (endpoint, request/response format) — dituangkan di `docs/API_SPEC.md`.
- Bertanggung jawab atas integrasi akhir (end-to-end testing antar modul).

### 2. Nakulla Athallah H. — AI/Backend Engineer (Python AI Service)
- Membangun **ai-service** (Flask): ekstraksi teks PDF (pdfplumber), preprocessing NLP Bahasa Indonesia (Sastrawi).
- Integrasi ke **NVIDIA NIM API** (Llama 3.1 8B Instruct) untuk generate flashcard, rangkuman, dan bank soal.
- Implementasi mekanisme **batch generate** dan retry/error handling saat API gagal atau rate-limited.
- Menulis prompt engineering untuk kualitas output AI yang konsisten dan sesuai kurikulum.

### 3. Ida Bagus Adi Raditya P. — Frontend Engineer (React PWA)
- Membangun **frontend-web**: UI guru (upload materi, review draft AI) dan UI siswa (daftar materi, review flashcard, kuis).
- Implementasi **offline-first**: Service Worker, IndexedDB caching, sinkronisasi ulang saat koneksi ke Local Server Hub kembali tersedia.
- Fokus pada UX sederhana untuk siswa dengan literasi digital rendah (tombol besar, alur linear, UI ringan untuk HP spek rendah).

### 4. M. Haidar Zaki — Database Engineer & Algorithm Specialist (SM-2 + Infra)
- Merancang skema database (SQLite, dengan opsi migrasi PostgreSQL) dan migrations/seeds.
- Mengimplementasikan **algoritma SM-2** (perhitungan repetition number, ease factor, interval) di layer backend.
- Setup **Local Server Hub** (konfigurasi Wi-Fi hotspot lokal, deployment lokal, opsional Docker Compose).
- Menangani strategi ketahanan data (data persistence saat listrik/koneksi terputus) dan testing skenario risiko (lih. bagian 12).

> Catatan: pembagian ini bisa saling overlap saat butuh pair-programming (misal integrasi backend-api ↔ ai-service butuh kerja sama Felly & Nakulla). Gunakan pembagian ini sebagai *default ownership*, bukan silo yang kaku.

---

## 12. Risiko & Mitigasi (ringkasan dari proposal, wajib diimplementasikan)

| Risiko | Mitigasi yang harus diimplementasikan |
|---|---|
| Internet guru tidak stabil saat generate AI | Batch generate berjalan async/background job, tidak blocking siswa |
| API AI gagal/limit | Guru bisa input flashcard/soal manual sebagai fallback |
| Hasil AI kurang akurat | Semua output AI berstatus draft, wajib approval guru sebelum publish |
| Perangkat siswa terbatas | Progres tersimpan di server (bukan device), bisa lanjut dari device manapun |
| Listrik tidak stabil | Semua data tersimpan lokal, auto-resume tanpa reset progres |
| Siswa belum melek teknologi | UI sederhana, tombol besar, onboarding singkat |

---

## 13. Milestone Pengembangan (Saran, disesuaikan timeline lomba)

| Fase | Deliverable | Acceptance Criteria (kapan dianggap "selesai") |
|---|---|---|
| **Fase 1 — Setup & Skeleton** | Struktur project, database schema, koneksi antar service (backend-api ↔ ai-service ↔ frontend) | Ketiga service bisa saling ping/health-check; migration awal jalan tanpa error; frontend bisa hit 1 endpoint dummy dari backend-api |
| **Fase 2 — Core Guru Flow** | Upload PDF → ekstraksi teks → generate AI → review/approve draft | Guru bisa upload PDF, dapat draft flashcard/rangkuman/soal, bisa edit/approve/reject, dan status materi berubah jadi "published" |
| **Fase 3 — Core Siswa Flow** | Login siswa, akses materi, review flashcard dasar (tanpa SM-2 dulu) | Siswa bisa login, lihat daftar materi published, buka & lihat isi 1 flashcard, submit skor kualitas (0-5) — belum perlu penjadwalan otomatis |
| **Fase 4 — Algoritma SM-2** | Implementasi penuh SM-2 + jadwal review otomatis | Setelah submit skor, `next_review_date` terupdate sesuai rumus SM-2 dan tervalidasi lewat unit test (lih. 15.5) |
| **Fase 5 — Offline-First** | Service Worker + IndexedDB cache read-only untuk materi/flashcard, submit queue sederhana untuk hasil review saat koneksi ke Local Server Hub putus | Aplikasi siswa tetap bisa dibuka & flashcard tetap bisa direview saat koneksi ke Local Server Hub terputus sementara; hasil review tersimpan di queue lokal dan otomatis ter-sync begitu koneksi kembali |
| **Fase 6 — Hardening** | Fallback manual input, error handling, testing skenario risiko (listrik/internet mati) | Guru tetap bisa input flashcard manual saat AI service down; server displaced power/restart tidak menghilangkan draft/progres yang sudah tersimpan (lih. 15.5 skenario uji) |
| **Fase 7 — Polish & Demo Prep** | UI polish, seed data demo, dry-run presentasi | Seed data demo siap; dry-run end-to-end (guru upload → siswa review) berhasil minimal 2x tanpa error di environment demo (lih. 15.4) |

---

## 14. Catatan untuk AI Coding Agent (Antigravity)

- **Selalu prioritaskan prinsip offline-first**: jangan menambahkan dependency yang mengharuskan koneksi internet aktif di sisi siswa.
- Saat membuat fitur baru, pastikan **tidak menghilangkan fallback manual** (guru tetap bisa input manual tanpa AI).
- Gunakan environment variable untuk API key NVIDIA NIM — jangan hardcode credential di source code.
- Ikuti struktur folder pada bagian 10 kecuali ada alasan teknis kuat untuk menyimpang — jika menyimpang, dokumentasikan alasannya di `docs/`.
- Setiap perubahan pada skema database harus disertai file migration, bukan mengubah langsung skema produksi.
- Tulis test dasar (unit/integration) untuk logika algoritma SM-2 karena ini komponen paling kritikal secara akademis/teknis.

---

## 15. Catatan Tambahan (Kelengkapan MVP)

### 15.1 Privasi & Data Anak
- Data siswa yang disimpan dibatasi seminimal mungkin: nama/NIS, kelas, dan progres belajar (SM-2, riwayat review). Tidak ada pengumpulan data pribadi sensitif lain (kontak, alamat, dsb).
- Seluruh data siswa tersimpan di database lokal (SQLite) di Local Server Hub milik sekolah — tidak pernah dikirim ke internet publik atau pihak ketiga di luar proses generate AI oleh guru (yang hanya memproses materi ajar, bukan data siswa).
- Sekolah bertindak sebagai penanggung jawab data (data controller); akses ke database dibatasi untuk akun guru/admin sekolah saja.

### 15.2 Rubrik Approval Guru (pelengkap FR-6)
Saat mereview draft AI, guru mengecek minimal 3 hal sebelum approve:
1. **Akurasi faktual** — isi tidak mengandung kesalahan konsep/fakta.
2. **Kesesuaian level & kurikulum** — bahasa dan kedalaman materi sesuai jenjang kelas.
3. **Kejelasan bahasa** — pertanyaan/jawaban tidak ambigu atau membingungkan siswa.

### 15.3 Biaya & Rate Limit AI (NVIDIA NIM API)
- MVP menggunakan **free tier / credit NVIDIA NIM** — belum ada biaya berjalan yang ditanggung sekolah di fase kompetisi ini.
- Karena free tier punya rate limit, mekanisme **batch generate** (FR-5) berfungsi ganda: selain agar tidak blocking siswa, juga mencegah request beruntun yang cepat menghabiskan quota.
- Fallback manual input (FR-7) menjadi mitigasi utama kalau quota/limit free tier tercapai saat demo atau pemakaian nyata.
- Catatan untuk pasca-kompetisi (di luar MVP): perlu evaluasi ulang biaya jika API key production/berbayar digunakan skala sekolah nyata — belum dibahas di dokumen ini.

### 15.4 Demo Environment
- Local Server Hub disimulasikan dengan 1 laptop menjalankan seluruh service (ai-service, backend-api, frontend), terhubung ke hotspot Wi-Fi lokal (dari laptop/HP) tanpa internet aktif di sisi siswa.
- Minimal 2 device siswa (disarankan HP Android low-end) connect ke hotspot yang sama untuk menunjukkan akses multi-device secara bersamaan.
- Skenario demo disarankan: guru upload & approve materi (koneksi internet aktif sesaat) → matikan/putuskan internet → siswa tetap bisa login & review flashcard via jaringan lokal saja.

### 15.5 Testing Skenario Risiko (pelengkap Bagian 12 & 14)
Selain unit test SM-2, tim melakukan pengujian manual minimal untuk skenario berikut sebelum demo:
- Koneksi antara siswa dan Local Server Hub diputus di tengah sesi review → aplikasi siswa tetap terbuka, hasil review masuk queue offline, sync otomatis saat koneksi kembali.
- Local Server Hub dimatikan mendadak (simulasi listrik mati) saat ada draft/progress belum tersimpan penuh → data terakhir yang sudah ter-commit ke database tidak hilang saat server dinyalakan ulang.
- API AI (NVIDIA NIM) gagal/limit saat guru generate materi → guru tetap bisa lanjut dengan input manual (FR-7) tanpa aplikasi crash.

---

*Dokumen ini adalah living document — update sesuai perkembangan diskusi tim dan temuan teknis selama development.*