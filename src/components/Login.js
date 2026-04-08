import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import './Login.css';

const normalizeBaseUrl = (value, fallback = '') =>
  (value || fallback || '').trim().replace(/\/+$/, '');

const defaultBackendUrl =
  process.env.NODE_ENV === 'production' ? '' : 'http://localhost:5000';

const BACKEND_URL = normalizeBaseUrl(
  process.env.REACT_APP_BACKEND_URL,
  defaultBackendUrl
);

const HEALTHCHECK_URL = BACKEND_URL ? `${BACKEND_URL}/health` : '/health';

function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [backendStatus, setBackendStatus] = useState('checking');
  const [databaseStatus, setDatabaseStatus] = useState('checking');
  const { login } = useAuth();

  useEffect(() => {
    let active = true;

    const checkBackend = async () => {
      try {
        const response = await fetch(HEALTHCHECK_URL);
        if (!active) {
          return;
        }

        if (!response.ok) {
          setBackendStatus('offline');
          setDatabaseStatus('offline');
          return;
        }

        const data = await response.json();
        setBackendStatus('online');
        setDatabaseStatus(data?.database || 'unknown');
      } catch (requestError) {
        if (active) {
          setBackendStatus('offline');
          setDatabaseStatus('offline');
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
          {backendStatus === 'online' && databaseStatus === 'connected' && (
            <span>Servidor listo</span>
          )}
          {backendStatus === 'online' && databaseStatus !== 'connected' && (
            <span>Servidor activo, pero la base de datos aun no esta conectada.</span>
          )}
          {backendStatus === 'checking' && <span>Verificando servidor...</span>}
          {backendStatus === 'offline' && (
            <span>No se pudo conectar con el servidor.</span>
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
