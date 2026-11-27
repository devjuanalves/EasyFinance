import { useState, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { WorkspaceContext, useWorkspace } from '../finance/WorkspaceContext.js';
import { useAuth } from '../auth/hooks/useAuth.js';
import { api } from '../../services/persistentApi.js';
import { Field } from '../income/components/IncomeUI.jsx';
import ProfileSettings from '../settings/ProfileSettings.jsx';
import SharingSettings from '../settings/SharingSettings.jsx';
import AutomationSettings from '../settings/AutomationSettings.jsx';
import AppDialog from '../../components/ui/AppDialog.jsx';
export default function PersistentSettings({ screen = 'profile' }) {
  const user = useAuth(),
    [params, setParams] = useSearchParams(),
    parent = useWorkspace(),
    cache = useQueryClient();
  const [token, setToken] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const ws = useQuery({
    queryKey: ['persistent', user.id, 'workspaces'],
    queryFn: () => api('/workspaces'),
    retry: false,
  });
  const selected = params.has('workspace')
    ? ws.data?.find((w) => w.id === params.get('workspace'))
    : ws.data?.[0];
  return (
    <>
      <section className="workspace-content settings-page">
        <p className="data-provenance">
          Persistent development settings · no email delivery or background
          execution
        </p>
        {ws.isPending ? (
          <p role="status">Loading workspaces…</p>
        ) : ws.isError ? (
          <p role="alert">{ws.error.message}</p>
        ) : (
          <Field label="Persistent workspace">
            <select
              aria-label="Persistent workspace"
              value={selected?.id || ''}
              onChange={(e) => {
                if (parent.confirmDiscard())
                  setParams({ workspace: e.target.value });
              }}
            >
              <option value="" disabled>
                Select workspace
              </option>
              {ws.data?.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name} · {w.role}
                </option>
              ))}
            </select>
          </Field>
        )}
        {screen === 'sharing' && (
          <details>
            <summary>Accept a local invitation</summary>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                setError('');
                try {
                  const r = await api('/invitations/accept', {
                    method: 'POST',
                    body: { token },
                  });
                  setToken('');
                  await cache.invalidateQueries({
                    queryKey: ['persistent', user.id],
                  });
                  setParams({ workspace: r.workspaceId });
                } catch (e) {
                  setError(e.message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <p>
                Sign in with the invited email. Paste the secret shared by the
                Owner through a trusted channel. No email is sent by this app.
              </p>
              <Field
                label="Invitation token"
                type="password"
                autoComplete="off"
                value={token}
                onChange={(e) => setToken(e.target.value)}
              />
              <button className="primary-button" disabled={busy}>
                Accept Invitation
              </button>
              {error && <p role="alert">{error}</p>}
            </form>
          </details>
        )}
      </section>
      {selected ? (
        <SettingsData
          key={`${user.id}-${selected.id}`}
          user={user}
          workspace={selected}
          screen={screen}
        />
      ) : (
        !ws.isPending && (
          <p role="alert" className="workspace-content">
            Select an authorized workspace.
          </p>
        )
      )}
    </>
  );
}
function SettingsData({ user, workspace, screen }) {
  const parent = useWorkspace(),
    cache = useQueryClient(),
    lock = useRef(false),
    [secret, setSecret] = useState(null);
  const root = `/workspaces/${workspace.id}`,
    key = ['persistent', user.id, workspace.id, 'settings'];
  const q = useQuery({
    queryKey: key,
    queryFn: () => api(root + '/settings'),
    retry: false,
  });
  const invoices = useQuery({
    queryKey: ['persistent', user.id, workspace.id, 'automation-invoices'],
    queryFn: async () => {
      const rows = [];
      for (const currency of ['AUD', 'USD', 'EUR']) {
        const r = await api(root + `/invoices?currency=${currency}&limit=100`);
        rows.push(...r.rows);
      }
      return rows;
    },
    enabled: screen === 'automations',
    retry: false,
  });
  if (q.isPending)
    return (
      <p className="workspace-content" role="status">
        Loading settings…
      </p>
    );
  if (q.isError)
    return (
      <section className="workspace-content">
        <p role="alert">{q.error.message}</p>
        <button onClick={() => q.refetch()}>Retry Settings</button>
      </section>
    );
  const d = q.data,
    automations = d.automations
      .filter((a) => a.status !== 'archived')
      .map((a) => ({
        id: a.id,
        name: a.name,
        type: a.type,
        frequency: a.frequency,
        timeZone: a.timezone,
        status: a.status,
        ...a.configJson,
        updatedAt: a.updatedAt,
      }));
  async function command(action, payload) {
    if (lock.current)
      throw new Error('A settings request is already in progress.');
    lock.current = true;
    try {
      let path,
        body,
        method = 'POST';
      if (action === 'settings:profile') {
        path = '/settings/profile';
        method = 'PATCH';
        body = {
          fullName: payload.fullName,
          preferences: Object.fromEntries(
            [
              'language',
              'currency',
              'dateFormat',
              'numberFormat',
              'timeZone',
              'monthStart',
            ].map((k) => [
              k,
              k === 'monthStart'
                ? Number(payload.preferences[k])
                : payload.preferences[k],
            ]),
          ),
        };
      } else if (action === 'settings:workspace') {
        path = '/settings/workspace';
        method = 'PATCH';
        body = Object.fromEntries(
          ['name', 'type', 'baseCurrency', 'timeZone'].map((k) => [
            k,
            payload[k],
          ]),
        );
      } else if (action === 'settings:preferences') {
        path = '/settings/notifications';
        method = 'PATCH';
        body = payload;
      } else if (action === 'settings:invite') {
        path = '/invitations';
        body = { email: payload.email, role: payload.role };
      } else if (action === 'settings:invitation') {
        if (payload.operation !== 'revoke')
          throw new Error(
            'Revoke this invitation and prepare a new local invitation.',
          );
        path = `/invitations/${payload.id}/revoke`;
        body = {};
      } else if (action === 'settings:member') {
        const m = d.members.find((m) => m.id === payload.id);
        path = `/members/${payload.id}`;
        method = 'PATCH';
        body = {
          role: payload.role || m.role,
          status: payload.operation === 'remove' ? 'revoked' : 'active',
        };
      } else if (
        [
          'settings:automation',
          'settings:toggleAutomation',
          'settings:deleteAutomation',
        ].includes(action)
      ) {
        const old = automations.find((a) => a.id === payload.id),
          f = payload.automation || old;
        body = Object.fromEntries(
          ['name', 'type', 'frequency', 'nextDate', 'timeZone', 'status'].map(
            (k) => [k, f[k]],
          ),
        );
        if (f.type === 'reminder') {
          body.invoiceId = f.invoiceId;
          body.timing = f.timing;
        }
        if (old) {
          path = `/automations/${old.id}`;
          method = 'PATCH';
          body.updatedAt = f.updatedAt || old.updatedAt;
        } else {
          path = '/automations';
          body.id = payload.creationId || crypto.randomUUID();
        }
        if (action === 'settings:toggleAutomation')
          body.status = old.status === 'active' ? 'paused' : 'active';
        if (action === 'settings:deleteAutomation') body.status = 'archived';
      } else
        throw new Error('This operation is unavailable in persistent mode.');
      const result = await api(root + path, { method, body });
      if (action === 'settings:invite') setSecret(result);
      await cache.invalidateQueries({ queryKey: ['persistent', user.id] });
      return result;
    } finally {
      lock.current = false;
    }
  }
  const settings = {
    ...d,
    members: d.members.map((m) => ({ ...m, joined: m.joinedAt.slice(0, 10) })),
    invitations: d.invitations.map((i) => ({
      ...i,
      expires: i.expiresAt.slice(0, 10),
    })),
    automations,
    preferences: d.notificationPreferences,
    runs: d.runs.map((r) => ({
      ...r,
      automationId: r.automationRuleId,
      name: d.automations.find((a) => a.id === r.automationRuleId)?.name,
      scheduledDate: r.scheduledFor,
      timestamp: r.finishedAt || r.startedAt,
    })),
    events: d.activity
      .map((e) => ({
        id: e.id,
        type: e.action,
        timestamp: e.createdAt,
        actor: e.actorUserId,
      }))
      .reverse(),
  };
  const data = {
    asOf: new Date().toISOString().slice(0, 10),
    clients: [],
    recurringRules: [],
    categoryRules: [],
    invoices: (invoices.data || []).map((i) => ({
      ...i,
      workspaceId: workspace.id,
    })),
    workspaces: [d.workspace],
  };
  return (
    <WorkspaceContext.Provider
      value={{
        ...parent,
        persistent: true,
        user: { ...user, ...d.profile, role: d.role },
        settings,
        command,
        filters: {
          ...parent.filters,
          workspaceId: workspace.id,
          scenario: 'normal',
        },
        ledger: { data, isPending: false, isError: false },
      }}
    >
      {screen === 'profile' ? (
        <>
          <p>
            <a href="/account-security">
              Account security and email verification
            </a>
          </p>
          <ProfileSettings />
        </>
      ) : screen === 'sharing' ? (
        <SharingSettings />
      ) : (
        <>
          <AutomationSettings />
          {invoices.isError && (
            <p role="alert">
              Invoice targets unavailable: {invoices.error.message}
            </p>
          )}
        </>
      )}
      <AppDialog
        open={!!secret}
        title="Local Invitation Prepared"
        onClose={() => setSecret(null)}
      >
        <p>
          No email was sent. Copy this secret once and share it securely with{' '}
          {secret?.email}. It is not available again after closing.
        </p>
        <Field
          label="Local invitation token"
          value={secret?.token || ''}
          readOnly
        />
        <p>
          Expires {secret?.expiresAt}. The recipient must sign in using the
          invited email.
        </p>
        <button className="secondary-button" onClick={() => setSecret(null)}>
          Close invitation secret
        </button>
      </AppDialog>
    </WorkspaceContext.Provider>
  );
}
