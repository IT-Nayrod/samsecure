// ProtectedRoute - Section 2 Specs UX v0.5
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import useAuth from '../../hooks/useAuth';

export default function ProtectedRoute({ allowedProfils }) {
  const { isAuthenticated, isLoading, profil } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-800" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedProfils && !allowedProfils.includes(profil)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <Outlet />;
}
