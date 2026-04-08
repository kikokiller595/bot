import React from 'react';
import { useAuth } from './context/AuthContext';
import Login from './components/Login';
import App from './App';

function AppWithAuth() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="app-splash">
        <div className="app-splash-card">
          <span className="app-splash-kicker">TBY Sistemas</span>
          <h1>Cargando entorno operativo</h1>
          <p>Preparando acceso, paneles y conexion con el servicio central.</p>
        </div>
      </div>
    );
  }

  return user ? <App /> : <Login />;
}

export default AppWithAuth;
