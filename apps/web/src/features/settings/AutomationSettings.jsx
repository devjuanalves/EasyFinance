import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useWorkspace } from '../finance/WorkspaceContext.js';
import AppDialog from '../../components/ui/AppDialog.jsx';
import RecurringTemplateForm from '../income/components/RecurringTemplateForm.jsx';
import {
  SettingsPage,
  Field,
  Select,
  Feedback,
  ActivityLog,
} from './SettingsUI.jsx';
import { EVENTS, ZONES, automationEntityLabel } from './settingsService.js';
export default function AutomationSettings() {
  const { user, filters, ledger } = useWorkspace();
  return (
    <SettingsPage
      title="Automations & Notifications"
      description="Manage recurring workflows, reminders, and alerts."
    >
      {ledger.data && <Automations key={`${user.id}-${filters.workspaceId}`} />}
    </SettingsPage>
  );
}
function Automations() {
  const { settings, ledger, filters, command, persistent } = useWorkspace();
  const data = ledger.data,
    owner = settings.role === 'owner' && filters.scenario === 'normal';
  const [dialog, setDialog] = useState(null),
    [error, setError] = useState(''),
    [message, setMessage] = useState(''),
    [prefs, setPrefs] = useState(settings.preferences),
    [templateClient, setTemplateClient] = useState('');
  const [form, setForm] = useState({});
  const scoped = (values) =>
    values.filter((x) => x.workspaceId === filters.workspaceId);
  const clients = scoped(data.clients).filter((c) => !c.archived),
    templates = scoped(data.recurringRules),
    invoices = scoped(data.invoices).filter(
      (i) => !['draft', 'paid', 'cancelled'].includes(i.status),
    );
  function open(record) {
    setError('');
    setForm(
      record || {
        name: '',
        type: persistent ? 'alert' : 'draft',
        clientId: clients[0]?.id || '',
        templateId: '',
        invoiceId: invoices[0]?.id || '',
        timing: 'after',
        frequency: 'monthly',
        nextDate: data.asOf,
        timeZone: ZONES[0],
        status: 'active',
      },
    );
    setDialog({
      kind: 'editor',
      id: record?.id,
      creationId: crypto.randomUUID(),
    });
  }
  async function run(action, payload, success, close = true) {
    setError('');
    try {
      const result = await command(`settings:${action}`, payload);
      setMessage(
        result?.status === 'failed'
          ? `Simulation failed: ${result.error}`
          : success,
      );
      if (close) setDialog(null);
    } catch (e) {
      setError(e.message);
    }
  }
  const change = (key, value) =>
    setForm({
      ...form,
      [key]: value,
      ...(key === 'clientId' ? { templateId: '' } : {}),
    });
  const next = settings.automations
    .filter((a) => a.status === 'active')
    .map((a) => a.nextDate)
    .sort()[0];
  return (
    <>
      <Feedback error={!dialog && error} message={message} />
      <p className="partial-banner">
        Schedules are configuration only. Nothing runs in the background.
        {persistent
          ? 'Configurations persist, but execution is disabled. No email or financial action is performed.'
          : `Simulations use the fixed sample date ${data.asOf}; no email is delivered.`}
      </p>
      <div className="income-actions">
        <button
          className="primary-button"
          disabled={!owner}
          onClick={() => open()}
        >
          Create Automation
        </button>
        <button
          className="secondary-button"
          disabled={!owner || persistent}
          onClick={() => {
            setError('');
            setTemplateClient(clients[0]?.id || '');
            setDialog({ kind: 'template' });
          }}
        >
          Create Invoice Template
        </button>
        <a className="text-button" href="#automation-activity">
          View Activity
        </a>
      </div>
      {persistent && (
        <p>
          Recurring invoice draft templates and classification rule editing
          remain demonstration-only. Their persistent services are not
          available.
        </p>
      )}
      <div className="settings-kpis">
        {[
          [
            'Active Automations',
            settings.automations.filter((a) => a.status === 'active').length,
          ],
          [
            'Paused Automations',
            settings.automations.filter((a) => a.status === 'paused').length,
          ],
          [
            persistent ? 'Next Configured Date' : 'Next Scheduled Action',
            next || 'None',
          ],
          ['Recorded Runs', settings.runs.length],
        ].map(([label, value]) => (
          <article className="finance-card" key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </article>
        ))}
      </div>
      <section className="finance-card">
        <h2>Recurring Workflows & Reminders</h2>
        {!settings.automations.length ? (
          <p>
            No automations configured. Create a reviewable workflow to begin.
          </p>
        ) : (
          <table className="settings-table">
            <thead>
              <tr>
                <th>Automation</th>
                <th>Schedule</th>
                <th>Status / Mode</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {settings.automations.map((a) => (
                <tr key={a.id}>
                  <td data-label="Automation">
                    <strong>{a.name}</strong>
                    <small>
                      {a.type} · {automationEntityLabel(data, a)}
                    </small>
                  </td>
                  <td data-label="Schedule">
                    {a.frequency}
                    <small>
                      {a.nextDate} · {a.timeZone}
                    </small>
                  </td>
                  <td data-label="Status / Mode">
                    {a.status}
                    <small>
                      {persistent
                        ? 'Execution disabled'
                        : a.status === 'active'
                          ? 'Scheduled'
                          : 'Paused'}{' '}
                      ·{' '}
                      {a.type === 'draft'
                        ? 'Draft for review'
                        : 'Internal in-app review'}
                    </small>
                  </td>
                  <td data-label="Actions">
                    <div className="income-actions">
                      <button
                        className="text-button"
                        onClick={() => setDialog({ kind: 'view', record: a })}
                      >
                        View Automation
                      </button>
                      <button
                        className="text-button"
                        disabled={!owner}
                        onClick={() => open(a)}
                      >
                        Edit Automation
                      </button>
                      <button
                        className="text-button"
                        disabled={!owner}
                        onClick={() =>
                          run(
                            'toggleAutomation',
                            { id: a.id },
                            'Automation configuration updated.',
                          )
                        }
                      >
                        {a.status === 'active'
                          ? 'Pause Automation'
                          : 'Resume Automation'}
                      </button>
                      <button
                        className="text-button"
                        disabled={persistent || !owner || a.status !== 'active'}
                        onClick={() =>
                          setDialog({ kind: 'simulate', record: a })
                        }
                      >
                        {persistent
                          ? 'Execution Unavailable'
                          : 'Simulate Next Occurrence'}
                      </button>
                      <button
                        className="text-button settings-destructive"
                        disabled={!owner}
                        onClick={() => setDialog({ kind: 'delete', record: a })}
                      >
                        {persistent
                          ? 'Archive Automation'
                          : 'Delete Automation'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
      <section className="finance-card">
        <h2>Expense Classification Rules</h2>
        <p>
          {scoped(data.categoryRules || []).filter((r) => !r.archived).length}{' '}
          configured rules. Existing priorities and manual overrides remain
          unchanged.
        </p>
        <Link className="secondary-button" to="/expenses/categories">
          Manage Rules
        </Link>
      </section>
      <form
        className="finance-card"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          run(
            'preferences',
            prefs,
            'Notification preferences saved for you in this workspace.',
          );
        }}
      >
        <h2>Notification Preferences</h2>
        <p>
          {persistent
            ? 'Preferences persist for your identity and this workspace; event generation is not connected in API mode.'
            : 'In-app events apply to your identity and this workspace.'}{' '}
          Email delivery is unavailable. Daily/weekly summaries are
          configuration-only; they suppress immediate notifications and no
          digest is generated.
        </p>
        {Object.entries(EVENTS).map(([group, events]) => (
          <fieldset className="settings-notification-group" key={group}>
            <legend>{group}</legend>
            {events.map((event) => (
              <div className="settings-notification-row" key={event}>
                <span>
                  {event}
                  {[
                    'Transactions requiring review',
                    'Potential duplicates',
                    'Uncategorized transactions',
                    'Portfolio review reminder',
                    'Access revocation',
                  ].includes(event) && (
                    <small>
                      Saved preference only; event generation is not connected.
                    </small>
                  )}
                </span>
                <label>
                  <input
                    type="checkbox"
                    checked={prefs.enabled[event]}
                    onChange={(e) =>
                      setPrefs({
                        ...prefs,
                        enabled: {
                          ...prefs.enabled,
                          [event]: e.target.checked,
                        },
                      })
                    }
                  />
                  In-app <span className="sr-only">{event}</span>
                </label>
                <label>
                  <input type="checkbox" disabled />
                  Email unavailable <span className="sr-only">{event}</span>
                </label>
              </div>
            ))}
          </fieldset>
        ))}
        <div className="form-grid">
          <Select
            label="Notification Schedule"
            value={prefs.frequency}
            onChange={(v) => setPrefs({ ...prefs, frequency: v })}
            options={['immediate', 'daily', 'weekly']}
          />
          <Field
            label="Preferred Time"
            type="time"
            value={prefs.time}
            onChange={(e) => setPrefs({ ...prefs, time: e.target.value })}
          />
          <Select
            label="Notification Time Zone"
            value={prefs.timeZone}
            onChange={(v) => setPrefs({ ...prefs, timeZone: v })}
            options={ZONES}
          />
        </div>
        <button
          className="primary-button"
          disabled={filters.scenario !== 'normal'}
        >
          Save Notification Preferences
        </button>
      </form>
      <section id="automation-activity" className="finance-card">
        <h2>Automation Activity</h2>
        <p>
          {persistent
            ? 'Actual stored run history. No worker or execution endpoint is enabled.'
            : 'These records describe explicit simulations only.'}
        </p>
        {!settings.runs.length ? (
          <p>No executions recorded.</p>
        ) : (
          settings.runs
            .slice()
            .reverse()
            .map((r) => (
              <article className="settings-invitation" key={r.id}>
                <div>
                  <strong>
                    {r.name} · {r.status}
                  </strong>
                  <small>
                    {r.scheduledDate} · {r.timestamp}
                  </small>
                  {r.error && <p>{r.error}</p>}
                  {r.invoiceId && (
                    <Link to={`/income/invoices/${r.invoiceId}`}>
                      Review Invoice Draft
                    </Link>
                  )}
                </div>
                <button
                  className="text-button"
                  disabled={persistent || !owner}
                  onClick={() =>
                    run(
                      'run',
                      { id: r.automationId, occurrence: r.scheduledDate },
                      'Occurrence checked; an existing successful run is reused.',
                    )
                  }
                >
                  Retry Same Occurrence
                </button>
              </article>
            ))
        )}
      </section>
      <ActivityLog events={settings.events} />
      <AppDialog
        open={Boolean(dialog)}
        title={
          {
            editor: dialog?.id ? 'Edit Automation' : 'Create Automation',
            template: 'Create Invoice Template',
            view: 'Automation Details',
            delete: persistent ? 'Archive Automation?' : 'Delete Automation?',
            simulate: 'Simulate Scheduled Action?',
          }[dialog?.kind] || 'Automation'
        }
        onClose={() => setDialog(null)}
      >
        <Feedback error={error} />
        {dialog?.kind === 'editor' ? (
          <form
            className="income-form"
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              run(
                'automation',
                {
                  id: dialog.id,
                  creationId: dialog.creationId,
                  automation: form,
                },
                'Automation configuration saved. No background scheduler is running.',
              );
            }}
          >
            <Field
              label="Automation Name"
              value={form.name}
              onChange={(e) => change('name', e.target.value)}
            />
            <Select
              label="Automation Type"
              value={form.type}
              onChange={(v) => change('type', v)}
              options={[
                ...(!persistent ? [['draft', 'Recurring Invoice Draft']] : []),
                ['reminder', 'Invoice Reminder'],
                ['alert', 'Reviewable Financial Alert'],
              ]}
            />
            {form.type === 'draft' && (
              <>
                <Select
                  label="Related Client"
                  value={form.clientId}
                  onChange={(v) => change('clientId', v)}
                  options={[
                    ['', 'Select client'],
                    ...clients.map((c) => [c.id, c.name]),
                  ]}
                />
                <Select
                  label="Invoice Template"
                  value={form.templateId}
                  onChange={(v) => change('templateId', v)}
                  options={[
                    ['', 'Select template'],
                    ...templates
                      .filter((t) => t.clientId === form.clientId)
                      .map((t) => [t.id, t.name]),
                  ]}
                />
                <p>
                  Templates use the existing invoice service. Create one with
                  Create Invoice Template if needed.
                </p>
              </>
            )}
            {form.type === 'reminder' && (
              <>
                <Select
                  label="Related Invoice"
                  value={form.invoiceId}
                  onChange={(v) => change('invoiceId', v)}
                  options={[
                    ['', 'Select invoice'],
                    ...invoices.map((i) => [i.id, i.number]),
                  ]}
                />
                <Select
                  label="Reminder Timing"
                  value={form.timing}
                  onChange={(v) => change('timing', v)}
                  options={[
                    ['before', 'Before Due Date'],
                    ['on', 'On Due Date'],
                    ['after', 'After Due Date'],
                  ]}
                />
                <p>
                  Use an occurrence date matching the invoice due date and
                  selected timing. Internal reminder only; client-facing email
                  is unavailable.
                </p>
              </>
            )}
            <div className="form-grid">
              <Select
                label="Automation Frequency"
                value={form.frequency}
                onChange={(v) => change('frequency', v)}
                options={['weekly', 'fortnightly', 'monthly']}
              />
              <Field
                label="Next Preparation Date"
                type="date"
                value={form.nextDate}
                onChange={(e) => change('nextDate', e.target.value)}
              />
              <Select
                label="Automation Time Zone"
                value={form.timeZone}
                onChange={(v) => change('timeZone', v)}
                options={ZONES}
              />
              <Select
                label="Enabled Status"
                value={form.status}
                onChange={(v) => change('status', v)}
                options={['active', 'paused']}
              />
              <Field
                label="Delivery / Review Mode"
                value={
                  form.type === 'draft'
                    ? 'Draft for Review'
                    : 'Internal In-App Review'
                }
                readOnly
              />
            </div>
            <p>
              Calendar dates use the selected zone; no clock-triggered execution
              or automatic timezone conversion occurs.
            </p>
            <button className="primary-button">Save Automation</button>
          </form>
        ) : dialog?.kind === 'template' ? (
          <>
            <Select
              label="Template Client Selection"
              value={templateClient}
              onChange={setTemplateClient}
              options={[
                ['', 'Select client'],
                ...clients.map((c) => [c.id, c.name]),
              ]}
            />
            {clients.find((c) => c.id === templateClient) ? (
              <RecurringTemplateForm
                key={templateClient}
                client={clients.find((c) => c.id === templateClient)}
                onSaved={() => {
                  setDialog(null);
                  setMessage(
                    'Review template saved in the shared invoice store.',
                  );
                }}
              />
            ) : (
              <Link to="/income/clients">Manage Clients</Link>
            )}
          </>
        ) : dialog?.kind === 'delete' ? (
          <>
            <p>
              Archive or delete this configuration? Existing runs and financial
              records will remain.
            </p>
            <button
              className="secondary-button settings-destructive"
              onClick={() =>
                run(
                  'deleteAutomation',
                  { id: dialog.record.id, confirmed: true },
                  persistent
                    ? 'Automation archived; history preserved.'
                    : 'Automation deleted; history preserved.',
                )
              }
            >
              {persistent ? 'Confirm Archive' : 'Confirm Delete'}
            </button>
          </>
        ) : dialog?.kind === 'simulate' ? (
          <>
            <p>
              Manually simulate {dialog.record.name} for{' '}
              {dialog.record.nextDate}. This does not send email or record
              payment.
            </p>
            <button
              className="primary-button"
              onClick={() =>
                run(
                  'run',
                  { id: dialog.record.id },
                  'Simulation recorded. Review the activity below.',
                )
              }
            >
              Run Demo Once
            </button>
          </>
        ) : (
          <p>
            {dialog?.record?.name} · {dialog?.record?.frequency} ·{' '}
            {dialog?.record?.nextDate} · {dialog?.record?.timeZone} ·{' '}
            {dialog?.record?.status}. Review mode only; no real scheduler.
          </p>
        )}
        <button className="secondary-button" onClick={() => setDialog(null)}>
          Cancel
        </button>
      </AppDialog>
    </>
  );
}
