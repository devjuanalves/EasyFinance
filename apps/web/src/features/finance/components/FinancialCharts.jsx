import { useId } from 'react';
import { chartBuckets, money } from '../data/calculations.js';
export function CashFlowChart({ summary, currency, balance = false }) {
  const id = useId();
  const rows = chartBuckets(summary);
  const values = rows.flatMap((r) =>
    balance ? [r.balance || 0] : [r.income, r.expenses],
  );
  const min = Math.min(0, ...values),
    max = Math.max(100, ...values);
  const y = (n) => 200 - ((n - min) / (max - min)) * 160;
  const x = (i) => 55 + (i * 390) / Math.max(1, rows.length - 1);
  const points = (key) =>
    rows.map((r, i) => `${x(i)},${y(r[key] || 0)}`).join(' ');
  return (
    <div className="financial-chart">
      {balance && summary.balance === null ? (
        <p className="chart-empty">
          Balance trend is unavailable for this scope. Select all participants
          and complete data.
        </p>
      ) : !summary.rows.length ? (
        <p className="chart-empty">No transactions for the selected period.</p>
      ) : (
        <>
          <svg viewBox="0 0 480 245" role="img" aria-labelledby={id}>
            <title id={id}>
              {balance
                ? 'Account balance trend'
                : 'Income and expense cash flow'}{' '}
              in {currency}. Exact values are in the data table below.
            </title>
            {[0, 1, 2, 3, 4].map((i) => {
              const value = min + ((max - min) * i) / 4;
              return (
                <g key={i}>
                  <line
                    x1="55"
                    x2="450"
                    y1={y(value)}
                    y2={y(value)}
                    className="chart-grid"
                  />
                  <text x="48" y={y(value) + 4} textAnchor="end">
                    {new Intl.NumberFormat('en-AU', {
                      notation: 'compact',
                      maximumFractionDigits: 1,
                    }).format(value / 100)}
                  </text>
                </g>
              );
            })}
            <text x="10" y="18">
              {currency}
            </text>
            {balance ? (
              <polyline className="balance-line" points={points('balance')} />
            ) : (
              <>
                <polygon
                  className="income-area"
                  points={`55,${y(0)} ${points('income')} 445,${y(0)}`}
                />
                <polyline className="income-line" points={points('income')} />
                <polyline
                  className="expense-line"
                  points={points('expenses')}
                />
              </>
            )}
            {rows.map((r, i) => (
              <text key={r.label} x={x(i)} y="230" textAnchor="middle">
                {r.label}
              </text>
            ))}
          </svg>
          <p className="chart-axis-caption">
            Day of selected month · consecutive 7-day groups (last group may be
            shorter)
          </p>
        </>
      )}
      <div className="chart-legend">
        {balance ? (
          <span>
            <i className="series-2" />
            Closing balance
          </span>
        ) : (
          <>
            <span>
              <i className="series-2" />
              Income
            </span>
            <span>
              <i className="series-0" />
              Expenses
            </span>
          </>
        )}
      </div>
      <details>
        <summary>View {balance ? 'balance' : 'cash flow'} data</summary>
        <table className="chart-data">
          <caption>Values in {currency}</caption>
          <thead>
            <tr>
              <th>Days</th>
              {balance ? (
                <th>Closing balance</th>
              ) : (
                <>
                  <th>Income</th>
                  <th>Expenses</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label}>
                <th>{r.label}</th>
                {balance ? (
                  <td>
                    {r.balance === null
                      ? 'Unavailable'
                      : money(r.balance, currency)}
                  </td>
                ) : (
                  <>
                    <td>{money(r.income, currency)}</td>
                    <td>{money(r.expenses, currency)}</td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
export function CategoryChart({ summary, currency, compact = false }) {
  return (
    <div
      className={compact ? 'category-chart compact-category' : 'category-chart'}
    >
      {!summary.categories.length ? (
        <p className="chart-empty">No expenses in this selection.</p>
      ) : (
        <>
          {!compact && (
            <svg
              viewBox="0 0 220 220"
              role="img"
              aria-label={`Total category spending ${money(summary.expenses, currency)}. Breakdown follows.`}
            >
              {summary.categories.map((c, i) => {
                const length = (c.amount / summary.expenses) * 100;
                const start =
                  (summary.categories
                    .slice(0, i)
                    .reduce((sum, category) => sum + category.amount, 0) /
                    summary.expenses) *
                  100;
                return (
                  <circle
                    key={c.id}
                    cx="110"
                    cy="110"
                    r="80"
                    pathLength="100"
                    fill="none"
                    strokeWidth="24"
                    strokeDasharray={`${length} ${100 - length}`}
                    strokeDashoffset={-start}
                    className={`donut-segment series-${i % 6}`}
                  />
                );
              })}
              <text x="110" y="100" textAnchor="middle" className="donut-label">
                TOTAL SPENDING
              </text>
              <text x="110" y="125" textAnchor="middle" className="donut-value">
                {money(summary.expenses, currency)}
              </text>
            </svg>
          )}
          <ul>
            {summary.categories.map((c, i) => (
              <li key={c.id}>
                <span>
                  <i className={`series-${i % 6}`} />
                  {c.name}
                </span>
                <strong>{money(c.amount, currency)}</strong>
                <small>
                  {((c.amount / summary.expenses) * 100).toFixed(1)}%
                </small>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
