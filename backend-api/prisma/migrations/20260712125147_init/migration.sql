-- CreateTable
CREATE TABLE "users" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nama" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "nis" TEXT,
    "kelas_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "materi" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "guru_id" INTEGER NOT NULL,
    "judul" TEXT NOT NULL,
    "file_original" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "materi_guru_id_fkey" FOREIGN KEY ("guru_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "flashcards" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "materi_id" INTEGER NOT NULL,
    "pertanyaan" TEXT NOT NULL,
    "jawaban" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "flashcards_materi_id_fkey" FOREIGN KEY ("materi_id") REFERENCES "materi" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "bank_soal" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "materi_id" INTEGER NOT NULL,
    "pertanyaan" TEXT NOT NULL,
    "opsi_jawaban" TEXT NOT NULL,
    "jawaban_benar" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "bank_soal_materi_id_fkey" FOREIGN KEY ("materi_id") REFERENCES "materi" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "review_progress" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "siswa_id" INTEGER NOT NULL,
    "flashcard_id" INTEGER NOT NULL,
    "repetition_number" INTEGER NOT NULL DEFAULT 0,
    "ease_factor" REAL NOT NULL DEFAULT 2.5,
    "interval" INTEGER NOT NULL DEFAULT 0,
    "next_review_date" DATETIME NOT NULL,
    "last_reviewed_at" DATETIME,
    CONSTRAINT "review_progress_siswa_id_fkey" FOREIGN KEY ("siswa_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "review_progress_flashcard_id_fkey" FOREIGN KEY ("flashcard_id") REFERENCES "flashcards" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "review_log" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "siswa_id" INTEGER NOT NULL,
    "flashcard_id" INTEGER NOT NULL,
    "skor_kualitas" INTEGER NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "review_log_siswa_id_fkey" FOREIGN KEY ("siswa_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "review_log_flashcard_id_fkey" FOREIGN KEY ("flashcard_id") REFERENCES "flashcards" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "rangkuman" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "materi_id" INTEGER NOT NULL,
    "konten" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "rangkuman_materi_id_fkey" FOREIGN KEY ("materi_id") REFERENCES "materi" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "rangkuman_read" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "rangkuman_id" INTEGER NOT NULL,
    "siswa_id" INTEGER NOT NULL,
    "read_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "rangkuman_read_rangkuman_id_fkey" FOREIGN KEY ("rangkuman_id") REFERENCES "rangkuman" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "rangkuman_read_siswa_id_fkey" FOREIGN KEY ("siswa_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "quiz_attempts" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "siswa_id" INTEGER NOT NULL,
    "materi_id" INTEGER NOT NULL,
    "skor_benar" INTEGER NOT NULL,
    "total_soal" INTEGER NOT NULL,
    "jawaban_detail" TEXT NOT NULL,
    "submitted_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "quiz_attempts_siswa_id_fkey" FOREIGN KEY ("siswa_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "quiz_attempts_materi_id_fkey" FOREIGN KEY ("materi_id") REFERENCES "materi" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "users_nis_key" ON "users"("nis");

-- CreateIndex
CREATE UNIQUE INDEX "review_progress_siswa_id_flashcard_id_key" ON "review_progress"("siswa_id", "flashcard_id");

-- CreateIndex
CREATE UNIQUE INDEX "rangkuman_materi_id_key" ON "rangkuman"("materi_id");

-- CreateIndex
CREATE UNIQUE INDEX "rangkuman_read_rangkuman_id_siswa_id_key" ON "rangkuman_read"("rangkuman_id", "siswa_id");
