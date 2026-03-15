import React from 'react';
import { useAuth } from './context/AuthContext';
import Login from './components/Login';
import App from './App';

function AppWithAuth() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        fontSize: '1.5rem',
        color: '#667eea'
      }}>
        Cargando...
      </div>
    );
  }

  return user ? <App /> : <Login />;
}

export default AppWithAuth;
