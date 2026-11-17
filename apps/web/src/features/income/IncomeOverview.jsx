import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useWorkspace } from '../finance/WorkspaceContext.js';
import FinancialFilters from '../finance/components/FinancialFilters.jsx';
import { money, dateLabel } from '../finance/data/calculations.js';
import { incomeSummary } from './incomeService.js';
import {
  IncomePage,
  IncomeKpis,
  ClientFilter,
  StatusBadge,
} from './components/IncomeUI.jsx';
function IncomeTrend({ summary, currency }) {
  const days = summary.financial.days.map((d) => ({
    date: d.date,
    received: summary.receivedRows
      .filter((t) => t.date === d.date)
      .reduce((n, t) => n + t.amount, 0),
    invoiced: summary.scoped
      .filter((i) => i.lifecycle === 'issued' && i.issuedDate === d.date)
      .reduce((n, i) => n + i.total, 0),
  }));
  const weeks = [];
  for (let i = 0; i < days.length; i += 7) {
    const rows = days.slice(i, i + 7);
    weeks.push({
      label: `${rows[0].date.slice(8)}–${rows.at(-1).date.slice(8)}`,
      received: rows.reduce((n, d) => n + d.received, 0),
      invoiced: rows.reduce((n, d) => n + d.invoiced, 0),
    });
  }
  const max = Math.max(100, ...weeks.flatMap((w) => [w.received, w.invoiced]));
  const points = (key) =>
    weeks
      .map((w, i) => `${35 + i * 100},${200 - (w[key] / max) * 160}`)
      .join(' ');
  return (
    <section className="finance-card">
      <h2>Income Trends</h2>
      <p className="muted">Received by payment date · Invoiced by issue date</p>
      <div className="financial-chart">
        <svg
          viewBox="0 0 480 245"
          role="img"
          aria-label={`Received and invoiced amounts in ${currency}; exact values below`}
        >
          <text x="15" y="20">
            {currency}
          </text>
          {[0, 1, 2, 3, 4].map((i) => (
            <line
              key={i}
              className="chart-grid"
              x1="35"
              x2="445"
              y1={40 + i * 40}
              y2={40 + i * 40}
            />
          ))}
          <polyline className="income-line" points={points('received')} />
          <polyline className="expense-line" points={points('invoiced')} />
          {weeks.map((w, i) => (
            <text key={w.label} x={35 + i * 100} y="230" textAnchor="middle">
              {w.label}
            </text>
          ))}
        </svg>
        <div className="chart-legend">
          <span>
            <i className="series-2" />
            Received
          </span>
          <span>
            <i className="series-0" />
            Invoiced
          </span>
        </div>
        <details>
          <summary>View income trend data</summary>
          <table className="chart-data">
            <caption>Seven-day groups of selected month in {currency}</caption>
            <thead>
              <tr>
                <th>Days</th>
                <th>Received</th>
                <th>Invoiced</th>
              </tr>
            </thead>
            <tbody>
              {weeks.map((w) => (
                <tr key={w.label}>
                  <th>{w.label}</th>
                  <td>{money(w.received, currency)}</td>
                  <td>{money(w.invoiced, currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      </div>
    </section>
  );
}
export default function IncomeOverview() {
  const { ledger, filters, canEdit } = useWorkspace();
  const navigate = useNavigate();
  const [clientId, setClientId] = useState('all');
  const data = ledger.data;
  const s = data ? incomeSummary(data, filters, { clientId }) : null;
  return (
    <IncomePage
      title="Income Overview"
      subtitle="Track your earnings, incoming payments, and outstanding invoices."
      actions={
        <>
          <button
            className="compact-button"
            onClick={() => navigate('/expenses/transactions?add=1&type=income')}
          >
            ＋ Add Income
          </button>
          <button
            className="compact-button"
            onClick={() => navigate('/expenses/import')}
          >
            Import Statement
          </button>
          {canEdit && (
            <Link
              className="compact-button brand-button"
              to="/income/invoices/new"
            >
              ＋ Create Invoice
            </Link>
          )}
        </>
      }
    >
      {data && (
        <>
          <div className="finance-card income-filter-panel">
            <FinancialFilters />
            <ClientFilter value={clientId} onChange={setClientId} />
          </div>
          <p className="scope-note">
            {filters.currency} only · Sample date: {dateLabel(data.asOf)} · No
            bank sync or automatic reminders
          </p>
          <IncomeKpis
            currency={filters.currency}
            values={[
              [
                'Total Received',
                s.received,
                'Confirmed income by payment date',
              ],
              [
                'Total Invoiced',
                s.invoiced,
                'Finalized invoices by issue date; drafts excluded',
              ],
              [
                'Outstanding Amount',
                s.outstanding,
                'Unpaid balance of selected issued invoices',
              ],
              [
                'Overdue Amount',
                s.overdue,
                'Due before sample date; subset of outstanding',
              ],
            ]}
          />
          {!s.receivedRows.length && (
            <p className="empty-ledger">No income for this selection.</p>
          )}
          {!s.scoped.length && (
            <p className="empty-ledger">No invoices for this selection.</p>
          )}
          <div className="charts-grid">
            <IncomeTrend summary={s} currency={filters.currency} />
            <section className="finance-card">
              <h2>Income by Source</h2>
              <p className="muted">Confirmed receipts only</p>
              {[
                ...new Set(s.receivedRows.map((t) => t.clientId || 'other')),
              ].map((id) => {
                const amount = s.receivedRows
                  .filter((t) => (t.clientId || 'other') === id)
                  .reduce((n, t) => n + t.amount, 0);
                return (
                  <div className="source-row" key={id}>
                    <strong>
                      {data.clients.find((c) => c.id === id)?.name ||
                        'Other income'}
                    </strong>
                    <span>{money(amount, filters.currency)}</span>
                    <progress max={s.received || 1} value={amount} />
                  </div>
                );
              })}
              <Link className="text-button" to="/income/clients">
                Manage Clients →
              </Link>
            </section>
          </div>
          <section className="finance-card">
            <div className="section-heading">
              <h2>Invoice Pipeline Status</h2>
              <Link className="text-button" to="/income/invoices">
                Manage Invoices →
              </Link>
            </div>
            <div className="pipeline-grid">
              {[
                'draft',
                'prepared',
                'sent',
                'partial',
                'paid',
                'overdue',
                'cancelled',
              ].map((status) => (
                <div key={status}>
                  <StatusBadge status={status} />
                  <strong>
                    {s.scoped.filter((i) => i.status === status).length}
                  </strong>
                  <span>invoices</span>
                </div>
              ))}
            </div>
          </section>
          <section className="finance-card">
            <h2>Recent Income Transactions</h2>
            <div className="income-table-wrap">
              <table className="income-table">
                <caption className="sr-only">
                  Confirmed receipts in the selected reporting period
                </caption>
                <thead>
                  <tr>
                    <th>Payer / Client</th>
                    <th>Date</th>
                    <th>Account</th>
                    <th>Amount</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {[...s.receivedRows]
                    .reverse()
                    .slice(0, 6)
                    .map((t) => (
                      <tr key={t.id}>
                        <th>{t.description}</th>
                        <td data-label="Date">{dateLabel(t.date)}</td>
                        <td data-label="Account">
                          {
                            data.accounts.find((a) => a.id === t.accountId)
                              ?.name
                          }
                        </td>
                        <td data-label="Amount" className="positive">
                          {money(t.amount, filters.currency)}
                        </td>
                        <td>
                          <button
                            className="text-button"
                            onClick={() =>
                              navigate(`/expenses/transactions?id=${t.id}`)
                            }
                          >
                            View Transaction
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </IncomePage>
  );
}
