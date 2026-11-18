import React, { useState, useEffect, useCallback } from 'react';
import lccbLogo from '../assets/LOGO.png';
import loginBg from '../assets/lccb-building.jpg';
import { loginUser, saveSession } from '../data/authService';

export function LoginPage({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [dbStatus, setDbStatus] = useState({ checking: true, connected: false, message: '' });

  // Live health check to verify backend & Supabase connection
  const checkDb = useCallback(async () => {
    try {
      const res = await fetch('/api/health');
      const data = await res.json().catch(() => null);
      if (res.ok && data?.database === 'connected') {
        setDbStatus({ checking: false, connected: true, message: data.engine || 'Supabase PostgreSQL' });
      } else {
        setDbStatus({ checking: false, connected: false, message: data?.message || 'Cannot reach Supabase database' });
      }
    } catch (err) {
      setDbStatus({ checking: false, connected: false, message: 'Backend or Supabase offline. Ensure backend is running.' });
    }
  }, []);

  useEffect(() => {
    checkDb();
    const interval = setInterval(checkDb, 3000);
    return () => clearInterval(interval);
  }, [checkDb]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!dbStatus.connected) {
      setError('Cannot sign in: Supabase database is offline or not configured in .env.');
      return;
    }

    if (!username.trim()) {
      setError('Please enter your username.');
      return;
    }
    if (!password) {
      setError('Please enter your password.');
      return;
    }

    setLoading(true);

    // Clear any stale session before logging in
    localStorage.removeItem('lccb_session_user');
    localStorage.removeItem('lccb_token');

    const result = await loginUser(username, password);

    if (!result.success) {
      setError(result.error || 'Login failed. Please try again.');
      setLoading(false);
      return;
    }

    if (rememberMe) {
      saveSession(result.user);
    }

    onLogin(result.user);
  };

  return (
    <div
      className="simple-login-shell"
      style={{
        backgroundImage: `linear-gradient(135deg, rgba(11, 30, 54, 0.70) 0%, rgba(15, 76, 129, 0.55) 100%), url(${loginBg})`
      }}
    >
      <div className="simple-login-card">
        {/* Header with Seal */}
        <div className="simple-login-header">
          <div className="simple-seal-box">
            <img
              src={lccbLogo}
              alt="LCCB Seal"
              onError={(e) => {
                e.currentTarget.onerror = null;
                e.currentTarget.src = '/LOGO.png';
              }}
            />
          </div>
          <h2>La Consolacion College Bacolod</h2>
          <p>Academic Affairs Portal</p>
        </div>

        {/* Status when DB is offline */}
        {!dbStatus.connected && !dbStatus.checking && (
          <div style={{
            padding: '10px 14px',
            borderRadius: '6px',
            fontSize: '12px',
            fontWeight: 500,
            marginBottom: '16px',
            background: '#fee2e2',
            color: '#991b1b',
            border: '1px solid #fca5a5'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontWeight: 600 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>🔴</span>
                <span>Database Offline</span>
              </div>
              <button
                type="button"
                onClick={checkDb}
                style={{
                  background: '#b91c1c',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '2px 8px',
                  fontSize: '11px',
                  cursor: 'pointer'
                }}
              >
                Retry
              </button>
            </div>
            <div style={{ marginTop: '4px', fontSize: '11px', color: '#b91c1c' }}>
              {dbStatus.message || 'Cannot connect to Supabase PostgreSQL. Please configure DATABASE_URL in .env.'}
            </div>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="simple-alert error">
            <span>⚠️ {error}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} autoComplete="off">
          <div className="simple-field">
            <label htmlFor="login-username">Username or Email</label>
            <input
              id="login-username"
              type="text"
              placeholder="Enter your username or email"
              value={username}
              autoComplete="username"
              onChange={(e) => {
                setUsername(e.target.value);
                if (error) setError('');
              }}
              required
            />
          </div>

          <div className="simple-field">
            <label htmlFor="login-password">Password</label>
            <div className="simple-password-wrapper">
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter your password"
                value={password}
                autoComplete="current-password"
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) setError('');
                }}
                required
              />
              <button
                type="button"
                className="simple-toggle-pw"
                onClick={() => setShowPassword(!showPassword)}
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          <div className="simple-options">
            <label className="simple-checkbox">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
              />
              <span>Remember me</span>
            </label>
          </div>

          <button
            type="submit"
            className="simple-login-btn"
            disabled={loading || !dbStatus.connected}
            style={{
              opacity: !dbStatus.connected ? 0.6 : 1,
              cursor: !dbStatus.connected ? 'not-allowed' : 'pointer',
              background: !dbStatus.connected ? '#64748b' : undefined
            }}
          >
            {loading ? 'Signing In…' : !dbStatus.connected ? 'Connect Supabase to Sign In' : 'Sign In'}
          </button>
        </form>

        <div className="simple-footer">
          1st Sem &bull; Academic Year 2026–2027
        </div>
      </div>
    </div>
  );
}
