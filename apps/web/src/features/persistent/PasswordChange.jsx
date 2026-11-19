import { useState } from 'react';
import { api } from '../../services/persistentApi.js';
import { authService } from '../auth/services/authService.js';
import { PasswordField } from '../auth/components/FormControls.jsx';
export default function PasswordChange() {
  const [currentPassword, setCurrent] = useState(''),
    [password, setPassword] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (busy) return;
        setBusy(true);
        try {
          await api('/auth/password', {
            method: 'POST',
            body: { currentPassword, password },
          });
          await authService.refresh();
        } catch (e) {
          setError(e.message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <h3>Change real account password</h3>
      <p>All sessions will be revoked. Sign in again with your new password.</p>
      <PasswordField
        label="Current password"
        name="currentPassword"
        autoComplete="current-password"
        value={currentPassword}
        onChange={(e) => setCurrent(e.target.value)}
      />
      <PasswordField
        label="New password"
        name="newPassword"
        autoComplete="new-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      {error && <p role="alert">{error}</p>}
      <button className="secondary-button" disabled={busy}>
        Change password and sign out
      </button>
    </form>
  );
}
