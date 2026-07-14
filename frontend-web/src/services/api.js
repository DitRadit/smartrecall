/**
 * api.js - Axios instance ke backend-api.
 *
 * PENTING (ARCHITECTURE.md bagian 6): frontend-web HANYA boleh memanggil
 * backend-api. Jangan pernah menambahkan call langsung ke ai-service di sini
 * atau di komponen manapun.
 */

import axios from 'axios';

const BACKEND_API_URL = import.meta.env.VITE_BACKEND_API_URL || 'http://localhost:3000';

const api = axios.create({
  baseURL: BACKEND_API_URL,
  timeout: 10000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('smartrecall_token'); // hanya token sesi, bukan data siswa
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
