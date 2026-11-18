import React, { useState, useEffect } from 'react';
import lccbLogo from './assets/LOGO.png';
import { loadSession, clearSession } from './data/authService';
import { DataProvider, useData } from './data/DataContext';
import { Badge } from './components/Badge';
import { LoginPage } from './components/LoginPage';
import { VpaaOverview } from './components/VpaaOverview';
import { ScheduleBuilder } from './components/ScheduleBuilder';
import { RoomAllocation } from './components/RoomAllocation';
import { FacultyLoad } from './components/FacultyLoad';
import { CourseSections } from './components/CourseSections';
import { ClassRecord } from './components/ClassRecord';
import { TimetableView } from './components/TimetableView';
import { ClassRecordReview } from './classreview/ClassRecordReview';

/* ===================== App Shell ===================== */
const ROLE_NAV = {
  vpaa: [
    { id: "overview", label: "Executive overview", icon: "◆" },
    { id: "sections", label: "Course & sections", icon: "▤" },
    { id: "scheduling", label: "Scheduling engine", icon: "▦" },
    { id: "timetable", label: "Master timetable", icon: "▦" },
    { id: "rooms", label: "Room allocation", icon: "▢" },
    { id: "faculty", label: "Faculty load", icon: "◈" },
    { id: "classreview", label: "Class record & review", icon: "📋" },
  ],
  dean: [
    { id: "sections", label: "Course & sections", icon: "▤" },
    { id: "timetable", label: "College timetable", icon: "▦" },
    { id: "faculty", label: "Faculty load", icon: "◈" },
    { id: "classreview", label: "Class record & review", icon: "📋" },
  ],
  program_chair: [
    { id: "sections", label: "Course & sections", icon: "▤" },
    { id: "timetable", label: "Department timetable", icon: "▦" },
    { id: "classreview", label: "Class record & review", icon: "📋" },
  ],
  faculty: [
    { id: "classreview", label: "Class record & review", icon: "📋" },
    { id: "timetable", label: "My timetable", icon: "▦" },
  ],
};

const ROLE_LABELS = { vpaa: "VPAA", dean: "Dean", program_chair: "Program Chair", faculty: "Faculty" };

export default function App() {
  const [currentUser, setCurrentUser] = useState(() => loadSession());
  const [tab, setTab] = useState(() => {
    if (currentUser?.role) {
      const nav = ROLE_NAV[currentUser.role];
      return nav ? nav[0].id : "overview";
    }
    return "overview";
  });

  useEffect(() => {
    const handleNavigate = (e) => { setTab(e.detail); };
    window.addEventListener('navigate-tab', handleNavigate);
    return () => window.removeEventListener('navigate-tab', handleNavigate);
  }, []);

  const handleLogin = (user) => {
    setCurrentUser(user);
    const nav = ROLE_NAV[user.role] || ROLE_NAV.vpaa;
    setTab(nav[0].id);
  };

  const handleLogout = () => {
    clearSession();
    setCurrentUser(null);
  };

  // If not logged in, render the simple Login Page
  if (!currentUser) {
    return <LoginPage onLogin={handleLogin} />;
  }

  return (
    <DataProvider>
      <AppShell
        currentUser={currentUser}
        tab={tab}
        setTab={setTab}
        handleLogout={handleLogout}
      />
    </DataProvider>
  );
}

function AppShell({ currentUser, tab, setTab, handleLogout }) {
  const { colleges, loading, dbError, refresh } = useData();

  if (loading) {
    return <div className="loading-screen"><h2>LCCB Academic Affairs</h2><p>Initializing portal services...</p></div>;
  }

  const role = currentUser.role;
  const actorName = currentUser.name;
  const nav = ROLE_NAV[role] || ROLE_NAV.vpaa;

  // Deans and program chairs are both scoped to their own college
  const filteredColleges = currentUser.college_id
    ? colleges.filter(c => c.id === currentUser.college_id)
    : colleges;

  const actorInitials = (actorName || 'User')
    .replace(/(Dr\.|Prof\.|Mr\.|Ms\.)\s*/gi, '')
    .trim()
    .split(' ')
    .map(n => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const activeTab = nav.some(n => n.id === tab) ? tab : (nav[0]?.id || "overview");

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="seal" style={{ overflow: 'hidden', background: '#ffffff', borderRadius: '50%', boxShadow: '0 2px 8px rgba(0,0,0,0.2)' }}>
            <img
              src={lccbLogo}
              alt="La Consolacion College Bacolod Seal"
              onError={(e) => {
                e.currentTarget.onerror = null;
                e.currentTarget.src = '/LOGO.png';
              }}
              style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
            />
          </div>
          <h1>Academic Affairs</h1>
          <p>La Consolacion College Bacolod</p>
        </div>

        {/* Locked Account Profile (No switching to other accounts) */}
        <div className="sidebar-account-box">
          <div className="sidebar-account-badge">
            <Badge kind={role === 'vpaa' ? 'gold' : role === 'dean' ? 'success' : 'warn'}>
              {ROLE_LABELS[role]}
            </Badge>
          </div>
          <div className="sidebar-account-name">{actorName}</div>
          <div className="sidebar-account-email">{currentUser.email}</div>
          {currentUser.college_name && (
            <div className="sidebar-account-college">{currentUser.college_name}</div>
          )}
        </div>

        <nav>
          {nav.map(item => (
            <div key={item.id} className={"nav-item" + (activeTab === item.id ? " active" : "")} onClick={() => setTab(item.id)}>
              <span className="dot"></span><span>{item.icon}</span><span>{item.label}</span>
            </div>
          ))}
        </nav>

        <div className="sidebar-signout-row">
          <button
            type="button"
            className="sidebar-signout-btn"
            onClick={handleLogout}
            title="Log out and return to sign in"
          >
            <span>⎋</span>
            <span>Sign Out</span>
          </button>
        </div>

        <div className="sidebar-foot">
          1st Sem, A.Y. 2026&ndash;2027<br />
          <span>LCCB Academic Affairs</span>
        </div>
      </aside>

      <div className="main">
        <div className="topbar">
          <h2>{nav.find(n => n.id === activeTab)?.label || 'Academic Portal'}</h2>
          
          <div className="topbar-right-zone">
            <div className="topbar-user-badge">
              <div className="topbar-avatar">{actorInitials}</div>
              <div className="topbar-user-meta">
                <span className="topbar-user-name">{actorName}</span>
                <span className="topbar-user-sub">
                  {currentUser.college_name ? currentUser.college_name.split(' ')[0] : 'Academic Affairs'}
                </span>
              </div>
              <Badge kind={role === 'vpaa' ? 'gold' : role === 'dean' ? 'success' : 'warn'}>
                {ROLE_LABELS[role]}
              </Badge>
            </div>

            <button
              type="button"
              className="btn-signout"
              onClick={handleLogout}
              title="Sign Out of Academic Portal"
              id="topbar-signout-btn"
            >
              <span>Sign Out</span>
              <span style={{ fontSize: '13px' }}>⎋</span>
            </button>
          </div>
        </div>

        {dbError && (
          <div style={{
            background: '#fee2e2',
            border: '1px solid #ef4444',
            color: '#991b1b',
            padding: '14px 20px',
            margin: '16px 24px 0',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
          }}>
            <div>
              <strong>⚠️ Database Offline:</strong> {dbError}
              <div style={{ fontSize: '12px', marginTop: '4px', color: '#b91c1c' }}>
                Please configure your Supabase connection string (<code>DATABASE_URL</code>) in <code>.env</code>.
              </div>
            </div>
            <button
              onClick={() => window.location.reload()}
              style={{
                background: '#dc2626',
                color: '#fff',
                border: 'none',
                padding: '8px 16px',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: 600
              }}
            >
              Retry Connection
            </button>
          </div>
        )}

        <div className="content">
          {dbError ? (
            <SupabaseOfflineModal dbError={dbError} onRefresh={refresh} />
          ) : (
            <>
              {tab === "overview" && <VpaaOverview actor={actorName} />}
              {tab === "scheduling" && <ScheduleBuilder actor={actorName} colleges={filteredColleges} currentUser={currentUser} />}
              {tab === "timetable" && <TimetableView currentUser={currentUser} colleges={filteredColleges} />}
              {tab === "rooms" && <RoomAllocation />}
              {tab === "faculty" && <FacultyLoad currentUser={currentUser} colleges={filteredColleges} />}
              {(tab === "classreview" || tab === "classlist") && (
                <ClassRecord
                  actor={actorName}
                  initialTab={role === "faculty" ? "roster" : "review"}
                  currentUser={currentUser}
                  role={role}
                  colleges={filteredColleges}
                />
              )}
              {tab === "sections" && <CourseSections actor={actorName} colleges={filteredColleges} defaultCollege={currentUser.college_id} />}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function SupabaseOfflineModal({ dbError, onRefresh }) {
  const [password, setPassword] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [statusMsg, setStatusMsg] = useState(null);

  const handleConnect = async (e) => {
    e?.preventDefault();
    if (!password.trim()) {
      setStatusMsg({ type: 'error', text: 'Please enter your Supabase database password.' });
      return;
    }
    setConnecting(true);
    setStatusMsg(null);

    try {
      const res = await fetch('/api/config/db-connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: password.trim() }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setStatusMsg({ type: 'success', text: '✅ Connected to Supabase! Syncing data...' });
        setTimeout(() => {
          onRefresh();
        }, 1200);
      } else {
        setStatusMsg({
          type: 'error',
          text: data.message || 'Supabase authentication failed. Please verify your password in Supabase.'
        });
      }
    } catch (err) {
      setStatusMsg({ type: 'error', text: err.message || 'Network error reaching backend.' });
    } finally {
      setConnecting(false);
    }
  };

  const handleRetry = async () => {
    setRetrying(true);
    setStatusMsg(null);
    try {
      await onRefresh();
    } finally {
      setRetrying(false);
    }
  };

  return (
    <div style={{
      padding: '48px 24px',
      background: '#ffffff',
      borderRadius: '16px',
      boxShadow: '0 10px 30px rgba(0,0,0,0.08)',
      margin: '32px auto',
      maxWidth: '640px',
      textAlign: 'center'
    }}>
      <div style={{ fontSize: '48px', marginBottom: '12px' }}>🔒</div>
      <h2 style={{ color: '#0f172a', fontSize: '24px', fontWeight: 700, marginBottom: '8px' }}>
        Supabase Database Connection
      </h2>
      <p style={{ color: '#64748b', fontSize: '15px', lineHeight: '1.6', marginBottom: '24px' }}>
        The backend reached your Supabase project (<strong>uknbhdbrqhoomepalkct</strong>), but PostgreSQL rejected the current password:
      </p>

      <div style={{
        background: '#fef2f2',
        border: '1px solid #fecaca',
        color: '#991b1b',
        padding: '12px 16px',
        borderRadius: '8px',
        fontSize: '13px',
        fontFamily: 'monospace',
        marginBottom: '24px',
        textAlign: 'left',
        wordBreak: 'break-all'
      }}>
        {dbError}
      </div>

      <div style={{
        background: '#f8fafc',
        border: '1px solid #e2e8f0',
        borderRadius: '12px',
        padding: '24px',
        textAlign: 'left',
        marginBottom: '24px'
      }}>
        <div style={{ fontWeight: 600, color: '#1e293b', marginBottom: '6px' }}>
          Step 1: Set or Reset Password in Supabase
        </div>
        <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 12px 0' }}>
          Open your Supabase Project Settings and click <strong>Reset database password</strong>:
        </p>
        <a
          href="https://supabase.com/dashboard/project/uknbhdbrqhoomepalkct/settings/database"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'inline-block',
            color: '#0284c7',
            fontSize: '13px',
            fontWeight: 600,
            textDecoration: 'underline',
            marginBottom: '16px'
          }}
        >
          ↗ Open Supabase Database Settings (uknbhdbrqhoomepalkct)
        </a>

        <div style={{ fontWeight: 600, color: '#1e293b', marginBottom: '8px' }}>
          Step 2: Enter Password to Connect Instantly
        </div>
        <form onSubmit={handleConnect} style={{ display: 'flex', gap: '8px', flexDirection: 'column' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              type="password"
              placeholder="Enter your Supabase database password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={connecting}
              style={{
                flex: 1,
                padding: '10px 14px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '14px',
                outline: 'none'
              }}
            />
            <button
              type="submit"
              disabled={connecting}
              style={{
                background: '#0284c7',
                color: '#ffffff',
                border: 'none',
                padding: '10px 20px',
                borderRadius: '8px',
                fontWeight: 600,
                fontSize: '14px',
                cursor: connecting ? 'not-allowed' : 'pointer',
                opacity: connecting ? 0.7 : 1,
                whiteSpace: 'nowrap'
              }}
            >
              {connecting ? 'Connecting...' : 'Connect Now'}
            </button>
          </div>
        </form>

        {statusMsg && (
          <div style={{
            marginTop: '12px',
            padding: '10px 14px',
            borderRadius: '6px',
            fontSize: '13px',
            background: statusMsg.type === 'success' ? '#f0fdf4' : '#fef2f2',
            color: statusMsg.type === 'success' ? '#166534' : '#991b1b',
            border: `1px solid ${statusMsg.type === 'success' ? '#bbf7d0' : '#fecaca'}`
          }}>
            {statusMsg.text}
          </div>
        )}
      </div>

      <button
        onClick={handleRetry}
        disabled={retrying || connecting}
        style={{
          background: 'transparent',
          color: '#64748b',
          border: '1px solid #cbd5e1',
          padding: '8px 20px',
          borderRadius: '8px',
          fontSize: '13px',
          cursor: 'pointer',
          fontWeight: 500
        }}
      >
        {retrying ? 'Pinging Database...' : '↻ Retry Existing Configuration'}
      </button>
    </div>
  );
}
