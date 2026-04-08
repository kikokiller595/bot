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
      <div className="login-shell">
        <aside className="login-showcase">
          <span className="login-showcase-stamp">TBY SYSTEM GRID</span>
          <h1>Venta distribuida, control central y resultados en tiempo real.</h1>
          <p>
            Un entorno visual mas limpio para operar puntos de venta, premios,
            loterias y usuarios desde una sola red conectada.
          </p>

          <div className="login-showcase-grid">
            <div className="login-showcase-card">
              <span>Modo</span>
              <strong>Operacion conectada</strong>
              <small>Frontend y backend trabajando bajo un solo dominio.</small>
            </div>
            <div className="login-showcase-card">
              <span>Escala</span>
              <strong>Puntos remotos</strong>
              <small>Preparado para administracion y ventas distribuidas.</small>
            </div>
            <div className="login-showcase-card">
              <span>Flujo</span>
              <strong>Tickets y premios</strong>
              <small>Ventas, ganadores y cierres desde el mismo sistema.</small>
            </div>
          </div>
        </aside>

        <section className="login-box">
          <div className="login-brand-pill">
            <span className="login-brand-mark">ACC</span>
            <span className="login-brand-copy">Ingreso al tablero operativo</span>
          </div>

          <div className="login-header">
            <h1>Entrar al sistema</h1>
            <h2>Usa tu usuario para abrir el panel asignado a tu rol y punto de venta.</h2>
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

          <div className="login-footnote">
            Acceso visual renovado para administracion central y estaciones de venta.
          </div>
        </section>
      </div>
    </div>
  );
}

export default Login;
