import { Link, useNavigate } from 'react-router-dom';
import { money, dateLabel, percentageChange } from '../data/calculations.js';
export function KpiCards({ summary, currency }) {
  const metrics = [
    ['Total Income', 'income'],
    ['Total Expenses', 'expenses'],
    ['Net Cash Flow', 'net'],
    ['Savings Rate', 'savingsRate'],
  ];
  return (
    <div className="kpi-grid">
      {metrics.map(([label, key]) => {
        const value = summary[key];
        const change =
          key === 'savingsRate'
            ? null
            : summary.previous
              ? percentageChange(value, summary.previous[key])
              : null;
        return (
          <article className="kpi-card" key={key}>
            <h2>
              {label}
              <span aria-hidden="true">
                {key === 'expenses' ? '▤' : key === 'savingsRate' ? '◇' : '↗'}
              </span>
            </h2>
            <strong className="kpi-value">
              {value === null
                ? 'Unavailable'
                : key === 'savingsRate'
                  ? `${value.toFixed(1)}%`
                  : money(value, currency)}
            </strong>
            <p>
              {key === 'savingsRate'
                ? value === null
                  ? 'No income in this period.'
                  : 'Net cash flow ÷ income'
                : change === null
                  ? 'Comparison unavailable'
                  : `${change >= 0 ? '+' : ''}${change.toFixed(1)}% vs prior equal-length period`}
            </p>
            <small>
              {key === 'net'
                ? 'Income minus expenses, not account balance'
                : key === 'expenses'
                  ? 'Internal transfers excluded'
                  : key === 'income'
                    ? 'Confirmed sample transactions only'
                    : 'No target or forecast assumed'}
            </small>
            {key === 'expenses' && (
              <Link className="text-button" to="/expenses">
                View expenses →
              </Link>
            )}
            {key === 'income' && (
              <Link className="text-button" to="/income">
                View income →
              </Link>
            )}
          </article>
        );
      })}
    </div>
  );
}
export function InsightsAndReviews({ summary, currency }) {
  const navigate = useNavigate();

  const largest = summary.categories[0];
  const change = summary.previous
    ? summary.expenses - summary.previous.expenses
    : null;
  return (
    <div className="insights-grid">
      <section className="finance-card">
        <h2>AI Financial Insights</h2>
        <span className="app-badge">
          Deterministic sample insights · No live AI
        </span>
        <article className="insight">
          <h3>
            {largest
              ? `${largest.name} is your largest expense category`
              : 'No spending insights yet'}
          </h3>
          <p>
            {largest
              ? `${money(largest.amount, currency)} of ${money(summary.expenses, currency)} recorded expenses.`
              : 'Choose another period or explore the future import workflow.'}
          </p>
          <button className="text-button" onClick={() => navigate('/expenses')}>
            Explore expenses →
          </button>
        </article>
        <article className="insight">
          <h3>
            {change === null
              ? 'Period comparison unavailable'
              : `Spending ${change >= 0 ? 'increased' : 'decreased'} by ${money(Math.abs(change), currency)}`}
          </h3>
          <p>
            {change === null
              ? 'Complete data for both equal-length periods is required.'
              : `Compared with ${dateLabel(summary.previousPeriod.start)} – ${dateLabel(summary.previousPeriod.end)}. No seasonal cause is assumed.`}
          </p>
        </article>
        <article className="insight">
          <h3>{summary.invoices.length} unpaid or partially paid invoices</h3>
          <p>
            {money(summary.outstanding, currency)} outstanding for invoices
            issued in the selected period. Status snapshot: 31 October 2026.
          </p>
          <button
            className="text-button"
            onClick={() => navigate('/income/invoices')}
          >
            View invoices →
          </button>
        </article>
      </section>
      <section className="finance-card">
        <h2>Needs Your Attention</h2>
        <p className="muted">
          Review flagged records before confirming any change.
        </p>
        {[
          [
            'Uncategorized transactions',
            summary.reviews.uncategorized,
            'Review Uncategorized Items',
          ],
          [
            'Possible duplicate charges',
            summary.reviews.duplicates,
            'Review Duplicates',
          ],
          [
            'Invoices awaiting reconciliation',
            summary.reviews.reconciliation,
            'View Invoices',
          ],
        ].map(([label, items, action]) => (
          <article className="review-item" key={label}>
            <h3>
              {items.length} {label.toLowerCase()}
            </h3>
            <p>
              {items.length
                ? 'Pending review · no automatic changes'
                : 'No items in the selected scope'}
            </p>
            <button
              className="compact-button"
              onClick={() =>
                action === 'View Invoices'
                  ? navigate(
                      items[0]
                        ? `/income/invoices/${items[0].id}`
                        : '/income/invoices',
                    )
                  : navigate(
                      action === 'Review Duplicates'
                        ? '/expenses/transactions?status=duplicate'
                        : '/expenses/transactions?status=uncategorized',
                    )
              }
            >
              {action}
            </button>
          </article>
        ))}
        <p className="muted">
          Suspected duplicates are included in totals until reviewed.
        </p>
      </section>
    </div>
  );
}
export function RecentTransactions({ summary, data, currency }) {
  const navigate = useNavigate();

  return (
    <section className="finance-card recent-transactions">
      <div className="section-heading">
        <div>
          <h2>Recent Financial Activity</h2>
          <p className="muted">
            {summary.rows.length} sample movements · including internal
            transfers
          </p>
        </div>
        <button
          className="text-button"
          onClick={() => navigate('/expenses/transactions')}
        >
          View all transactions →
        </button>
      </div>
      {!summary.rows.length ? (
        <p>No transactions for the selected period.</p>
      ) : (
        <table>
          <caption className="sr-only">
            Recent transactions in the selected financial scope
          </caption>
          <thead>
            <tr>
              <th>Description</th>
              <th>Category / type</th>
              <th>Account</th>
              <th>Date</th>
              <th>Amount</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {[...summary.rows]
              .reverse()
              .slice(0, 6)
              .map((t) => (
                <tr key={t.id}>
                  <th scope="row">{t.description}</th>
                  <td data-label="Category / type">
                    <span className="transaction-badge">
                      {data.categories.find((c) => c.id === t.categoryId)
                        ?.name || 'Uncategorized'}
                    </span>
                    <small>{t.type}</small>
                  </td>
                  <td data-label="Account">
                    {data.accounts.find((a) => a.id === t.accountId)?.name}
                  </td>
                  <td data-label="Date">{dateLabel(t.date)}</td>
                  <td
                    data-label="Amount"
                    className={t.amount > 0 ? 'positive' : ''}
                  >
                    <strong>{money(t.amount, currency)}</strong>
                  </td>
                  <td>
                    <button
                      className="text-button"
                      aria-label={`Open ${t.description}`}
                      onClick={() =>
                        navigate(`/expenses/transactions?id=${t.id}`)
                      }
                    >
                      Details
                    </button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
