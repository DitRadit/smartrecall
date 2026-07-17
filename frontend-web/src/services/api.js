/**
 * api.js - Axios instance ke backend-api.
 *
 * PENTING (ARCHITECTURE.md bagian 6): frontend-web HANYA boleh memanggil
 * backend-api. Jangan pernah menambahkan call langsung ke ai-service di sini
 * atau di komponen manapun.
 */

import axios from 'axios';

function resolveBackendApiUrl() {
  const configuredUrl = import.meta.env.VITE_BACKEND_API_URL;
  if (!configuredUrl || typeof window === 'undefined') {
    return configuredUrl || 'http://localhost:3000';
  }

  const pageHost = window.location.hostname;
  const isPageLocalhost = pageHost === 'localhost' || pageHost === '127.0.0.1';

  try {
    const url = new URL(configuredUrl);
    const isConfiguredLocalhost = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
    if (isConfiguredLocalhost && !isPageLocalhost) {
      return `${url.protocol}//${pageHost}:3000`;
    }
  } catch (error) {
    return configuredUrl;
  }

  return configuredUrl;
}

const BACKEND_API_URL = resolveBackendApiUrl();

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
