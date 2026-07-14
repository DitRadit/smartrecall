import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './services/authContext';
import PrivateRoute from './components/PrivateRoute';
import Layout from './components/Layout';

import Login from './pages/Login';
import UploadMateri from './pages/guru/UploadMateri';
import ReviewDraftAI from './pages/guru/ReviewDraftAI';
import DashboardGuru from './pages/guru/DashboardGuru';
import DaftarMateri from './pages/siswa/DaftarMateri';
import ReviewFlashcard from './pages/siswa/ReviewFlashcard';
import KerjakanSoal from './pages/siswa/KerjakanSoal';
import Rangkuman from './pages/siswa/Rangkuman';
import Profil from './pages/Profil';

/**
 * App.jsx - Routing dibedakan role guru/siswa (PRD.md bagian 10, ARCHITECTURE.md).
 */
export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Layout>
          <Routes>
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="/login" element={<Login />} />

            <Route
              path="/profil"
              element={
                <PrivateRoute>
                  <Profil />
                </PrivateRoute>
              }
            />

            {/* Rute Guru */}
            <Route
              path="/guru/dashboard"
              element={
                <PrivateRoute role="guru">
                  <DashboardGuru />
                </PrivateRoute>
              }
            />
            <Route
              path="/guru/upload"
              element={
                <PrivateRoute role="guru">
                  <UploadMateri />
                </PrivateRoute>
              }
            />
            <Route
              path="/guru/review/:id"
              element={
                <PrivateRoute role="guru">
                  <ReviewDraftAI />
                </PrivateRoute>
              }
            />

            {/* Rute Siswa */}
            <Route
              path="/siswa/materi"
              element={
                <PrivateRoute role="siswa">
                  <DaftarMateri />
                </PrivateRoute>
              }
            />
            <Route
              path="/siswa/review/:id"
              element={
                <PrivateRoute role="siswa">
                  <ReviewFlashcard />
                </PrivateRoute>
              }
            />
            <Route
              path="/siswa/soal/:id"
              element={
                <PrivateRoute role="siswa">
                  <KerjakanSoal />
                </PrivateRoute>
              }
            />
            <Route
              path="/siswa/rangkuman/:id"
              element={
                <PrivateRoute role="siswa">
                  <Rangkuman />
                </PrivateRoute>
              }
            />
          </Routes>
        </Layout>
      </BrowserRouter>
    </AuthProvider>
  );
}
