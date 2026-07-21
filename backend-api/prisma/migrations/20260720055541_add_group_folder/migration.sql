-- CreateTable
CREATE TABLE "groups" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "guru_id" INTEGER NOT NULL,
    "nama" TEXT NOT NULL,
    "parent_id" INTEGER,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "groups_guru_id_fkey" FOREIGN KEY ("guru_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "groups_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "groups" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_materi" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "guru_id" INTEGER NOT NULL,
    "group_id" INTEGER,
    "judul" TEXT NOT NULL,
    "file_original" TEXT NOT NULL,
    "ppt_file" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "materi_guru_id_fkey" FOREIGN KEY ("guru_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "materi_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_materi" ("created_at", "file_original", "guru_id", "id", "judul", "ppt_file", "status") SELECT "created_at", "file_original", "guru_id", "id", "judul", "ppt_file", "status" FROM "materi";
DROP TABLE "materi";
ALTER TABLE "new_materi" RENAME TO "materi";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
