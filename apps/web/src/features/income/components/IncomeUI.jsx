import { NavLink, Link, useSearchParams } from 'react-router-dom';
import { useWorkspace } from '../../finance/WorkspaceContext.js';
import { money } from '../../finance/data/calculations.js';
import '../income.css';
export function IncomePage({
  title,
  subtitle,
  actions,
  children,
  persistent = false,
}) {
  const { ledger, setFilter } = useWorkspace();
  const [params] = useSearchParams();
  const suffix =
    persistent && params.get('workspace')
      ? '?workspace=' + params.get('workspace')
      : '';
  return (
    <main className="workspace-content income-page">
      <nav className="income-tabs" aria-label="Income navigation">
        <NavLink to={'/income' + suffix} end>
          Overview
        </NavLink>
        <NavLink to={'/income/invoices' + suffix}>Invoices</NavLink>
        <NavLink to={'/income/clients' + suffix}>Clients</NavLink>
      </nav>
      <div className="page-heading">
        <div>
          <span className="app-badge">
            {persistent
              ? 'INCOME & INVOICES · PERSISTENT DEVELOPMENT'
              : 'INCOME & INVOICES · SESSION DEMO'}
          </span>
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </div>
        <div className="income-actions">{actions}</div>
      </div>
      {persistent ? (
        children
      ) : ledger.isPending ? (
        <p role="status" className="finance-card">
          Loading income records…
        </p>
      ) : ledger.isError ? (
        <section role="alert" className="finance-card">
          <h2>Income data unavailable</h2>
          <p>{ledger.error.message}</p>
          <button
            className="secondary-button"
            onClick={() => setFilter('scenario', 'normal')}
          >
            Retry income data
          </button>
        </section>
      ) : (
        <>
          {!ledger.data || ledger.data.coverageEnd < ledger.data.asOf ? (
            <p className="partial-banner">
              Partial transaction coverage. Invoice balances use the 31 October
              status snapshot. Editing is unavailable.
            </p>
          ) : null}
          {children}
        </>
      )}
    </main>
  );
}
export function IncomeKpis({ values, currency }) {
  return (
    <div className="kpi-grid income-kpis">
      {values.map(([label, value, note]) => (
        <article className="kpi-card" key={label}>
          <h2>{label}</h2>
          <strong className="kpi-value">
            {typeof value === 'number' ? money(value, currency) : value}
          </strong>
          <p>{note}</p>
        </article>
      ))}
    </div>
  );
}
export function StatusBadge({ status }) {
  const labels = {
    issued: 'Issued · not sent',
    draft: 'Draft',
    prepared: 'Prepared · not sent',
    sent: 'Sent · mock history',
    partial: 'Partially Paid',
    paid: 'Paid',
    overdue: 'Overdue',
    cancelled: 'Cancelled',
  };
  return (
    <span className={`invoice-status status-${status}`}>
      {labels[status] || status}
    </span>
  );
}
export function ClientFilter({ value, onChange }) {
  const { ledger, filters } = useWorkspace();
  return (
    <label className="income-field">
      Client / income source
      <select
        aria-label="Client / income source"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="all">All clients and sources</option>
        {ledger.data?.clients
          .filter((c) => c.workspaceId === filters.workspaceId)
          .map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
              {c.archived ? ' (archived)' : ''}
            </option>
          ))}
      </select>
    </label>
  );
}
export function InvoiceLink({ invoice }) {
  return (
    <Link className="text-button" to={`/income/invoices/${invoice.id}`}>
      {invoice.number}
    </Link>
  );
}
export function Field({ label, children, ...props }) {
  return (
    <label className="income-field">
      <span>{label}</span>
      {children || <input aria-label={label} {...props} />}
    </label>
  );
}
export function Empty({ children = 'No records for this selection.' }) {
  return <p className="finance-card empty-ledger">{children}</p>;
}
