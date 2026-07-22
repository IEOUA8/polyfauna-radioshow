import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';

function RouteLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#050505]">
      <div className="text-center">
        <Loader2 className="w-12 h-12 text-orange-500 animate-spin mx-auto mb-4" />
        <p className="text-gray-400">Loading...</p>
      </div>
    </div>
  );
}

const ProtectedRoute = ({ children, requireAdmin = false, allowedRoles = null }) => {
  const { currentUser, userRole, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <RouteLoader />;
  }

  if (!currentUser) {
    const next = `${location.pathname}${location.search}`;
    return <Navigate to={`/login?next=${encodeURIComponent(next)}`} replace />;
  }

  // En una recarga o reanudación móvil, Supabase puede restaurar primero el
  // usuario y completar el perfil/rol unos milisegundos después. No debemos
  // interpretar ese estado intermedio como un rol sin acceso y expulsarlo a
  // Inicio; esperamos a que AuthContext termine de hidratar userRole.
  if (userRole == null && (requireAdmin || allowedRoles)) {
    return <RouteLoader />;
  }

  if (requireAdmin && userRole !== 'admin') {
    return <Navigate to="/" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(userRole)) {
    return <Navigate to="/" replace />;
  }

  return children;
};

export default ProtectedRoute;
