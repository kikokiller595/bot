import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import authService from '../services/authService';
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
  const [sessionNotice, setSessionNotice] = useState('');
  const { login } = useAuth();

  useEffect(() => {
    const logoutReason = authService.consumeLogoutReason();
    if (logoutReason === 'inactivity') {
      setSessionNotice(
        'Session closed automatically due to inactivity. Sign in again to continue.'
      );
    }

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
      } catch {
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
      setError(submitError.message || 'Could not sign in');
    } finally {
      setLoading(false);
    }
  };

  const statusText = () => {
    if (backendStatus === 'online' && databaseStatus === 'connected') return 'System ready';
    if (backendStatus === 'online') return 'Server online — database connecting...';
    if (backendStatus === 'checking') return 'Connecting...';
    return 'Server unavailable';
  };

  return (
    <div className="login-container">
      <div className="login-card">

        {/* Brand */}
        <div className="login-brand">
          <span className="login-brand-mark">TBY</span>
          <div className="login-brand-copy">
            <strong>TBY SYSTEMS</strong>
            <span>Lottery Management Platform</span>
          </div>
        </div>

        {/* Status */}
        <div className={`login-status login-status-${backendStatus}`}>
          <span className="login-status-dot" />
          <span>{statusText()}</span>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="login-form">
          {sessionNotice && <div className="login-notice">{sessionNotice}</div>}
          {error && <div className="login-error">{error}</div>}

          <div className="form-group">
            <label htmlFor="username">Username</label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your username"
              required
              disabled={loading}
              autoComplete="username"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
              disabled={loading}
              autoComplete="current-password"
            />
          </div>

          <button type="submit" className="login-button" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <p className="login-footnote">
          TBY Systems &mdash; Lottery operations platform
        </p>
      </div>
    </div>
  );
}

export default Login;
