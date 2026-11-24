import { NavLink } from 'react-router-dom';
import { useWorkspace } from '../finance/WorkspaceContext.js';
import { Field } from '../income/components/IncomeUI.jsx';
import './settings.css';
export { Field };
export function Select({ label, value, onChange, options, disabled = false }) {
  return (
    <Field label={label}>
      <select
        aria-label={label}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((o) => (
          <option
            key={typeof o === 'string' ? o : o[0]}
            value={typeof o === 'string' ? o : o[0]}
          >
            {typeof o === 'string' ? o : o[1]}
          </option>
        ))}
      </select>
    </Field>
  );
}
export function SettingsPage({ title, description, actions, children }) {
  const { ledger, setFilter, filters, user, persistent } = useWorkspace();
  return (
    <main className="workspace-content income-page settings-page">
      <nav className="income-tabs" aria-label="Settings navigation">
        <NavLink
          to={
            persistent
              ? `/settings?workspace=${filters.workspaceId}`
              : '/settings'
          }
          end
        >
          Profile & Settings
        </NavLink>
        <NavLink
          to={
            persistent
              ? `/settings/sharing?workspace=${filters.workspaceId}`
              : '/settings/sharing'
          }
        >
          Sharing & Permissions
        </NavLink>
        <NavLink
          to={
            persistent
              ? `/settings/automations?workspace=${filters.workspaceId}`
              : '/settings/automations'
          }
        >
          Automations & Notifications
        </NavLink>
      </nav>
      <div className="page-heading">
        <div>
          <span className="app-badge">
            SETTINGS · {persistent ? 'PERSISTENT DEVELOPMENT' : 'SESSION DEMO'}{' '}
            · {user.role || 'no access'}
          </span>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        <div className="income-actions">{actions}</div>
      </div>
      {!persistent && (
        <details className="settings-demo">
          <summary>Demonstration states</summary>
          <Select
            label="Settings data state"
            value={filters.scenario}
            onChange={(v) => setFilter('scenario', v)}
            options={['normal', 'error', 'partial']}
          />
        </details>
      )}
      {ledger.isPending ? (
        <p role="status">Loading settings…</p>
      ) : ledger.isError ? (
        <section className="finance-card" role="alert">
          <p>Settings unavailable in this simulated error state.</p>
          <button
            className="secondary-button"
            onClick={() => setFilter('scenario', 'normal')}
          >
            Retry Settings
          </button>
        </section>
      ) : (
        <>
          {filters.scenario !== 'normal' && (
            <p className="partial-banner">
              Partial data. Editing is unavailable.
            </p>
          )}
          {children}
        </>
      )}
    </main>
  );
}
export function Feedback({ error, message }) {
  return (
    <>
      {error && (
        <p role="alert" className="partial-banner">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="settings-feedback">
          {message}
        </p>
      )}
    </>
  );
}
export function ActivityLog({ events }) {
  const { persistent } = useWorkspace();
  return (
    <section className="finance-card">
      <h2>{persistent ? 'Workspace Activity' : 'Session Activity'}</h2>
      <p>
        {persistent
          ? 'Recorded workspace changes; latest 100 events.'
          : 'Demonstration history only; not a durable audit trail.'}
      </p>
      {!events.length ? (
        <p>No changes recorded.</p>
      ) : (
        <ul className="settings-log">
          {events
            .slice()
            .reverse()
            .slice(0, 20)
            .map((e) => (
              <li key={e.id}>
                <strong>{e.type}</strong>
                <small>
                  {e.timestamp} · Actor {e.actor}
                </small>
              </li>
            ))}
        </ul>
      )}
    </section>
  );
}
