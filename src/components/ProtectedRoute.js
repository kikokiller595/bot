import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import '../App.css';

function ProtectedRoute({ children, adminOnly = false }) {
  const { isAuthenticated, isAdmin, loading } = useAuth();

  if (loading) {
    return (
      <div className="app-splash">
        <div className="app-splash-card">
          <span className="app-splash-kicker">Validando acceso</span>
          <h1>Comprobando permisos</h1>
          <p>Estamos verificando tu sesion para entrar al modulo solicitado.</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (adminOnly && !isAdmin()) {
    return (
      <div className="app-splash">
        <div className="app-splash-card app-splash-card-error">
          <span className="app-splash-kicker">Acceso restringido</span>
          <h1>Modulo solo para administradores</h1>
          <p>No tienes permisos para entrar a esta seccion con la sesion actual.</p>
        </div>
      </div>
    );
  }

  return children;
}

export default ProtectedRoute;
