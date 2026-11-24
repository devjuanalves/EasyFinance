import Link from './InvestmentLink.jsx';
import { displayMoney } from './format.js';
import { useLocation } from 'react-router-dom';
import { useWorkspace } from '../finance/WorkspaceContext.js';
import { money, dateLabel } from '../finance/data/calculations.js';
import { periods } from '../finance/data/financialData.js';
import { Field } from '../income/components/IncomeUI.jsx';
import { ASSET_TYPES, CURRENCIES } from './investmentMath.js';
import './investments.css';
export function InvestmentPage({ title, subtitle, actions, children }) {
  const { ledger, setFilter, persistent } = useWorkspace();
  const { hash } = useLocation();
  return (
    <main className="workspace-content income-page investment-page">
      <nav className="income-tabs" aria-label="Investment navigation">
        <Link className={!hash ? 'active' : undefined} to="/investments">
          Overview
        </Link>
        <Link
          className={hash === '#holdings' ? 'active' : undefined}
          to="/investments#holdings"
        >
          Holdings
        </Link>
        <Link
          className={hash === '#activity' ? 'active' : undefined}
          to="/investments#activity"
        >
          History
        </Link>
      </nav>
      <div className="page-heading">
        <div>
          <span className="app-badge">
            {persistent
              ? 'MANUAL TRACKING · SAVED TO DATABASE'
              : 'MANUAL TRACKING · SESSION DEMO'}
          </span>
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </div>
        <div className="income-actions">{actions}</div>
      </div>
      {ledger.isPending ? (
        <p className="finance-card" role="status">
          Loading investment records…
        </p>
      ) : ledger.isError ? (
        <section className="finance-card" role="alert">
          <h2>Investment data unavailable</h2>
          <p>{ledger.error.message}</p>
          <button
            className="secondary-button"
            onClick={() => setFilter('scenario', 'normal')}
          >
            Retry investment data
          </button>
        </section>
      ) : (
        <>
          {ledger.data?.coverageEnd < ledger.data?.asOf && (
            <p className="partial-banner">
              Partial sample coverage. Portfolio reporting stops at{' '}
              {dateLabel(ledger.data.coverageEnd)}. Editing unavailable.
            </p>
          )}
          {children}
        </>
      )}
    </main>
  );
}
export function InvestmentFilters({
  options,
  setOptions,
  currency,
  setCurrency,
}) {
  const {
    ledger,
    filters,
    setFilter,
    persistent,
    periods: livePeriods,
  } = useWorkspace();
  return (
    <section
      className="finance-card investment-filters"
      aria-label="Portfolio filters"
    >
      <Field label="Investment account">
        <select
          aria-label="Investment account"
          value={options.accountId}
          onChange={(e) =>
            setOptions({ ...options, accountId: e.target.value })
          }
        >
          <option value="all">All investment accounts</option>
          {ledger.data?.investmentAccounts
            .filter(
              (a) =>
                a.workspaceId === filters.workspaceId &&
                (currency === 'all' || a.currency === currency),
            )
            .map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
        </select>
      </Field>
      <Field label="Asset type filter">
        <select
          aria-label="Asset type filter"
          value={options.assetType}
          onChange={(e) =>
            setOptions({ ...options, assetType: e.target.value })
          }
        >
          <option value="all">All asset types</option>
          {ASSET_TYPES.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
      </Field>
      <Field label="Portfolio currency">
        <select
          aria-label="Portfolio currency"
          value={currency}
          onChange={(e) => {
            setCurrency(e.target.value);
            setOptions({ ...options, accountId: 'all' });
          }}
        >
          <option value="all">All currencies · no combined total</option>
          {CURRENCIES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </Field>
      <Field label="Reporting period">
        <select
          aria-label="Reporting period"
          value={options.periodId}
          onChange={(e) => setOptions({ ...options, periodId: e.target.value })}
        >
          {(livePeriods || periods).map((p) => (
            <option key={p.id} value={p.id}>
              {p.label.replace(' · no activity', '')}
            </option>
          ))}
        </select>
      </Field>
      {!persistent && (
        <Field label="Demo data state">
          <select
            aria-label="Demo data state"
            value={filters.scenario}
            onChange={(e) => setFilter('scenario', e.target.value)}
          >
            {['normal', 'empty', 'partial', 'error'].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </Field>
      )}
    </section>
  );
}
export function ValueChart({ rows, currency }) {
  const max = Math.max(1, ...rows.flatMap((r) => [r.value || 0, r.basis || 0]));
  const first = rows.length ? Date.parse(rows[0].date) : 0;
  const duration = rows.length
    ? Math.max(1, Date.parse(rows.at(-1).date) - first)
    : 1;
  const x = (i) => 35 + ((Date.parse(rows[i].date) - first) * 420) / duration,
    y = (n) => 185 - (n / max) * 145;
  const stepPath = (key) => {
    let drawing = false;
    return rows
      .map((r, i) => {
        if (r[key] === null) {
          const end = drawing ? `H${x(i)}` : '';
          drawing = false;
          return end;
        }
        const segment = drawing
          ? `H${x(i)}V${y(r[key])}`
          : `M${x(i)},${y(r[key])}`;
        drawing = true;
        return segment;
      })
      .join(' ');
  };
  return (
    <section className="finance-card">
      <h2>Portfolio Performance</h2>
      <p className="muted">
        Manual value and remaining cost basis · {currency}. Points are recorded
        dates; no interpolated market prices. Values carry forward only until
        the position changes.
      </p>
      {rows.length < 2 ? (
        <p>
          Insufficient history for a chart. Add dated valuations to compare.
        </p>
      ) : (
        <svg
          className="investment-chart"
          viewBox="0 0 500 230"
          role="img"
          aria-label="Portfolio value and cost basis at recorded dates; exact values in the table below"
        >
          <text x="10" y="20">
            {displayMoney(max, currency)}
          </text>
          <line x1="35" x2="455" y1="185" y2="185" className="chart-grid" />
          <path
            d={stepPath('value')}
            fill="none"
            stroke="#08864e"
            strokeWidth="2"
          />
          <path
            d={stepPath('basis')}
            fill="none"
            stroke="#e43900"
            strokeWidth="2"
          />
          {rows.map((r, i) => (
            <g key={r.date}>
              {r.value !== null && (
                <circle
                  cx={x(i)}
                  cy={y(r.value)}
                  r="5"
                  className="value-point"
                />
              )}
              {r.basis !== null && (
                <rect
                  x={x(i) - 4}
                  y={y(r.basis) - 4}
                  width="8"
                  height="8"
                  className="basis-point"
                />
              )}
            </g>
          ))}
          <text x="35" y="215">
            {rows[0].date}
          </text>
          <text x="370" y="215">
            {rows.at(-1).date}
          </text>
        </svg>
      )}
      <p className="chart-key">
        <span>● Manual value</span>
        <span>■ Cost basis</span>
      </p>
      <details>
        <summary>View portfolio history data</summary>
        <table className="chart-data">
          <caption>
            Recorded dates and carried-forward comparable valuations
          </caption>
          <thead>
            <tr>
              <th>Date</th>
              <th>Value</th>
              <th>Cost basis</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.date}>
                <th>{dateLabel(r.date)}</th>
                <td>{displayMoney(r.value, currency)}</td>
                <td>{displayMoney(r.basis, currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </section>
  );
}
const colors = [
  '#e43900',
  '#ee7d40',
  '#08864e',
  '#191919',
  '#a0a0a0',
  '#ae2900',
];
export function Allocation({ summary, currency }) {
  return (
    <section className="finance-card">
      <h2>Asset Allocation</h2>
      <p className="muted">By manually recorded current value.</p>
      {summary.currentValue === null ? (
        <p>
          Allocation unavailable until every selected holding has a comparable
          valuation in one currency.
        </p>
      ) : !summary.currentValue ? (
        <p>No positive portfolio value to allocate.</p>
      ) : (
        <>
          <svg
            className="allocation-donut"
            viewBox="0 0 200 200"
            role="img"
            aria-label="Asset allocation; exact amounts and percentages listed below"
          >
            {summary.allocation.map((a, i) => {
              const percent = (a.value / summary.currentValue) * 100;
              const start = summary.allocation
                .slice(0, i)
                .reduce(
                  (sum, item) =>
                    sum + (item.value / summary.currentValue) * 100,
                  0,
                );
              return (
                <circle
                  key={a.type}
                  cx="100"
                  cy="100"
                  r="72"
                  fill="none"
                  stroke={colors[i]}
                  strokeWidth="24"
                  pathLength="100"
                  strokeDasharray={`${percent} ${100 - percent}`}
                  strokeDashoffset={-start}
                  transform="rotate(-90 100 100)"
                />
              );
            })}
            <text x="100" y="102" textAnchor="middle">
              100% allocated
            </text>
          </svg>
          <div className="allocation-bar">
            {summary.allocation.map((a, i) => (
              <span
                key={a.type}
                style={{
                  width: `${(a.value / summary.currentValue) * 100}%`,
                  background: colors[i],
                }}
              />
            ))}
          </div>
          {summary.allocation.map((a, i) => (
            <div className="source-row" key={a.type}>
              <strong>
                <span style={{ color: colors[i] }}>● </span>
                {a.type}
              </strong>
              <span>
                {money(a.value, currency)} ·{' '}
                {((a.value / summary.currentValue) * 100).toFixed(1)}%
              </span>
            </div>
          ))}
        </>
      )}
    </section>
  );
}
export function ActivityTable({ rows, actions }) {
  return (
    <div className="income-table-wrap">
      <table className="income-table investment-table">
        <caption className="sr-only">
          Investment movements and valuations
        </caption>
        <thead>
          <tr>
            {[
              'Date / Type',
              'Quantity / Price',
              'Amount / Fee',
              'Notes',
              'Actions',
            ].map((x) => (
              <th key={x}>{x}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((m) => (
            <tr key={m.id}>
              <td data-label="Date / Type">
                {dateLabel(m.activityDate || m.date)}
                <strong>{m.type}</strong>
                {m.investment && (
                  <Link to={`/investments/${m.investment.id}`}>
                    {m.investment.name}
                  </Link>
                )}
              </td>
              <td data-label="Quantity / Price">
                {m.quantity || '—'}
                <small>
                  {m.unitPrice
                    ? `${m.unitPrice} ${m.currency} / unit`
                    : 'Not quantity based'}
                </small>
              </td>
              <td data-label="Amount / Fee">
                {m.type === 'withdrawal' && m.quantity
                  ? 'In-kind withdrawal'
                  : money(m.amount, m.currency)}
                <small>Fee: {money(m.fee || 0, m.currency)}</small>
              </td>
              <td data-label="Notes">
                {m.notes || '—'}
                {m.remainingBasis !== undefined && (
                  <small>
                    Basis after: {money(m.remainingBasis, m.currency)} · Units:{' '}
                    {m.remainingQuantity}
                  </small>
                )}
              </td>
              <td data-label="Actions">{actions?.(m) || 'Recorded history'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length && <p>No activity for this selection.</p>}
    </div>
  );
}
