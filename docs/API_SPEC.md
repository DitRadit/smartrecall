# API Spec — SmartRecall backend-api

> Ringkasan kontrak API sesuai `ARCHITECTURE.md` bagian 3.3. Base URL default: `http://localhost:3000`.
> Semua endpoint (kecuali `/auth/*` dan `/health`) butuh header `Authorization: Bearer <token>`.

## Auth

Semua role (guru & siswa) login dengan username + password. Akun dibuatkan
oleh guru/admin sekolah saat onboarding (bukan self-registration terbuka),
sesuai PRD.md FR-9 (direvisi) & 15.1.

### POST /auth/register-guru
Body: `{ "nama": "...", "username": "...", "password": "..." }`
Response 201: `{ "token": "...", "user": { "id", "nama", "role", "username" } }`

### POST /auth/register-siswa
Body: `{ "nama": "...", "username": "...", "password": "...", "nis": "... (opsional)", "kelasId": "... (opsional)" }`
Response 201: `{ "token": "...", "user": { "id", "nama", "role", "username", "nis" } }`

### POST /auth/login
Body: `{ "username": "...", "password": "..." }` — dipakai guru maupun siswa.
Response 200: `{ "token": "...", "user": {...} }`

## Materi (guru)

### POST /materi/upload
`multipart/form-data`: `file` (PDF), `judul`
Auth: role `guru`
Response 202: `{ "message": "...", "materi": { "id", "judul", "status" } }`

**Guru tidak memilih jenis konten.** Satu kali upload otomatis memicu generate
KETIGA jenis konten sekaligus (flashcard, rangkuman, bank soal) dari file yang
sama — ai-service melakukan 1x ekstraksi PDF lalu 3x panggilan LLM (lihat
ARCHITECTURE.md 3.1). Proses berjalan async di background; status materi tetap
`draft` sampai guru approve. Jika salah satu jenis gagal (mis. rate limit),
jenis lain yang berhasil tetap disimpan — guru bisa lihat status di halaman
review draft.

### GET /materi
Auth: guru atau siswa. Guru melihat semua materi miliknya; siswa hanya melihat yang `published`.
Response 200: `{ "materi": [{ "id", "judul", "status", "createdAt" }] }`

### GET /materi/:id/draft
Auth: role `guru`, hanya materi miliknya sendiri. **Bukan untuk siswa** — siswa
mengambil soal lewat `GET /soal/materi/:id` dan rangkuman lewat
`GET /rangkuman/materi/:id` di bawah (endpoint terpisah, ditambahkan setelah
ditemukan siswa sebelumnya salah memakai endpoint ini dan selalu mendapat 403).
Response 200: `{ "materi": { ...,"flashcards": [...draft], "bankSoal": [...draft], "rangkuman": {...draft} } }`

### POST /materi/:id/approve
Auth: role `guru`.
Body: `{ "action": "approve|reject", "flashcard_edits": [{ "id", "pertanyaan", "jawaban" }] }`
Response 200: `{ "message": "Materi berhasil di-approve" }`
Approve/reject juga berlaku untuk `rangkuman` materi tersebut (satu transaksi).

## Soal / Kuis (siswa) — FR-13

### GET /soal/materi/:id
Auth: siswa/guru. Materi harus berstatus `published`.
Response 200: `{ "materi_id", "judul", "soal": [{ "id", "pertanyaan", "opsi_jawaban" }] }`
`jawaban_benar` sengaja TIDAK dikirim ke klien (dievaluasi di server saat submit).

### POST /soal/submit
Auth: role `siswa`.
Body: `{ "materi_id": 1, "jawaban": [{ "soal_id": 1, "jawaban_dipilih": "A" }] }`
Response 201: `{ "attempt_id", "skor_benar", "total_soal", "detail": [...] }`
Skor dihitung & divalidasi di server (bukan dipercaya dari klien), lalu
disimpan sebagai `QuizAttempt` agar hasil persisten. Sesuai ARCHITECTURE.md
3.2, jika koneksi terputus saat submit, `syncManager.js` menyimpan ke offline
queue dan otomatis retry saat koneksi kembali.

### GET /soal/riwayat/:siswa_id
Auth: siswa (miliknya sendiri) atau guru.
Response 200: `{ "attempts": [{ "id", "materi": {"judul"}, "skorBenar", "totalSoal", "submittedAt" }] }`

## Rangkuman (siswa)

### GET /rangkuman/materi/:id
Auth: siswa/guru. Materi harus `published` dan rangkuman berstatus `approved`.
Response 200: `{ "materi_id", "judul", "rangkuman": { "id", "konten" } }`
`konten` adalah **JSON string** berisi array blok konten terstruktur
(`paragraf`/`heading`/`list`/`contoh`/`tip`) -- lihat skema lengkap di
ARCHITECTURE.md 6.2. Frontend wajib `JSON.parse()` sebelum render (lihat
`src/components/RangkumanBlocks.jsx`), dengan fallback ke prosa biasa untuk
data lama yang belum bermigrasi ke skema ini.
Response 404 jika rangkuman belum tersedia/belum di-approve guru.

## Flashcard (guru, fallback manual — FR-7)

### POST /flashcard/manual
Auth: role `guru`.
Body: `{ "materi_id": 1, "pertanyaan": "...", "jawaban": "..." }`
Response 201: `{ "flashcard": {...} }`

## Review (siswa)

### POST /review
Auth: role `siswa`.
Body: `{ "flashcard_id": 1, "skor_kualitas": 0-5 }`
Response 200: `{ "progress": { "repetitionNumber", "easeFactor", "interval", "nextReviewDate" } }`

Endpoint ini adalah tujuan akhir offline queue frontend — dipanggil baik saat
submit langsung maupun saat sync ulang oleh `syncManager.js`.

### GET /review/schedule/:siswa_id
Auth: role `siswa`, hanya untuk `siswa_id` miliknya sendiri.
Response 200: `{ "due_for_review": [...ReviewProgress+flashcard], "new_flashcards": [...Flashcard] }`

## Health

### GET /health
Tidak butuh auth. Mengembalikan status backend-api + status ai-service (informasional).
