/**
 * authContext.jsx - Menyimpan sesi login (token + user) di memori + localStorage
 * (localStorage di sini hanya untuk token sesi, BUKAN data belajar siswa --
 * data belajar tetap di backend-api/SQLite, sesuai ARCHITECTURE.md prinsip #3).
 */

import { createContext, useContext, useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import api from './api';

const AuthContext = createContext(null);

const TOKEN_KEY = 'smartrecall_token';
const USER_KEY = 'smartrecall_user';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem(USER_KEY);
    return stored ? JSON.parse(stored) : null;
  });

  const [socket, setSocket] = useState(null);

  useEffect(() => {
    if (user) {
      localStorage.setItem(USER_KEY, JSON.stringify(user));
      const token = localStorage.getItem(TOKEN_KEY);
      if (token && !socket) {
        const newSocket = io(import.meta.env.VITE_API_URL || 'http://localhost:3000', {
          auth: { token }
        });
        setSocket(newSocket);
      }
    } else {
      localStorage.removeItem(USER_KEY);
      if (socket) {
        socket.disconnect();
        setSocket(null);
      }
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
    <AuthContext.Provider value={{ user, login, logout, socket }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth harus dipakai di dalam AuthProvider');
  return ctx;
}
