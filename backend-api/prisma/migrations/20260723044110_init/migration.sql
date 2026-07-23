/*
  Warnings:

  - You are about to alter the column `kelas_id` on the `users` table. The data in that column could be lost. The data in that column will be cast from `String` to `Int`.

*/
-- CreateTable
CREATE TABLE "activity_logs" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "user_id" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "description" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "activity_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "kelas" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nama" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_groups" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "guru_id" INTEGER NOT NULL,
    "nama" TEXT NOT NULL,
    "parent_id" INTEGER,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "groups_guru_id_fkey" FOREIGN KEY ("guru_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "groups_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "groups" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_groups" ("created_at", "guru_id", "id", "nama", "parent_id") SELECT "created_at", "guru_id", "id", "nama", "parent_id" FROM "groups";
DROP TABLE "groups";
ALTER TABLE "new_groups" RENAME TO "groups";
CREATE TABLE "new_materi" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "guru_id" INTEGER NOT NULL,
    "group_id" INTEGER,
    "judul" TEXT NOT NULL,
    "file_original" TEXT NOT NULL,
    "ppt_file" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "materi_guru_id_fkey" FOREIGN KEY ("guru_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "materi_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_materi" ("created_at", "file_original", "group_id", "guru_id", "id", "judul", "ppt_file", "status") SELECT "created_at", "file_original", "group_id", "guru_id", "id", "judul", "ppt_file", "status" FROM "materi";
DROP TABLE "materi";
ALTER TABLE "new_materi" RENAME TO "materi";
CREATE TABLE "new_materi_access" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "siswa_id" INTEGER NOT NULL,
    "materi_id" INTEGER NOT NULL,
    "granted_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "materi_access_siswa_id_fkey" FOREIGN KEY ("siswa_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "materi_access_materi_id_fkey" FOREIGN KEY ("materi_id") REFERENCES "materi" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_materi_access" ("granted_at", "id", "materi_id", "siswa_id") SELECT "granted_at", "id", "materi_id", "siswa_id" FROM "materi_access";
DROP TABLE "materi_access";
ALTER TABLE "new_materi_access" RENAME TO "materi_access";
CREATE UNIQUE INDEX "materi_access_siswa_id_materi_id_key" ON "materi_access"("siswa_id", "materi_id");
CREATE TABLE "new_quiz_attempts" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "siswa_id" INTEGER NOT NULL,
    "materi_id" INTEGER NOT NULL,
    "skor_benar" INTEGER NOT NULL,
    "total_soal" INTEGER NOT NULL,
    "jawaban_detail" TEXT NOT NULL,
    "submitted_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "quiz_attempts_siswa_id_fkey" FOREIGN KEY ("siswa_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "quiz_attempts_materi_id_fkey" FOREIGN KEY ("materi_id") REFERENCES "materi" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_quiz_attempts" ("id", "jawaban_detail", "materi_id", "siswa_id", "skor_benar", "submitted_at", "total_soal") SELECT "id", "jawaban_detail", "materi_id", "siswa_id", "skor_benar", "submitted_at", "total_soal" FROM "quiz_attempts";
DROP TABLE "quiz_attempts";
ALTER TABLE "new_quiz_attempts" RENAME TO "quiz_attempts";
CREATE TABLE "new_rangkuman_read" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "rangkuman_id" INTEGER NOT NULL,
    "siswa_id" INTEGER NOT NULL,
    "read_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "rangkuman_read_rangkuman_id_fkey" FOREIGN KEY ("rangkuman_id") REFERENCES "rangkuman" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "rangkuman_read_siswa_id_fkey" FOREIGN KEY ("siswa_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_rangkuman_read" ("id", "rangkuman_id", "read_at", "siswa_id") SELECT "id", "rangkuman_id", "read_at", "siswa_id" FROM "rangkuman_read";
DROP TABLE "rangkuman_read";
ALTER TABLE "new_rangkuman_read" RENAME TO "rangkuman_read";
CREATE UNIQUE INDEX "rangkuman_read_rangkuman_id_siswa_id_key" ON "rangkuman_read"("rangkuman_id", "siswa_id");
CREATE TABLE "new_review_log" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "siswa_id" INTEGER NOT NULL,
    "flashcard_id" INTEGER NOT NULL,
    "skor_kualitas" INTEGER NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "review_log_siswa_id_fkey" FOREIGN KEY ("siswa_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "review_log_flashcard_id_fkey" FOREIGN KEY ("flashcard_id") REFERENCES "flashcards" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_review_log" ("created_at", "flashcard_id", "id", "siswa_id", "skor_kualitas") SELECT "created_at", "flashcard_id", "id", "siswa_id", "skor_kualitas" FROM "review_log";
DROP TABLE "review_log";
ALTER TABLE "new_review_log" RENAME TO "review_log";
CREATE TABLE "new_review_progress" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "siswa_id" INTEGER NOT NULL,
    "flashcard_id" INTEGER NOT NULL,
    "repetition_number" INTEGER NOT NULL DEFAULT 0,
    "ease_factor" REAL NOT NULL DEFAULT 2.5,
    "interval" INTEGER NOT NULL DEFAULT 0,
    "next_review_date" DATETIME NOT NULL,
    "last_reviewed_at" DATETIME,
    CONSTRAINT "review_progress_siswa_id_fkey" FOREIGN KEY ("siswa_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "review_progress_flashcard_id_fkey" FOREIGN KEY ("flashcard_id") REFERENCES "flashcards" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_review_progress" ("ease_factor", "flashcard_id", "id", "interval", "last_reviewed_at", "next_review_date", "repetition_number", "siswa_id") SELECT "ease_factor", "flashcard_id", "id", "interval", "last_reviewed_at", "next_review_date", "repetition_number", "siswa_id" FROM "review_progress";
DROP TABLE "review_progress";
ALTER TABLE "new_review_progress" RENAME TO "review_progress";
CREATE UNIQUE INDEX "review_progress_siswa_id_flashcard_id_key" ON "review_progress"("siswa_id", "flashcard_id");
CREATE TABLE "new_users" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nama" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "nis" TEXT,
    "kelas_id" INTEGER,
    "active_group_id" INTEGER,
    "active_kelas_id" INTEGER,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_sync_at" DATETIME,
    CONSTRAINT "users_kelas_id_fkey" FOREIGN KEY ("kelas_id") REFERENCES "kelas" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "users_active_group_id_fkey" FOREIGN KEY ("active_group_id") REFERENCES "groups" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "users_active_kelas_id_fkey" FOREIGN KEY ("active_kelas_id") REFERENCES "kelas" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_users" ("active_group_id", "created_at", "id", "kelas_id", "last_sync_at", "nama", "nis", "password_hash", "role", "username") SELECT "active_group_id", "created_at", "id", "kelas_id", "last_sync_at", "nama", "nis", "password_hash", "role", "username" FROM "users";
DROP TABLE "users";
ALTER TABLE "new_users" RENAME TO "users";
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");
CREATE UNIQUE INDEX "users_nis_key" ON "users"("nis");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "kelas_nama_key" ON "kelas"("nama");
