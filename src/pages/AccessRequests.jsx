import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, updateDoc, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';

export default function AccessRequests() {
  const { isScheduler } = useAuth();
  const [users, setUsers] = useState([]);
  const [collapsed, setCollapsed] = useState({ pending: false, active: false, other: true });

  useEffect(() => {
    if (!isScheduler) return undefined;
    return onSnapshot(query(collection(db, 'users')), (snap) => {
      setUsers(snap.docs.map((userDoc) => ({ id: userDoc.id, ...userDoc.data() })));
    });
  }, [isScheduler]);

  function toggleSection(key) {
    setCollapsed((current) => ({ ...current, [key]: !current[key] }));
  }

  async function resolveRequest(user, approved) {
    await updateDoc(doc(db, 'users', user.id), {
      role: approved ? 'scheduler' : 'unassigned',
      requestStatus: approved ? 'approved' : 'denied',
    });
  }

  if (!isScheduler) {
    return <div className="page"><h2>Access requests</h2><p className="empty-state">Scheduler access is required.</p></div>;
  }

  const requests = users.filter(
    (user) =>
      user.requestedRole === 'scheduler' &&
      user.role !== 'scheduler' &&
      user.requestStatus !== 'approved' &&
      user.requestStatus !== 'denied'
  );

  const approvedSchedulers = users.filter(
    (user) => user.role === 'scheduler' || user.requestStatus === 'approved'
  );

  const otherUsers = users.filter(
    (user) => user.role !== 'scheduler' && user.requestStatus !== 'approved'
  );

  const roleLabel = (user) => {
    if (user.role === 'scheduler') return 'Scheduler';
    if (user.requestStatus === 'pending') return 'Requested';
    if (user.requestStatus === 'approved') return 'Approved';
    if (user.requestStatus === 'denied') return 'Denied';
    return 'Unassigned';
  };

  return (
    <div className="page access-requests-page">
      <div className="page-heading-row">
        <div>
          <span className="page-eyebrow">Administration</span>
          <h2>Scheduler access</h2>
          <p className="page-subtitle">Review and manage scheduling permissions.</p>
        </div>
        <span className="request-count">{requests.length} pending</span>
      </div>

      {/* Pending Requests - Top Priority */}
      {requests.length > 0 && (
        <section className="access-section">
          <button type="button" className="access-section-header" onClick={() => toggleSection('pending')}>
            <span className={`section-chevron ${collapsed.pending ? 'is-collapsed' : ''}`}>▾</span>
            <span className="access-section-title">Pending requests</span>
            <span className="access-section-badge badge-pending">{requests.length}</span>
          </button>
          {!collapsed.pending && (
            <div className="request-list">
              {requests.map((user) => (
                <article key={user.id} className="request-card">
                  <div className="request-card-copy">
                    <strong>{user.name}</strong>
                    <span>{user.email || 'Email unavailable'}</span>
                  </div>
                  <div className="request-actions">
                    <button type="button" className="request-button approve" onClick={() => resolveRequest(user, true)}>Approve</button>
                    <button type="button" className="request-button deny" onClick={() => resolveRequest(user, false)}>Deny</button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Approved Schedulers Section */}
      <section className="access-section">
        <button type="button" className="access-section-header" onClick={() => toggleSection('active')}>
          <span className={`section-chevron ${collapsed.active ? 'is-collapsed' : ''}`}>▾</span>
          <span className="access-section-title">Active schedulers</span>
          <span className="access-section-badge badge-active">{approvedSchedulers.length}</span>
        </button>
        {!collapsed.active && (
          <div className="request-list">
            {approvedSchedulers.length === 0 ? (
              <div className="empty-panel">No scheduler accounts are currently approved.</div>
            ) : (
              approvedSchedulers.map((user) => (
                <article key={user.id} className="request-card">
                  <div className="request-card-copy">
                    <strong>{user.name || 'Unknown user'}</strong>
                    <span>{user.email || 'Email unavailable'}</span>
                  </div>
                  <div className="request-actions">
                    <span className="request-button approve" style={{ pointerEvents: 'none', opacity: 1, cursor: 'default' }}>
                      Scheduler
                    </span>
                  </div>
                </article>
              ))
            )}
          </div>
        )}
      </section>

      {/* Other Users Section */}
      {otherUsers.length > 0 && (
        <section className="access-section">
          <button type="button" className="access-section-header" onClick={() => toggleSection('other')}>
            <span className={`section-chevron ${collapsed.other ? 'is-collapsed' : ''}`}>▾</span>
            <span className="access-section-title">Other users</span>
            <span className="access-section-badge">{otherUsers.length}</span>
          </button>
          {!collapsed.other && (
            <div className="request-list">
              {otherUsers.map((user) => (
                <article key={user.id} className="request-card">
                  <div className="request-card-copy">
                    <strong>{user.name || 'Unknown user'}</strong>
                    <span>{user.email || 'Email unavailable'}</span>
                  </div>
                  <div className="request-actions">
                    <span
                      className={
                        user.requestStatus === 'denied'
                          ? 'request-button deny'
                          : 'request-button'
                      }
                      style={{ pointerEvents: 'none', opacity: 1, cursor: 'default' }}
                    >
                      {roleLabel(user)}
                    </span>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
