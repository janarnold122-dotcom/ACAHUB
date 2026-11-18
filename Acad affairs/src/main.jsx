import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('App Caught Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: '40px 24px',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          maxWidth: '680px',
          margin: '40px auto',
          background: '#ffffff',
          borderRadius: '12px',
          boxShadow: '0 10px 25px rgba(0,0,0,0.08)'
        }}>
          <h2 style={{ color: '#dc2626', marginBottom: '8px' }}>⚠️ Portal Render Error</h2>
          <p style={{ color: '#475569', fontSize: '14px', marginBottom: '16px' }}>
            An unexpected error occurred while rendering the portal. You can clear your stored browser session and reload:
          </p>
          <pre style={{
            background: '#fef2f2',
            padding: '16px',
            borderRadius: '8px',
            color: '#991b1b',
            fontSize: '13px',
            overflowX: 'auto',
            border: '1px solid #fecaca'
          }}>
            {this.state.error?.stack || this.state.error?.message}
          </pre>
          <div style={{ marginTop: '20px', display: 'flex', gap: '12px' }}>
            <button
              onClick={() => {
                localStorage.removeItem('lccb_session_user');
                localStorage.removeItem('lccb_token');
                window.location.reload();
              }}
              style={{
                padding: '10px 20px',
                background: '#0284c7',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Reset Session & Go to Login
            </button>
            <button
              onClick={() => window.location.reload()}
              style={{
                padding: '10px 20px',
                background: '#f1f5f9',
                color: '#334155',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
