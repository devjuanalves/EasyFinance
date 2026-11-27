import { useEffect, useLayoutEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import AuthLayout from '../components/AuthLayout.jsx';
import {
  InputField,
  PasswordField,
  PrimaryButton,
  FormError,
} from '../components/FormControls.jsx';
import { api, API_MODE } from '../../../services/persistentApi.js';
export default function IdentityPage({ mode }) {
  const [token, setToken] = useState(
    () => new URLSearchParams(window.location.hash.slice(1)).get('token') || '',
  );
  useLayoutEffect(() => {
    if (window.location.hash)
      window.history.replaceState(null, '', window.location.pathname);
  }, []);
  const [password, setPassword] = useState(''),
    [confirm, setConfirm] = useState(''),
    [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [message, setMessage] = useState(''),
    [done, setDone] = useState(false);
  useEffect(() => {
    const receiveLink = () => {
      const incoming = new URLSearchParams(window.location.hash.slice(1)).get(
        'token',
      );
      if (!incoming) return;
      setToken(incoming);
      setDone(false);
      setError('');
      setMessage('');
      setPassword('');
      setConfirm('');
      window.history.replaceState(null, '', window.location.pathname);
    };
    window.addEventListener('hashchange', receiveLink);
    return () => window.removeEventListener('hashchange', receiveLink);
  }, []);
  const client = useQueryClient();
  const status = useQuery({
    queryKey: ['identity-status'],
    queryFn: () => api('/auth/identity'),
    enabled: API_MODE && mode === 'account',
  });
  const events = useQuery({
    queryKey: ['identity-events'],
    queryFn: () => api('/auth/events'),
    enabled: API_MODE && mode === 'account',
  });
  async function run(path, body) {
    if (busy) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const result = await api(path, { method: 'POST', body });
      setMessage(
        result.message ||
          (result.signInAgain
            ? 'Email changed. Sign in again.'
            : mode === 'reset'
              ? 'Password changed. Sign in again.'
              : 'Email verified.'),
      );
      setPassword('');
      setConfirm('');
      if (mode !== 'account') {
        setDone(true);
        setToken('');
      }
      await client.invalidateQueries({ queryKey: ['identity-status'] });
      await client.invalidateQueries({ queryKey: ['identity-events'] });
    } catch (cause) {
      setError(cause.message);
    } finally {
      setBusy(false);
    }
  }
  const title =
    mode === 'reset'
      ? 'Reset password'
      : mode === 'verify'
        ? 'Verify email'
        : 'Account security';
  return (
    <AuthLayout
      variant="recovery"
      title={title}
      subtitle="Secure account access"
      footer={
        <Link
          className="back-link"
          to={mode === 'account' ? '/settings' : '/login'}
        >
          {mode === 'account' ? 'Back to settings' : 'Back to sign in'}
        </Link>
      }
    >
      {!API_MODE ? (
        <p>
          Identity verification requires API mode. Demonstration credentials
          cannot access persisted accounts.
        </p>
      ) : (
        <>
          <FormError>
            {error || status.error?.message || events.error?.message}
          </FormError>
          {message && <p role="status">{message}</p>}
          {mode !== 'account' &&
            !done &&
            (!/^[a-f0-9]{64}$/.test(token) ? (
              <p role="alert">
                This link is invalid or expired. Request a new link.
              </p>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (
                    mode === 'reset' &&
                    (password.length < 12 ||
                      password.length > 128 ||
                      password !== confirm)
                  ) {
                    setError('Use 12–128 characters and matching passwords.');
                    return;
                  }
                  run(mode === 'reset' ? '/auth/reset' : '/auth/verify', {
                    token,
                    ...(mode === 'reset' ? { password } : {}),
                  });
                }}
              >
                <fieldset disabled={busy}>
                  {mode === 'reset' && (
                    <>
                      <PasswordField
                        label="New password"
                        autoComplete="new-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                      />
                      <PasswordField
                        label="Confirm new password"
                        autoComplete="new-password"
                        value={confirm}
                        onChange={(e) => setConfirm(e.target.value)}
                        required
                      />
                    </>
                  )}
                  <PrimaryButton type="submit" loading={busy}>
                    {mode === 'reset' ? 'Change password' : 'Confirm email'}
                  </PrimaryButton>
                </fieldset>
              </form>
            ))}
          {mode === 'account' && (
            <>
              {status.isPending && <p role="status">Loading account status…</p>}
              {status.data && (
                <>
                  <p>
                    {status.data.email}:{' '}
                    <strong>
                      {status.data.verified ? 'Verified' : 'Not verified'}
                    </strong>
                  </p>
                  {status.data.pendingEmail && (
                    <p>Pending email: {status.data.pendingEmail}</p>
                  )}
                  {!status.data.deliveryAvailable && (
                    <p>
                      Email delivery is unavailable. No verification or recovery
                      email can be sent.
                    </p>
                  )}
                  {!status.data.verified && (
                    <button
                      className="secondary-button"
                      disabled={busy}
                      onClick={() => run('/auth/verification', {})}
                    >
                      Request verification email
                    </button>
                  )}
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      run('/auth/email-change', {
                        email,
                        currentPassword: password,
                      });
                    }}
                  >
                    <fieldset disabled={busy}>
                      <InputField
                        label="New email address"
                        type="email"
                        autoComplete="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                      />
                      <PasswordField
                        label="Current password"
                        autoComplete="current-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                      />
                      <PrimaryButton type="submit" loading={busy}>
                        Request email change
                      </PrimaryButton>
                    </fieldset>
                  </form>
                  <p>
                    Your sign-in email changes only after confirming the new
                    address.
                  </p>
                </>
              )}
              <h2>Recent security activity</h2>
              {events.data && (
                <ul>
                  {events.data.map((event) => (
                    <li key={event.id}>
                      {event.action.replaceAll('_', ' ')} —{' '}
                      {new Date(event.createdAt).toLocaleString()}
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </>
      )}
    </AuthLayout>
  );
}
