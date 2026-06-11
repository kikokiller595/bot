import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import authService from '../services/authService';
import './Login.css';

function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionNotice, setSessionNotice] = useState('');
  const { login } = useAuth();

  useEffect(() => {
    const logoutReason = authService.consumeLogoutReason();
    if (logoutReason === 'inactivity') {
      setSessionNotice(
        'Session closed automatically due to inactivity. Sign in again to continue.'
      );
    }
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
