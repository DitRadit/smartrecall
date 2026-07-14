import { Navigate } from 'react-router-dom';
import { useAuth } from '../services/authContext';

/**
 * PrivateRoute - Membatasi akses halaman berdasarkan role (guru/siswa),
 * sesuai routing yang dibedakan role di frontend-web (lihat PRD.md bagian 10).
 */
export default function PrivateRoute({ role, children }) {
  const { user } = useAuth();

  if (!user) {
    return <Navigate to="/login" replace />;
  }
  if (role && user.role !== role) {
    return <Navigate to="/" replace />;
  }
  return children;
}
