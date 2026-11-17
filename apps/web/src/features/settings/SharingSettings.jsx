import { useState } from 'react';
import { useWorkspace } from '../finance/WorkspaceContext.js';
import AppDialog from '../../components/ui/AppDialog.jsx';
import {
  SettingsPage,
  Select,
  Field,
  Feedback,
  ActivityLog,
} from './SettingsUI.jsx';
import { formattedExample } from './settingsService.js';
export default function SharingSettings() {
  const { settings, user, command, filters } = useWorkspace();
  const [dialog, setDialog] = useState(null),
    [form, setForm] = useState({ email: '', role: 'editor', message: '' }),
    [error, setError] = useState(''),
    [message, setMessage] = useState('');
  const owner = settings.role === 'owner' && filters.scenario === 'normal';
  const active = settings.members.filter((m) => m.status === 'active');
  const open = (kind, record) => {
    setError('');
    setDialog({ kind, record });
    setForm(
      kind === 'invite'
        ? { email: '', role: 'editor', message: '' }
        : { role: record?.role || 'editor' },
    );
  };
  function execute(action, payload, success) {
    setError('');
    try {
      command(`settings:${action}`, payload);
      setMessage(success);
      setDialog(null);
    } catch (e) {
      setError(e.message);
    }
  }
  return (
    <SettingsPage
      title="Sharing & Permissions"
      description="Manage who can access your financial workspace."
      actions={
        <button
          className="primary-button"
          disabled={!owner}
          onClick={() => open('invite')}
        >
          Invite Member
        </button>
      }
    >
      <Feedback error={!dialog && error} message={message} />
      <section className="finance-card settings-workspace-summary">
        <div>
          <h2>{settings.workspace?.name}</h2>
          <p>Owner: {active.find((m) => m.role === 'owner')?.fullName}</p>
          <p>
            Each member has an individual identity. No password sharing or real
            invitation emails.
          </p>
        </div>
        <div>
          <strong>{active.length}</strong>
          <span>Active members</span>
        </div>
        <div>
          <strong>
            {settings.invitations.filter((i) => i.status === 'pending').length}
          </strong>
          <span>Pending invitations</span>
        </div>
      </section>
      <section className="finance-card">
        <h2>Current Members</h2>
        <div className="settings-table-wrap">
          <table className="settings-table">
            <thead>
              <tr>
                <th>Member</th>
                <th>Role</th>
                <th>Status / Joined</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {settings.members.map((m) => (
                <tr key={m.id}>
                  <td data-label="Member">
                    <strong>{m.fullName}</strong>
                    <small>{m.email}</small>
                  </td>
                  <td data-label="Role">
                    <span className="app-badge">{m.role}</span>
                  </td>
                  <td data-label="Status / Joined">
                    {m.status}
                    <small>
                      {formattedExample(user.preferences, 0, m.joined).date}
                    </small>
                  </td>
                  <td data-label="Actions">
                    <div className="income-actions">
                      <button
                        className="text-button"
                        onClick={() => open('permissions', m)}
                      >
                        View Permissions
                      </button>
                      {m.role !== 'owner' && m.status === 'active' && (
                        <>
                          <button
                            className="text-button"
                            disabled={!owner}
                            onClick={() => open('role', m)}
                          >
                            Change Role
                          </button>
                          <button
                            className="text-button settings-destructive"
                            disabled={!owner}
                            onClick={() => open('remove', m)}
                          >
                            Remove Member
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {active.length === 1 && <p>No additional members.</p>}
      </section>
      <section>
        <h2>Permission Matrix</h2>
        <div className="settings-role-grid">
          {[
            [
              'Owner',
              'View and edit financial records. Manage workspace settings, members and shared automations. Ownership removal is blocked.',
            ],
            [
              'Editor',
              'View and edit transactions, invoices and investments. Use the assistant. Cannot manage members, shared automations or owner-level settings.',
            ],
            [
              'Viewer',
              'Read permitted financial records and insights. Cannot edit finances, members, workspace settings or shared automations.',
            ],
          ].map(([role, description]) => (
            <article className="finance-card" key={role}>
              <span className="app-badge">{role}</span>
              <h3>{role}</h3>
              <p>{description}</p>
            </article>
          ))}
        </div>
      </section>
      <section className="finance-card">
        <h2>Invitations</h2>
        {settings.invitations.map((inv) => (
          <article className="settings-invitation" key={inv.id}>
            <div>
              <strong>{inv.email}</strong>
              <small>
                {inv.role} · {inv.status} · Expires{' '}
                {formattedExample(user.preferences, 0, inv.expires).date}
              </small>
            </div>
            <div className="income-actions">
              <button
                className="text-button"
                onClick={() => open('invitation', inv)}
              >
                View Invitation
              </button>
              {['pending', 'expired'].includes(inv.status) && (
                <button
                  className="text-button"
                  disabled={!owner}
                  onClick={() =>
                    execute(
                      'invitation',
                      { id: inv.id, operation: 'resend' },
                      'Invitation prepared again in this demo. No email sent.',
                    )
                  }
                >
                  Resend Invitation
                </button>
              )}
              {inv.status === 'pending' && (
                <>
                  <button
                    className="text-button settings-destructive"
                    disabled={!owner}
                    onClick={() =>
                      execute(
                        'invitation',
                        { id: inv.id, operation: 'revoke' },
                        'Invitation revoked. It can no longer be accepted.',
                      )
                    }
                  >
                    Revoke Invitation
                  </button>
                  <button
                    className="text-button"
                    disabled={!owner}
                    onClick={() => open('accept', inv)}
                  >
                    Simulate Acceptance
                  </button>
                </>
              )}
            </div>
          </article>
        ))}
        {!settings.invitations.length && (
          <p>No invitations in this workspace.</p>
        )}
      </section>
      <ActivityLog events={settings.events} />
      <AppDialog
        open={Boolean(dialog)}
        title={
          {
            invite: 'Invite Member',
            role: 'Change Role',
            remove: 'Remove Member?',
            permissions: 'Member Permissions',
            invitation: 'Invitation Details',
            accept: 'Simulate Invitation Acceptance?',
          }[dialog?.kind] || 'Member'
        }
        onClose={() => setDialog(null)}
      >
        <Feedback error={error} />
        {dialog?.kind === 'invite' ? (
          <form
            className="income-form"
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              execute(
                'invite',
                form,
                'Invitation prepared in this demo. Email delivery is not configured.',
              );
            }}
          >
            <Field
              label="Invitation Email"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
            <Select
              label="Invitation Role"
              value={form.role}
              onChange={(v) => setForm({ ...form, role: v })}
              options={['editor', 'viewer']}
            />
            <Field
              label="Optional Message"
              value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
            />
            <p>
              Creates a pending record only; access requires explicit demo
              acceptance.
            </p>
            <button className="primary-button">Send Invitation (Demo)</button>
          </form>
        ) : dialog?.kind === 'role' ? (
          <form
            className="income-form"
            onSubmit={(e) => {
              e.preventDefault();
              execute(
                'member',
                { id: dialog.record.id, role: form.role },
                'Member role updated.',
              );
            }}
          >
            <p>{dialog.record.email}</p>
            <Select
              label="Member Role"
              value={form.role}
              onChange={(v) => setForm({ ...form, role: v })}
              options={['editor', 'viewer']}
            />
            <button className="primary-button">Save Role</button>
          </form>
        ) : dialog?.kind === 'remove' ? (
          <>
            <p>
              This person will lose access to the shared workspace. Financial
              history is preserved.
            </p>
            <button
              className="secondary-button settings-destructive"
              onClick={() =>
                execute(
                  'member',
                  {
                    id: dialog.record.id,
                    operation: 'remove',
                    confirmed: true,
                  },
                  'Access revoked. Financial history preserved.',
                )
              }
            >
              Remove Access
            </button>
          </>
        ) : dialog?.kind === 'accept' ? (
          <>
            <p>
              Explicitly simulate acceptance by {dialog.record.email}. This is
              not verified email ownership or a real login.
            </p>
            <button
              className="primary-button"
              onClick={() =>
                execute(
                  'invitation',
                  {
                    id: dialog.record.id,
                    operation: 'accept',
                    confirmed: true,
                  },
                  'Demo invitation accepted; membership is now active.',
                )
              }
            >
              Confirm Demo Acceptance
            </button>
          </>
        ) : (
          <p>
            {dialog?.record?.email} · {dialog?.record?.role} ·{' '}
            {dialog?.record?.status}
            <br />
            {dialog?.record?.message ||
              'See the permission matrix for this role. Frontend controls are not production security.'}
          </p>
        )}
        <button className="secondary-button" onClick={() => setDialog(null)}>
          Cancel
        </button>
      </AppDialog>
    </SettingsPage>
  );
}
