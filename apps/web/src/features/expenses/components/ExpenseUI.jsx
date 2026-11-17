import { NavLink, Link } from 'react-router-dom';
import { useWorkspace } from '../../finance/WorkspaceContext.js';
import { Field } from '../../income/components/IncomeUI.jsx';
import { money, dateLabel } from '../../finance/data/calculations.js';
import '../expenses.css';
export { Field };
export function ExpensePage({ title, subtitle, actions, children }) {
  const { ledger, setFilter } = useWorkspace();
  return (
    <main className="workspace-content income-page expenses-page">
      <nav className="income-tabs" aria-label="Expenses navigation">
        <NavLink to="/expenses" end>
          Overview
        </NavLink>
        <NavLink to="/expenses/transactions">Transactions</NavLink>
        <NavLink to="/expenses/categories">Categories & Rules</NavLink>
      </nav>
      <div className="page-heading">
        <div>
          <span className="app-badge">EXPENSES · SESSION DEMO</span>
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </div>
        <div className="income-actions">{actions}</div>
      </div>
      {ledger.isPending ? (
        <p role="status" className="finance-card">
          Loading expenses…
        </p>
      ) : ledger.isError ? (
        <section role="alert" className="finance-card">
          <h2>Expense data unavailable</h2>
          <p>{ledger.error.message}</p>
          <button
            className="secondary-button"
            onClick={() => setFilter('scenario', 'normal')}
          >
            Retry expense data
          </button>
        </section>
      ) : (
        <>
          {ledger.data?.coverageEnd < ledger.data?.asOf && (
            <p className="partial-banner">
              Partial data through {dateLabel(ledger.data.coverageEnd)}. Editing
              is unavailable.
            </p>
          )}
          {children}
        </>
      )}
    </main>
  );
}
export function CategorySelect({
  label = 'Expense category',
  value,
  onChange,
  type = 'expense',
  all = false,
  includeArchived = false,
}) {
  const { ledger, filters } = useWorkspace();
  return (
    <Field label={label}>
      <select
        aria-label={label}
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
      >
        {all && <option value="all">All categories</option>}
        <option value="">Uncategorized</option>
        {ledger.data?.categories
          .filter(
            (c) =>
              c.workspaceId === filters.workspaceId &&
              (!type || c.kind === type) &&
              (includeArchived || !c.archived || c.id === value) &&
              !['uncategorized', 'transfer'].includes(c.id),
          )
          .map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
              {c.archived ? ' (archived)' : ''}
            </option>
          ))}
      </select>
    </Field>
  );
}
export function CategoryName({ data, transaction }) {
  const splits = data.transactionSplits.filter(
    (s) => s.transactionId === transaction.id,
  );
  return splits.length
    ? `Split · ${splits.length} categories`
    : data.categories.find((c) => c.id === transaction.categoryId)?.name ||
        'Uncategorized';
}
export function TransactionTable({
  rows,
  data,
  selected = [],
  onSelect,
  onView,
}) {
  return (
    <div className="income-table-wrap">
      <table className="income-table expense-table">
        <caption className="sr-only">Financial transactions</caption>
        <thead>
          <tr>
            {onSelect && <th>Select</th>}
            <th>Date / Description</th>
            <th>Category / Account</th>
            <th>Type / Status</th>
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((t) => (
            <tr key={t.id}>
              {onSelect && (
                <td>
                  <input
                    type="checkbox"
                    aria-label={`Select ${t.description}`}
                    checked={selected.includes(t.id)}
                    onChange={() => onSelect(t.id)}
                  />
                </td>
              )}
              <th>
                <small>{dateLabel(t.date)}</small>
                {onView ? (
                  <button className="text-button" onClick={() => onView(t.id)}>
                    {t.description}
                  </button>
                ) : (
                  <Link
                    className="text-button"
                    to={`/expenses/transactions?id=${t.id}`}
                  >
                    {t.description}
                  </Link>
                )}
              </th>
              <td data-label="Category / Account">
                <CategoryName data={data} transaction={t} />
                <small>
                  {data.accounts.find((a) => a.id === t.accountId)?.name}
                </small>
              </td>
              <td data-label="Type / Status">
                {t.type}
                <small>
                  {t.excluded
                    ? 'Excluded'
                    : t.possibleDuplicate
                      ? 'Potential duplicate'
                      : t.reviewStatus || 'reviewed'}
                </small>
              </td>
              <td
                data-label="Amount"
                className={t.amount > 0 ? 'positive' : ''}
              >
                {money(t.amount, t.currency)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length && (
        <p className="empty-ledger">No transactions match these filters.</p>
      )}
    </div>
  );
}
export function Pagination({ page, pages, onChange }) {
  return (
    <div className="pagination">
      <span>
        Page {page} of {pages}
      </span>
      <button
        className="compact-button"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
      >
        Previous
      </button>
      <button
        className="compact-button"
        disabled={page >= pages}
        onClick={() => onChange(page + 1)}
      >
        Next
      </button>
    </div>
  );
}
