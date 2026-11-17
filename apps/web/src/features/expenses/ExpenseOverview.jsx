import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useWorkspace } from '../finance/WorkspaceContext.js';
import FinancialFilters from '../finance/components/FinancialFilters.jsx';
import { IncomeKpis } from '../income/components/IncomeUI.jsx';
import AppDialog from '../../components/ui/AppDialog.jsx';
import {
  ExpensePage,
  CategorySelect,
  TransactionTable,
} from './components/ExpenseUI.jsx';
import TransactionForm from './components/TransactionForm.jsx';
import { expenseSummary } from './expenseService.js';
import { money, dateLabel } from '../finance/data/calculations.js';
export default function ExpenseOverview() {
  const { ledger, filters, canEdit } = useWorkspace();
  const [category, setCategory] = useState('all'),
    [adding, setAdding] = useState(false);
  const data = ledger.data,
    s = data
      ? expenseSummary(data, filters, category || 'uncategorized')
      : null;
  return (
    <ExpensePage
      title="Expense Overview"
      subtitle="Understand where your money goes and review your spending."
      actions={
        <>
          <Link className="compact-button" to="/expenses/import">
            Import Statement
          </Link>
          <button
            className="compact-button brand-button"
            disabled={!canEdit}
            onClick={() => setAdding(true)}
          >
            ＋ Add Expense
          </button>
        </>
      }
    >
      {s && (
        <>
          <div className="finance-card income-filter-panel">
            <FinancialFilters />
            <CategorySelect
              all
              includeArchived
              value={category}
              onChange={setCategory}
            />
          </div>
          <IncomeKpis
            currency={filters.currency}
            values={[
              [
                'Total Expenses',
                s.total,
                'Confirmed, non-excluded expenses; transfers excluded',
              ],
              [
                'Recurring Expenses',
                s.recurringTotal,
                'Pattern suggestions; not guaranteed future charges',
              ],
              [
                'Largest Expense Category',
                s.categories[0]?.name || 'None',
                s.categories[0]
                  ? money(s.categories[0].amount, filters.currency)
                  : 'No expenses',
              ],
              [
                'Period-over-Period Variation',
                s.previous
                  ? `${(((s.total - s.previous) / s.previous) * 100).toFixed(1)}%`
                  : 'Not available',
                `Equal-length comparison: ${dateLabel(s.previousPeriod.start)}–${dateLabel(s.previousPeriod.end)}`,
              ],
            ]}
          />
          {!s.rows.length && (
            <p className="empty-ledger">No expenses for this selection.</p>
          )}
          <div className="charts-grid">
            <section className="finance-card">
              <h2>Expense Trends</h2>
              <p className="muted">
                Daily spending · {filters.currency} · Average{' '}
                {money(Math.round(s.total / s.days.length), filters.currency)}{' '}
                per day
              </p>
              <div className="financial-chart">
                <svg
                  viewBox="0 0 500 230"
                  role="img"
                  aria-label={`Daily spending totals ${money(s.total, filters.currency)}; exact values below`}
                >
                  <text x="10" y="18">
                    {money(
                      Math.max(100, ...s.days.map((d) => d.expenses)),
                      filters.currency,
                    )}
                  </text>
                  <line
                    className="chart-grid"
                    x1="25"
                    x2="475"
                    y1="190"
                    y2="190"
                  />
                  <polyline
                    className="expense-line"
                    points={s.days
                      .map(
                        (d, i) =>
                          `${25 + (i * 450) / (s.days.length - 1)},${190 - (d.expenses / Math.max(100, ...s.days.map((d) => d.expenses))) * 150}`,
                      )
                      .join(' ')}
                  />
                  <text x="25" y="218">
                    {s.period.start}
                  </text>
                  <text x="380" y="218">
                    {s.period.end}
                  </text>
                </svg>
                <details>
                  <summary>View expense trend data</summary>
                  <table className="chart-data">
                    <caption>Daily expense amounts</caption>
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {s.days.map((d) => (
                        <tr key={d.date}>
                          <th>{dateLabel(d.date)}</th>
                          <td>{money(d.expenses, filters.currency)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </details>
              </div>
            </section>
            <section className="finance-card">
              <h2>Category Distribution</h2>
              {s.categories.map((c) => (
                <div className="source-row" key={c.id}>
                  <strong>{c.name}</strong>
                  <span>
                    {money(c.amount, filters.currency)} ·{' '}
                    {s.total ? ((c.amount / s.total) * 100).toFixed(1) : 0}%
                  </span>
                  <progress max={s.total || 1} value={c.amount} />
                </div>
              ))}
              <Link className="text-button" to="/expenses/categories">
                Manage Categories →
              </Link>
            </section>
          </div>
          <div className="charts-grid">
            <section className="finance-card">
              <h2>Recurring Spending</h2>
              {s.recurring.length ? (
                s.recurring.map((r) => (
                  <div className="source-row" key={r.id}>
                    <strong>{r.transaction.description}</strong>
                    <span>
                      {money(-r.transaction.amount, filters.currency)} ·{' '}
                      {r.frequency}
                    </span>
                    <span>
                      {r.confirmed
                        ? 'User-confirmed recurrence'
                        : 'Pattern-based suggestion · review required'}
                    </span>
                    <span>
                      Next expected: {dateLabel(r.nextDate)} · not a scheduled
                      payment
                    </span>
                    <Link
                      to={`/expenses/transactions?id=${r.transaction.id}`}
                      className="text-button"
                    >
                      Review recurring transaction
                    </Link>
                  </div>
                ))
              ) : (
                <p>No recurring patterns for this selection.</p>
              )}
            </section>
            <section className="finance-card">
              <h2>Needs Your Attention</h2>
              {[
                [
                  'uncategorized',
                  'Uncategorized Transactions',
                  s.rows.filter((t) => !t.categoryId).length,
                ],
                [
                  'duplicate',
                  'Potential Duplicates',
                  s.rows.filter((t) => t.possibleDuplicate).length,
                ],
                [
                  'pending',
                  'Transactions Requiring Review',
                  s.rows.filter((t) => t.reviewStatus === 'pending').length,
                ],
              ].map(([status, label, count]) => (
                <div className="source-row" key={status}>
                  <strong>
                    {count} · {label}
                  </strong>
                  <Link
                    className="text-button"
                    to={`/expenses/transactions?status=${status}`}
                  >
                    Review {label}
                  </Link>
                </div>
              ))}
              <Link className="text-button" to="/expenses/categories">
                Review uncertain rule suggestions →
              </Link>
            </section>
          </div>
          <section className="finance-card">
            <div className="section-heading">
              <h2>Recent Expenses</h2>
              <Link className="text-button" to="/expenses/transactions">
                View All Transactions →
              </Link>
            </div>
            <TransactionTable
              data={data}
              rows={[...s.rows]
                .sort((a, b) => b.date.localeCompare(a.date))
                .slice(0, 5)}
            />
          </section>
          <AppDialog
            open={adding}
            title="Add Expense"
            onClose={() => setAdding(false)}
          >
            {adding && <TransactionForm onSaved={() => setAdding(false)} />}
          </AppDialog>
        </>
      )}
    </ExpensePage>
  );
}
