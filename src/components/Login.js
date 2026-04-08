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
        if (!active) return;

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
        <aside className="login-poster">
          <div className="login-poster-top">
            <span className="login-poster-tag">TBY SISTEMAS</span>
            <span className="login-poster-signal">red operativa</span>
          </div>

          <div className="login-poster-copy">
            <h1>Un acceso nuevo para vender, cuadrar y supervisar sin parecerse al sistema anterior.</h1>
            <p>
              Cabina visual renovada para administracion central, puntos de venta,
              tickets, resultados y premios en una sola red.
            </p>
          </div>

          <div className="login-poster-panels">
            <article className="login-poster-panel accent-blue">
              <span>Vista</span>
              <strong>Operacion viva</strong>
              <small>Lectura rapida de ventas, premios y movimiento comercial.</small>
            </article>
            <article className="login-poster-panel accent-red">
              <span>Flujo</span>
              <strong>Tickets distribuidos</strong>
              <small>Paneles conectados para locales remotos y administracion central.</small>
            </article>
            <article className="login-poster-panel accent-dark">
              <span>Control</span>
              <strong>Un solo sistema</strong>
              <small>Backend, frontend y estados del servicio en la misma cabina.</small>
            </article>
          </div>
        </aside>

        <section className="login-box">
          <div className="login-box-head">
            <span className="login-box-kicker">Ingreso seguro</span>
            <div className="login-box-mark">TBY</div>
          </div>

          <div className="login-header">
            <h1>Entrar al tablero</h1>
            <h2>Abre el panel asignado a tu rol y a tu punto de venta.</h2>
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
            Interfaz rediseñada para que el acceso se sienta mas claro, mas moderno y mucho mejor organizado.
          </div>
        </section>
      </div>
    </div>
  );
}

export default Login;
