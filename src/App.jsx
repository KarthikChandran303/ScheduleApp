import { useEffect } from 'react';
import { Routes, Route, Navigate, NavLink } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Schedule from './pages/Schedule';
import Unavailability from './pages/Unavailability';
import AccessRequests from './pages/AccessRequests';

function Shell({ children }) {
  const { profile, logout } = useAuth();
  return (
    <div className="app-shell">
      <header className="app-header">
        <span className="app-brand">Schedule</span>
        <nav>
          <NavLink to="/daily">Daily</NavLink>
          <NavLink to="/" end>
            Weekly
          </NavLink>
          <NavLink to="/unavailable">Unavailable</NavLink>
          {profile?.role === 'scheduler' && <NavLink to="/requests">Requests</NavLink>}
        </nav>
        <button className="link-button" onClick={logout}>
          Sign out
        </button>
      </header>
      {profile?.role === 'unassigned' && (
        <div className="banner">
          Your account is view-only for now. An admin will grant scheduling access if needed.
        </div>
      )}
      <main>{children}</main>
    </div>
  );
}

export default function App() {
  const { firebaseUser, loading, registerPushToken } = useAuth();

  useEffect(() => {
    if (firebaseUser) registerPushToken();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firebaseUser]);

  if (loading) return <div className="loading-screen">Loading…</div>;

  if (!firebaseUser) {
    return (
      <Routes>
        <Route path="*" element={<Login />} />
      </Routes>
    );
  }

  return (
    <Shell>
      <Routes>
        <Route path="/" element={<Schedule />} />
        <Route path="/daily" element={<Schedule view="daily" />} />
        <Route path="/unavailable" element={<Unavailability />} />
        <Route path="/requests" element={<AccessRequests />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Shell>
  );
}
