/**
 * authContext.jsx - Menyimpan sesi login (token + user) di memori + localStorage
 * (localStorage di sini hanya untuk token sesi, BUKAN data belajar siswa --
 * data belajar tetap di backend-api/SQLite, sesuai ARCHITECTURE.md prinsip #3).
 */

import { createContext, useContext, useState, useEffect } from 'react';
import api from './api';

const AuthContext = createContext(null);

const TOKEN_KEY = 'smartrecall_token';
const USER_KEY = 'smartrecall_user';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem(USER_KEY);
    return stored ? JSON.parse(stored) : null;
  });

  useEffect(() => {
    if (user) {
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(USER_KEY);
    }
  }, [user]);

  async function login(username, password) {
    const response = await api.post('/auth/login', { username: username.trim(), password });
    localStorage.setItem(TOKEN_KEY, response.data.token);
    setUser(response.data.user);
    return response.data.user;
  }

  function logout() {
    localStorage.removeItem(TOKEN_KEY);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth harus dipakai di dalam AuthProvider');
  return ctx;
}
