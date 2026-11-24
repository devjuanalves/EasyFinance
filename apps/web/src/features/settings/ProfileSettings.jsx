import PasswordChange from '../persistent/PasswordChange.jsx';
import {
  CURRENCIES,
  LANGUAGES as LANGUAGE_LABELS,
} from '../auth/validation/authValidation.js';
import { useState, useEffect } from 'react';
import { useBlocker } from 'react-router-dom';
import { useWorkspace } from '../finance/WorkspaceContext.js';
import { authService } from '../auth/services/authService.js';
import AppDialog from '../../components/ui/AppDialog.jsx';
import { SettingsPage, Field, Select, Feedback } from './SettingsUI.jsx';
import { LANGUAGES, ZONES, formattedExample } from './settingsService.js';
export default function ProfileSettings() {
  const { user, filters, ledger } = useWorkspace();
  return (
    <SettingsPage
      title="Profile & Settings"
      description="Manage your account, preferences, and security."
    >
      {ledger.data && <ProfileForm key={`${user.id}-${filters.workspaceId}`} />}
    </SettingsPage>
  );
}
function ProfileForm() {
  const {
    persistent,
    user,
    settings,
    command,
    setUnsaved,
    confirmDiscard,
    setNotice,
    setFilter,
    filters,
  } = useWorkspace();
  const [form, setForm] = useState({
      fullName: user.fullName,
      preferences: { ...user.preferences },
    }),
    [saved, setSaved] = useState(form),
    [editing, setEditing] = useState(false),
    [workspace, setWorkspace] = useState({ ...settings.workspace }),
    [workspaceSaved, setWorkspaceSaved] = useState(workspace),
    [error, setError] = useState(''),
    [message, setMessage] = useState(''),
    [saving, setSaving] = useState(false),
    [deletion, setDeletion] = useState(false);
  const dirty =
    JSON.stringify(form) !== JSON.stringify(saved) ||
    JSON.stringify(workspace) !== JSON.stringify(workspaceSaved);
  const blocker = useBlocker(dirty);
  useEffect(() => {
    setUnsaved(dirty ? 'settings' : false);
    const handle = (e) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handle);
    return () => {
      setUnsaved(false);
      window.removeEventListener('beforeunload', handle);
    };
  }, [dirty, setUnsaved]);
  const pref = (key, value) =>
    setForm({ ...form, preferences: { ...form.preferences, [key]: value } });
  const example = formattedExample(form.preferences);
  async function saveProfile(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    await Promise.resolve();
    try {
      await command('settings:profile', form);
      setSaved(form);
      setEditing(false);
      setMessage(
        persistent
          ? 'Profile and personal preferences saved.'
          : 'Profile and personal preferences saved for this session.',
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }
  const unavailable = (title) =>
    setNotice({
      title,
      body: 'Unavailable: authentication is simulated. No password, remote session, or security configuration has been changed.',
    });
  return (
    <>
      <Feedback error={error} message={message} />
      <div className="settings-profile-grid">
        <div className="settings-stack">
          <form className="settings-stack" onSubmit={saveProfile} noValidate>
            <section className="finance-card">
              <div className="section-heading">
                <h2>Personal Profile</h2>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setEditing(true)}
                >
                  Edit Profile
                </button>
              </div>
              <div className="settings-person">
                <span className="avatar">
                  {user.fullName.slice(0, 2).toUpperCase()}
                </span>
                <div>
                  <strong>{user.fullName}</strong>
                  <p>
                    {persistent
                      ? 'Authenticated identity'
                      : 'Individual demo identity'}{' '}
                    · email is read-only
                  </p>
                </div>
              </div>
              <div className="form-grid">
                <Field
                  label="Full Name"
                  value={form.fullName}
                  readOnly={!editing}
                  onChange={(e) =>
                    setForm({ ...form, fullName: e.target.value })
                  }
                />
                <Field label="Email Address" value={user.email} readOnly />
                <Select
                  label="Preferred Language"
                  value={form.preferences.language}
                  onChange={(v) => pref('language', v)}
                  options={LANGUAGES.map((code) => [
                    code,
                    LANGUAGE_LABELS[code],
                  ])}
                />
              </div>
              <p>
                Language selection is saved; this V1 interface remains in
                English. Initials replace avatar uploads.
              </p>
            </section>
            <section className="finance-card">
              <h2>Financial Preferences</h2>
              <div className="form-grid">
                <Select
                  label="Primary Currency"
                  value={form.preferences.currency}
                  onChange={(v) => pref('currency', v)}
                  options={CURRENCIES}
                />
                <Select
                  label="Date Format"
                  value={form.preferences.dateFormat}
                  onChange={(v) => pref('dateFormat', v)}
                  options={['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD']}
                />
                <Select
                  label="Number Format"
                  value={form.preferences.numberFormat}
                  onChange={(v) => pref('numberFormat', v)}
                  options={['1,234.56', '1.234,56']}
                />
                <Select
                  label="Personal Time Zone"
                  value={form.preferences.timeZone}
                  onChange={(v) => pref('timeZone', v)}
                  options={[
                    ...new Set(
                      [
                        ...ZONES,
                        form.preferences.timeZone,
                        workspace.timeZone,
                      ].filter(Boolean),
                    ),
                  ]}
                />
                <Field
                  label="Start of Financial Month"
                  type="number"
                  min="1"
                  max="28"
                  value={form.preferences.monthStart}
                  onChange={(e) => pref('monthStart', e.target.value)}
                />
              </div>
              <p>
                Preview: {example.date} · {form.preferences.currency}{' '}
                {example.number}
              </p>
              <p>
                Formats apply to this preview and Settings dates. Existing
                financial screens retain their established formatting and fixed
                reporting periods. Time zone and month start are stored
                preferences; historical dates and amounts never change.
              </p>
              <button
                type="button"
                className="text-button"
                disabled={
                  !['AUD', 'EUR', 'USD'].includes(form.preferences.currency)
                }
                onClick={() => setFilter('currency', form.preferences.currency)}
              >
                Use selected native currency filter
              </button>
              <p>
                Only AUD, EUR and USD have implemented native financial filters.
                No foreign exchange conversion. Workspace base currency is
                separate.
              </p>
              <div className="income-actions">
                <button
                  className="primary-button"
                  disabled={saving || filters.scenario !== 'normal'}
                >
                  {saving ? 'Saving…' : 'Save Changes'}
                </button>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => {
                    setForm(saved);
                    setEditing(false);
                    setError('');
                  }}
                >
                  Cancel Profile Changes
                </button>
              </div>
            </section>
          </form>
          <form
            className="finance-card"
            noValidate
            onSubmit={async (e) => {
              e.preventDefault();
              setError('');
              try {
                await command('settings:workspace', workspace);
                setWorkspaceSaved(workspace);
                setMessage(
                  'Workspace settings saved. Historical financial records are unchanged.',
                );
              } catch (e) {
                setError(e.message);
              }
            }}
          >
            <h2>Workspace Configuration</h2>
            <p>
              Shared configuration applies to this workspace. Only the Owner may
              edit.
            </p>
            <fieldset
              disabled={
                settings.role !== 'owner' || filters.scenario !== 'normal'
              }
            >
              <div className="form-grid">
                <Field
                  label="Workspace Name"
                  value={workspace.name || ''}
                  onChange={(e) =>
                    setWorkspace({ ...workspace, name: e.target.value })
                  }
                />
                <Select
                  label="Workspace Type"
                  value={workspace.type || 'personal'}
                  onChange={(v) => setWorkspace({ ...workspace, type: v })}
                  options={['personal', 'shared', 'business']}
                />
                <Select
                  label="Workspace Base Currency"
                  disabled={persistent}
                  value={workspace.baseCurrency || 'AUD'}
                  onChange={(v) =>
                    setWorkspace({ ...workspace, baseCurrency: v })
                  }
                  options={CURRENCIES}
                />
                <Select
                  label="Workspace Time Zone"
                  value={workspace.timeZone || ZONES[0]}
                  onChange={(v) => setWorkspace({ ...workspace, timeZone: v })}
                  options={[
                    ...new Set(
                      [
                        ...ZONES,
                        form.preferences.timeZone,
                        workspace.timeZone,
                      ].filter(Boolean),
                    ),
                  ]}
                />
              </div>
              <p>
                {persistent
                  ? 'Base currency is locked in this persistent workflow.'
                  : 'Base currency is metadata; existing accounts and transactions retain their native currencies.'}
              </p>
              <div className="income-actions">
                <button className="primary-button">
                  Save Workspace Changes
                </button>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setWorkspace(workspaceSaved)}
                >
                  Cancel Workspace Changes
                </button>
              </div>
            </fieldset>
            {settings.role !== 'owner' && (
              <p>Permission denied: workspace settings require Owner access.</p>
            )}
          </form>
        </div>
        <div className="settings-stack">
          <section className="finance-card">
            <h2>Account Security</h2>
            {persistent ? (
              <>
                <p>
                  Authenticated HttpOnly session. Password changes revoke all
                  sessions.
                </p>
                <PasswordChange />
                <p>
                  Two-factor authentication and remote device management remain
                  unavailable.
                </p>
              </>
            ) : (
              <>
                <p>
                  Current session: {user.email}. In-memory demonstration; reload
                  clears it. Device and remote session information is
                  unavailable.
                </p>
                {[
                  'Change Password',
                  'Sign Out Other Sessions',
                  'Configure Two-Factor Authentication',
                ].map((label) => (
                  <div className="settings-security" key={label}>
                    <span>
                      {label}
                      <small>Unavailable in this demo</small>
                    </span>
                    <button
                      className="secondary-button"
                      onClick={() => unavailable(label)}
                    >
                      View limitation
                    </button>
                  </div>
                ))}
                <button
                  className="secondary-button"
                  onClick={() =>
                    setNotice({
                      title: 'Current Session',
                      body: `${user.email} · simulated session only. No remote devices or verified location are available.`,
                    })
                  }
                >
                  View Current Session
                </button>
              </>
            )}
          </section>
          <section className="finance-card settings-danger">
            <h2>Account Actions</h2>
            <button
              className="secondary-button"
              onClick={() => {
                if (confirmDiscard()) authService.signOut();
              }}
            >
              Sign Out
            </button>
            <p>
              Account deletion is unavailable. Confirmation does not send a
              request or delete records.
            </p>
            <button
              className="secondary-button settings-destructive"
              onClick={() => setDeletion(true)}
            >
              Request Account Deletion
            </button>
          </section>
        </div>
      </div>
      <AppDialog
        open={deletion}
        title="Request Account Deletion?"
        onClose={() => setDeletion(false)}
      >
        <p>
          This demonstration cannot delete an account or send a deletion
          request.
        </p>
        <div className="income-actions">
          <button
            className="secondary-button"
            onClick={() => setDeletion(false)}
          >
            Cancel
          </button>
          <button
            className="primary-button"
            onClick={() => {
              setDeletion(false);
              setMessage(
                'Demo confirmation only. No deletion request sent; no records deleted.',
              );
            }}
          >
            Confirm Demo Request
          </button>
        </div>
      </AppDialog>
      <AppDialog
        open={blocker.state === 'blocked'}
        title="Unsaved Settings Changes"
        onClose={() => blocker.reset?.()}
      >
        <p>Keep editing or discard these unsaved changes?</p>
        <div className="income-actions">
          <button className="secondary-button" onClick={() => blocker.reset()}>
            Keep Editing
          </button>
          <button className="primary-button" onClick={() => blocker.proceed()}>
            Discard Changes
          </button>
        </div>
      </AppDialog>
    </>
  );
}
