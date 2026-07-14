# Migrations

Folder ini akan berisi history migration Prisma.

Migration awal BELUM di-generate di skeleton ini (butuh koneksi ke SQLite
engine saat `prisma migrate dev` dijalankan). Jalankan perintah berikut
setelah `npm install` untuk membuat migration pertama:

```bash
npx prisma migrate dev --name init
```

Ini akan membuat file database SQLite di `database/dev.db` (sesuai
`DATABASE_URL` di `.env`) dan folder migration baru di sini.

**Aturan wajib (ARCHITECTURE.md bagian 8):** setiap perubahan skema
(`prisma/schema.prisma`) harus disertai migration baru lewat
`prisma migrate dev --name <deskripsi_perubahan>`, jangan pernah edit
skema database secara langsung.
