import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';

// Catatan: Service Worker di sini ditulis manual (public/service-worker.js)
// sesuai struktur folder di ARCHITECTURE.md/PRD.md, bukan auto-generated,
// supaya logika cache-first & offline queue mudah diaudit langsung.
export default defineConfig({
  plugins: [
    react(),
    // basicSsl() // UNCOMMENT baris ini untuk menyalakan mode HTTPS saat development
  ],
  server: {
    port: 5173,
  },
  build: {
    outDir: 'dist',
  },
  test: {
    environment: 'jsdom', // dibutuhkan karena api.js & offline modules memakai localStorage/IndexedDB layaknya browser
    setupFiles: ['./tests/setup.js'],
    globals: true,
  },
});
