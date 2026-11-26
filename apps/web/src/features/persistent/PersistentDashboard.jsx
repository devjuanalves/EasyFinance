import { useState, useId } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api, formatMinor } from '../../services/persistentApi.js';
import { Field, IncomeKpis } from '../income/components/IncomeUI.jsx';
import { usePersistentWorkspace } from './usePersistentWorkspace.js';
export default function PersistentDashboard({ home = false }) {
  const [routeParams] = useSearchParams();
  const scope = usePersistentWorkspace(),
    { wid, workspaces, selected, setWorkspace, prefix } = scope;
  const today = new Date().toISOString().slice(0, 10);
  const [currency, setCurrency] = useState('AUD'),
    [accountId, setAccount] = useState(''),
    [categoryId, setCategory] = useState(routeParams.get('category') || ''),
    [start, setStart] = useState(today.slice(0, 7) + '-01'),
    [end, setEnd] = useState(today);
  const params = new URLSearchParams({
    currency,
    start,
    end,
    ...(accountId ? { accountId } : {}),
    ...(categoryId ? { categoryId } : {}),
  });
  const query = useQuery({
    queryKey: [...prefix, 'dashboard', params.toString()],
    enabled: !!wid,
    queryFn: ({ signal }) =>
      api(`/workspaces/${wid}/dashboard?${params}`, { signal }),
    retry: false,
  });
  const s = query.data,
    money = (value) =>
      value === null ? 'Unavailable' : formatMinor(value, currency);
  const link = (path) =>
    `${path}${path.includes('?') ? '&' : '?'}workspace=${wid || ''}`;
  return (
    <main
      className={`workspace-content ${home ? 'home-page' : 'dashboard-page'}`}
    >
      <div className={home ? 'conversation-heading' : 'page-heading'}>
        <div>
          <span className="app-badge">
            PERSISTED FINANCIAL RECORDS · NO LIVE AI
          </span>
          <h1>
            {home
              ? `Welcome, ${scope.user.fullName.split(' ')[0]}.`
              : 'Financial Overview'}
          </h1>
          <p>
            {home
              ? 'Your recorded finances, with links to review and manage them.'
              : 'Cash, receivables and manually valued holdings are reported separately.'}
          </p>
        </div>
        <Link
          className="compact-button brand-button"
          to={link('/expenses/transactions?add=1')}
        >
          ＋ Add Transaction
        </Link>
      </div>
      <section className="finance-card income-filter-panel">
        <div className="form-grid">
          <Field label="Persistent workspace">
            <select
              aria-label="Persistent workspace"
              value={wid || ''}
              onChange={(e) => {
                setWorkspace(e.target.value);
                setAccount('');
                setCategory('');
              }}
            >
              {workspaces.data?.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name} · {w.role}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Currency">
            <select
              aria-label="Currency"
              value={currency}
              onChange={(e) => {
                setCurrency(e.target.value);
                setAccount('');
              }}
            >
              {['AUD', 'EUR', 'USD'].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </Field>
          <Field
            label="From date"
            type="date"
            value={start}
            onChange={(e) => setStart(e.target.value)}
          />
          <Field
            label="To date"
            type="date"
            value={end}
            max={today}
            onChange={(e) => setEnd(e.target.value)}
          />
          <Field label="Financial account">
            <select
              aria-label="Financial account"
              value={accountId}
              onChange={(e) => setAccount(e.target.value)}
            >
              <option value="">All accounts</option>
              {s?.accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Category">
            <select
              aria-label="Category"
              value={categoryId}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="">All categories</option>
              {s?.categoryOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.archivedAt ? ' (archived)' : ''}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </section>
      {(workspaces.isPending || (wid && query.isPending)) && (
        <p role="status">Loading authorized financial records…</p>
      )}
      {(workspaces.isError || query.isError) && (
        <div className="finance-card" role="alert">
          <p>{workspaces.error?.message || query.error?.message}</p>
          <button
            className="compact-button"
            onClick={() => {
              workspaces.refetch();
              query.refetch();
            }}
          >
            Retry
          </button>
        </div>
      )}
      {!workspaces.isPending && !selected && (
        <p>Select an authorized workspace.</p>
      )}
      {s && !query.isError && (
        <>
          <p className="data-provenance">
            {start} – {end} · {currency} native amounts · No exchange-rate
            conversion. Included recorded transactions only; completeness
            against external bank records is unknown.
          </p>
          <IncomeKpis
            values={[
              [
                'Total Income',
                money(s.incomeMinor),
                'Confirmed receipts by booking date; invoices are not cash',
              ],
              [
                'Total Expenses',
                money(s.expenseMinor),
                'Transfers and excluded rows omitted; splits classify the parent',
              ],
              [
                'Net Cash Flow',
                money(s.netMinor),
                'Income minus expenses, not account balance',
              ],
              [
                'Savings Rate',
                s.savingsRate === null ? 'Unavailable' : s.savingsRate + '%',
                'Net cash flow ÷ income; truncated to two decimal places',
              ],
            ]}
          />
          <p className="scope-note">
            Prior equal-length period {s.previousStart} – {s.previousEnd}:
            income {money(s.previous.incomeMinor)}, expenses{' '}
            {money(s.previous.expenseMinor)}. No forecast or seasonal
            explanation.
          </p>
          {!s.recent.length && (
            <p className="empty-ledger">No transactions for this selection.</p>
          )}
          <div className="charts-grid">
            <section className="finance-card">
              <h2>Cash Flow</h2>
              <ReportChart buckets={s.buckets} currency={currency} />
            </section>
            <section className="finance-card">
              <h2>Expenses by Category</h2>
              <div className="category-chart">
                <ul>
                  {s.categories.map((c) => (
                    <li key={c.id}>
                      <span>{c.name}</span>
                      <strong>{money(c.amountMinor)}</strong>
                    </li>
                  ))}
                </ul>
                {!s.categories.length && <p>No expenses in this selection.</p>}
              </div>
              <Link to={link('/expenses/categories')}>Manage Categories →</Link>
            </section>
          </div>
          <section className="finance-card balance-section">
            <h2>Account Balances</h2>
            <strong className="kpi-value">{money(s.balanceMinor)}</strong>
            <p>
              Opening balances plus all included signed movements through {end},
              including transfers. Balances before an account’s opening date are
              unavailable; these are recorded balances, not bank-verified
              available funds. Category filters cannot allocate account
              balances.
            </p>
            <p>
              Balance trend unavailable: a historical opening-balance contract
              is not implemented.
            </p>
          </section>
          <div className="insights-grid">
            <section className="finance-card">
              <h2>Recorded Financial Summary</h2>
              <p>
                {s.categories[0]
                  ? `${s.categories[0].name} is the largest recorded expense category: ${money(s.categories[0].amountMinor)}.`
                  : 'No recorded spending in this scope.'}
              </p>
              <h3>Outstanding Receivables</h3>
              <strong className="kpi-value">{money(s.outstandingMinor)}</strong>
              <p>
                {s.unpaidCount} unpaid issued invoices. Issue dates use the
                selected period; allocations reflect current confirmed payments.
                Category filter does not apply.
              </p>
              <Link to={link('/income/invoices')}>View Invoices →</Link>
            </section>
            <section className="finance-card">
              <h2>Needs Your Attention</h2>
              <p>{s.uncategorizedCount} uncategorized included transactions.</p>
              <Link to={link('/expenses/transactions')}>
                Review Transactions →
              </Link>
              <p>
                Automatic duplicate detection and bank reconciliation
                suggestions are unavailable here. Review CSV candidates
                explicitly before confirmation.
              </p>
              <Link to={link('/expenses/import')}>Import Statement →</Link>
            </section>
          </div>
          <section className="finance-card investment-dashboard-summary">
            <h2>Investment Portfolio</h2>
            <strong className="kpi-value">
              {money(s.portfolio.valueMinor)}
            </strong>
            <p>
              Remaining cost basis: {money(s.portfolio.basisMinor)}. Unrealized
              difference: {money(s.portfolio.unrealizedMinor)}.
            </p>
            <p>
              Manual valuation dates:{' '}
              {s.portfolio.valuationDates.join(', ') || 'None'}. As of {end};
              all investment accounts in this workspace/currency. Cash-account
              and category filters do not allocate holdings. Missing or
              invalidated valuations remain unavailable; no live prices or cash
              postings.
            </p>
            <Link to={link('/investments')}>View Investments →</Link>
          </section>
          <section className="finance-card recent-transactions">
            <h2>Recent Financial Activity</h2>
            <p>
              Up to six included parent records; a category slice may represent
              only part of a split parent.
            </p>
            {s.recent.map((t) => (
              <article className="rule-card" key={t.id}>
                <strong>{t.description}</strong>
                <p>
                  {t.date} · {t.type} · {money(t.amountMinor)}
                </p>
                <Link to={link('/expenses/transactions')}>
                  View Transactions
                </Link>
              </article>
            ))}
          </section>
        </>
      )}
      {home && (
        <>
          <section
            className="quick-actions"
            aria-label="Quick financial actions"
          >
            {[
              ['Create Invoice', '/income/invoices/new'],
              ['Import Statement', '/expenses/import'],
              ['Add Investment', '/investments/new'],
              ['View Dashboard', '/dashboard'],
            ].map(([label, path]) => (
              <Link className="compact-button" key={path} to={link(path)}>
                {label} ↗
              </Link>
            ))}
          </section>
          <section className="finance-card">
            <h2>Financial Assistant</h2>
            <p>
              AI chat, conversation history and attachment processing are
              unavailable in API mode. The summary above is calculated from
              authorized records.
            </p>
            <label>
              Message
              <textarea disabled placeholder="AI service unavailable" />
            </label>
          </section>
        </>
      )}
    </main>
  );
}
export function ReportChart({ buckets, currency }) {
  const id = useId(),
    values = buckets.flatMap((b) => [
      BigInt(b.incomeMinor),
      BigInt(b.expenseMinor),
    ]),
    max = values.reduce((a, b) => (a > b ? a : b), 1n);
  const points = (key) =>
    buckets
      .map(
        (b, i) =>
          `${50 + (i * 380) / Math.max(1, buckets.length - 1)},${200 - Number((BigInt(b[key]) * 16000n) / max) / 100}`,
      )
      .join(' ');
  return (
    <div className="financial-chart">
      <svg viewBox="0 0 480 240" role="img" aria-labelledby={id}>
        <title id={id}>
          Recorded income and expenses in {currency}; exact values in table
        </title>
        <polyline className="income-line" points={points('incomeMinor')} />
        <polyline className="expense-line" points={points('expenseMinor')} />
        {buckets.map((b, i) => (
          <text
            key={b.start}
            x={50 + (i * 380) / Math.max(1, buckets.length - 1)}
            y="225"
            textAnchor="middle"
          >
            {b.start.slice(5)}
          </text>
        ))}
      </svg>
      <div className="chart-legend">
        <span>Income</span>
        <span>Expenses</span>
      </div>
      <details>
        <summary>View cash flow data</summary>
        <table className="chart-data">
          <thead>
            <tr>
              <th>Dates</th>
              <th>Income</th>
              <th>Expenses</th>
            </tr>
          </thead>
          <tbody>
            {buckets.map((b) => (
              <tr key={b.start}>
                <th>
                  {b.start} – {b.end}
                </th>
                <td>{formatMinor(b.incomeMinor, currency)}</td>
                <td>{formatMinor(b.expenseMinor, currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
