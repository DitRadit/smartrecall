-- CreateTable
CREATE TABLE "materi_access" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "siswa_id" INTEGER NOT NULL,
    "materi_id" INTEGER NOT NULL,
    "granted_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "materi_access_siswa_id_fkey" FOREIGN KEY ("siswa_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "materi_access_materi_id_fkey" FOREIGN KEY ("materi_id") REFERENCES "materi" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "materi_access_siswa_id_materi_id_key" ON "materi_access"("siswa_id", "materi_id");
