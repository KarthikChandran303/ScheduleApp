import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { login, signup, resetPassword, guestLogin } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState('login'); // 'login' | 'signup' | 'reset'
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [requestedRole, setRequestedRole] = useState('general');
  const [error, setError] = useState('');
  const [resetSent, setResetSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (mode === 'signup') {
        await signup(email, password, name, requestedRole);
        navigate('/');
      } else if (mode === 'reset') {
        await resetPassword(email);
        setResetSent(true);
      } else {
        await login(email, password);
        navigate('/');
      }
    } catch (err) {
      setError(err.message.replace('Firebase: ', ''));
    } finally {
      setBusy(false);
    }
  }

  function switchMode(nextMode) {
    setMode(nextMode);
    setError('');
    setResetSent(false);
  }

  async function handleGuestLogin() {
    setError('');
    setBusy(true);
    try {
      await guestLogin();
      navigate('/');
    } catch (err) {
      setError(err.message.replace('Firebase: ', ''));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <h1>Schedule</h1>
        <p className="auth-subtitle">
          {mode === 'login' && 'Sign in to see the schedule.'}
          {mode === 'signup' && 'Create an account to get started.'}
          {mode === 'reset' && 'Enter your email and we\'ll send you a link to reset your password.'}
        </p>
        {mode === 'reset' && resetSent ? (
          <p className="auth-note">
            If an account exists for {email}, a password reset link has been sent. Check your inbox.
          </p>
        ) : (
          <form onSubmit={handleSubmit}>
            {mode === 'signup' && (
              <label>
                Name
                <input value={name} onChange={(e) => setName(e.target.value)} required />
              </label>
            )}
            {mode === 'signup' && (
              <label>
                Access level
                <select value={requestedRole} onChange={(e) => setRequestedRole(e.target.value)}>
                  <option value="general">General user</option>
                  <option value="scheduler">Request scheduler access</option>
                </select>
              </label>
            )}
            <label>
              Email
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </label>
            {mode !== 'reset' && (
              <label>
                Password
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={6}
                  required
                />
              </label>
            )}
            {mode === 'login' && (
              <button
                type="button"
                className="link-button auth-forgot-link"
                onClick={() => switchMode('reset')}
              >
                Forgot password?
              </button>
            )}
            {error && <p className="error-text">{error}</p>}
            <button type="submit" disabled={busy}>
              {busy
                ? 'Please wait…'
                : mode === 'login'
                ? 'Sign in'
                : mode === 'signup'
                ? 'Create account'
                : 'Send reset link'}
            </button>
          </form>
        )}
        {mode === 'reset' ? (
          <button type="button" className="link-button" onClick={() => switchMode('login')}>
            Back to sign in
          </button>
        ) : (
          <button
            type="button"
            className="link-button"
            onClick={() => switchMode(mode === 'login' ? 'signup' : 'login')}
          >
            {mode === 'login' ? "Don't have an account? Sign up" : 'Have an account? Sign in'}
          </button>
        )}
        {mode === 'signup' && (
          <p className="auth-note">
            New accounts start with view-only access. Scheduler access requests must be approved by an admin.
          </p>
        )}
        {mode === 'login' && (
          <>
            <div className="auth-divider"><span>or</span></div>
            <button type="button" className="secondary-button auth-guest-button" onClick={handleGuestLogin} disabled={busy}>
              Continue as guest
            </button>
            <p className="auth-note">Guests can view the public schedule only, with no account required.</p>
          </>
        )}
      </div>
    </div>
  );
}
