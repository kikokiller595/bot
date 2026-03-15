import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import './Login.css';

const BACKEND_URL =
  (process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000').replace(/\/+$/, '');

function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [backendStatus, setBackendStatus] = useState('checking');
  const { login } = useAuth();

  useEffect(() => {
    let active = true;

    const checkBackend = async () => {
      try {
        const response = await fetch(`${BACKEND_URL}/api/init/status`);
        if (!active) {
          return;
        }
        setBackendStatus(response.ok ? 'online' : 'offline');
      } catch (requestError) {
        if (active) {
          setBackendStatus('offline');
        }
      }
    };

    checkBackend();
    const timer = setInterval(checkBackend, 10000);

    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(username, password);
    } catch (submitError) {
      setError(submitError.message || 'No se pudo iniciar sesion');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <div className="login-header">
          <h1>TBY Sistemas</h1>
          <h2>Acceso por punto de venta</h2>
        </div>

        <div className={`login-status login-status-${backendStatus}`}>
          {backendStatus === 'online' && <span>Servidor listo</span>}
          {backendStatus === 'checking' && <span>Verificando servidor...</span>}
          {backendStatus === 'offline' && (
            <span>Backend no disponible. Revisa el servidor local en el puerto 5000.</span>
          )}
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          {error && <div className="login-error">{error}</div>}

          <div className="form-group">
            <label htmlFor="username">Usuario</label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="Ej: centro01"
              required
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Contrasena</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Ingresa tu contrasena"
              required
              disabled={loading}
            />
          </div>

          <button type="submit" className="login-button" disabled={loading}>
            {loading ? 'Entrando...' : 'Iniciar sesion'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default Login;
