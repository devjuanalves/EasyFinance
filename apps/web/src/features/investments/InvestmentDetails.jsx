import { displayMoney } from './format.js';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useWorkspace } from '../finance/WorkspaceContext.js';
import { money, dateLabel } from '../finance/data/calculations.js';
import { IncomeKpis, Field } from '../income/components/IncomeUI.jsx';
import {
  positionAt,
  portfolioHistory,
  quantityBased,
} from './investmentMath.js';
import { InvestmentPage, ValueChart, ActivityTable } from './InvestmentUI.jsx';
import { InvestmentDialog } from './InvestmentDialogs.jsx';
export default function InvestmentDetails() {
  const { id } = useParams(),
    { ledger, filters } = useWorkspace();
  const i = ledger.data?.investments.find(
    (i) => i.id === id && i.workspaceId === filters.workspaceId,
  );
  return (
    <InvestmentPage
      title={i?.name || 'Investment Details'}
      subtitle="Manually recorded holdings, cost basis and dated history."
      actions={
        <Link className="compact-button" to="/investments">
          Back to Investments
        </Link>
      }
    >
      {ledger.data &&
        (i ? (
          <Details key={`${filters.workspaceId}-${id}`} investment={i} />
        ) : (
          <p className="finance-card">
            Investment not found in this workspace.
          </p>
        ))}
    </InvestmentPage>
  );
}
function Details({ investment: i }) {
  const { ledger, filters, canEdit, command } = useWorkspace(),
    data = ledger.data;
  const [dialog, setDialog] = useState(null),
    [query, setQuery] = useState({
      type: 'all',
      start: '',
      end: '',
      search: '',
    }),
    [error, setError] = useState('');
  const p = positionAt(data, i, data.coverageEnd),
    account = data.investmentAccounts.find(
      (a) => a.id === i.investmentAccountId,
    );
  const actions = quantityBased(i)
    ? [
        ['contribution', 'Record Contribution'],
        ['buy', 'Record Purchase'],
        ['withdrawal', 'Record Withdrawal'],
        ['sell', 'Record Sale'],
      ]
    : [
        ['contribution', 'Record Contribution'],
        ['withdrawal', 'Record Withdrawal'],
      ];
  const events = [
    ...p.history.map((m) => ({ ...m, activityDate: m.date })),
    ...data.investmentValuations
      .filter(
        (v) =>
          v.investmentId === i.id &&
          !v.deleted &&
          v.valuedAt <= data.coverageEnd,
      )
      .map((v) => ({
        ...v,
        type: 'valuation',
        activityDate: v.valuedAt,
        amount: v.estimatedValue,
      })),
  ].sort(
    (a, b) => b.activityDate.localeCompare(a.activityDate) || b.order - a.order,
  );
  const rows = events.filter(
    (m) =>
      (query.type === 'all' || m.type === query.type) &&
      (!query.start || m.activityDate >= query.start) &&
      (!query.end || m.activityDate <= query.end) &&
      `${m.notes} ${m.type}`.toLowerCase().includes(query.search.toLowerCase()),
  );
  function remove(m) {
    if (
      !window.confirm(
        'Delete this activity from the active history? Its audit snapshot is retained and dependent movements are checked.',
      )
    )
      return;
    try {
      command(
        `investment:${m.type === 'valuation' ? 'deleteValuation' : 'deleteMovement'}`,
        { id: i.id, movementId: m.id, valuationId: m.id, confirmed: true },
      );
      setError('');
    } catch (e) {
      setError(e.message);
    }
  }
  const ownData = { ...data, investments: [i] };
  return (
    <>
      <section className="finance-card">
        <div className="section-heading">
          <div>
            <span className="app-badge">
              {i.assetType === 'Custom' ? i.customType : i.assetType} ·{' '}
              {i.currency}
            </span>
            <h2>{account?.institution}</h2>
            <p>
              {account?.name} · {i.symbol || 'No ticker required'} · Last
              valuation:{' '}
              {p.valuation ? dateLabel(p.valuation.valuedAt) : 'None'}
            </p>
          </div>
          <Link className="compact-button" to={`/investments/${i.id}/edit`}>
            Edit Investment
          </Link>
        </div>
        <div className="income-actions">
          {[
            ['valuation', 'Update Value'],
            ...actions,
            ['dividend', 'Record Dividend'],
            ['interest', 'Record Interest'],
            ['fee', 'Record Fee'],
          ].map(([mode, label]) => (
            <button
              key={mode}
              className={
                mode === 'valuation'
                  ? 'compact-button brand-button'
                  : 'compact-button'
              }
              disabled={!canEdit}
              onClick={() => setDialog({ mode })}
            >
              {label}
            </button>
          ))}
        </div>
      </section>
      {p.closed && (
        <p className="partial-banner">
          Closed position · no remaining holdings. Historical movements and
          valuations are preserved.
        </p>
      )}
      {p.currentValue === null && (
        <p className="partial-banner">
          No comparable valuation for this position. Record a dated value after
          the latest position change; older values remain in history.
        </p>
      )}
      <IncomeKpis
        currency={i.currency}
        values={[
          [
            'Current Value',
            p.currentValue ?? 'Unavailable',
            'Manual valuation; never live',
          ],
          [
            'Remaining Capital Invested',
            p.basis,
            'Weighted-average cost basis',
          ],
          [
            'Unrealized Gain/Loss',
            p.unrealized ?? 'Unavailable',
            'Not received income',
          ],
          [
            'Percentage Change',
            p.percent === null ? 'Unavailable' : `${p.percent.toFixed(2)}%`,
            'Unrealized difference / remaining basis; not an annualized return',
          ],
        ]}
      />
      <div className="investment-detail-grid">
        <div>
          <ValueChart
            rows={portfolioHistory(
              ownData,
              { ...filters, currency: i.currency },
              { start: data.coverageStart, end: data.coverageEnd },
            )}
            currency={i.currency}
          />
          <section className="finance-card">
            <h2>Activity History</h2>
            <div className="form-grid">
              <Field label="Activity type">
                <select
                  aria-label="Activity type"
                  value={query.type}
                  onChange={(e) => setQuery({ ...query, type: e.target.value })}
                >
                  {[
                    'all',
                    'buy',
                    'sell',
                    'contribution',
                    'withdrawal',
                    'dividend',
                    'interest',
                    'fee',
                    'valuation',
                  ].map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </Field>
              <Field
                label="Search activity"
                value={query.search}
                onChange={(e) => setQuery({ ...query, search: e.target.value })}
              />
              <Field
                label="Activity from"
                type="date"
                value={query.start}
                onChange={(e) => setQuery({ ...query, start: e.target.value })}
              />
              <Field
                label="Activity to"
                type="date"
                value={query.end}
                onChange={(e) => setQuery({ ...query, end: e.target.value })}
              />
            </div>
            {query.start && query.end && query.start > query.end && (
              <p role="alert">Start date must precede end date.</p>
            )}
            {error && <p role="alert">{error}</p>}
            <ActivityTable
              rows={rows}
              actions={(m) => (
                <div className="income-actions">
                  {m.type !== 'valuation' && (
                    <button
                      className="text-button"
                      disabled={!canEdit}
                      onClick={() => setDialog({ mode: m.type, movement: m })}
                    >
                      Edit Activity
                    </button>
                  )}
                  <button
                    className="text-button"
                    disabled={!canEdit}
                    onClick={() => remove(m)}
                  >
                    Delete Activity
                  </button>
                </div>
              )}
            />
          </section>
        </div>
        <aside>
          <section className="finance-card">
            <h2>Holding Breakdown</h2>
            <dl className="investment-meta">
              {[
                [
                  'Units held',
                  quantityBased(i) ? p.quantity : 'Not applicable',
                ],
                [
                  'Average cost per unit',
                  p.averageCost === null
                    ? 'Unavailable'
                    : `${p.averageCost} ${i.currency}`,
                ],
                ['Realized gain/loss', money(p.realized, i.currency)],
                [
                  'Distributions net of fees',
                  money(p.distributions, i.currency),
                ],
                [
                  'Standalone / withdrawal fees',
                  money(p.standaloneFees, i.currency),
                ],
                [
                  'Total nominal return',
                  displayMoney(p.totalReturn, i.currency),
                ],
                ['Opened', dateLabel(i.openedAt)],
                ['Notes', i.notes || 'None'],
                ['Tags', i.tags || 'None'],
                ['Interest information', i.interestInfo || 'Not specified'],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
            <p className="muted">
              Total nominal return = realized + unrealized + net distributions −
              standalone/withdrawal fees. Buy fees are capitalized; sale fees
              reduce proceeds. No annualized, money-weighted, time-weighted or
              tax return is computed.
            </p>
          </section>
          <section className="finance-card">
            <h2>Correction History</h2>
            <p className="muted">
              Session audit snapshots; not a production audit log.
            </p>
            {data.investmentEvents
              .filter((e) => e.investmentId === i.id)
              .map((e) => (
                <details key={e.id}>
                  <summary>
                    {e.type} · {dateLabel(e.date)}
                  </summary>
                  <pre className="investment-audit">
                    {JSON.stringify(
                      { before: e.before, after: e.after },
                      null,
                      2,
                    )}
                  </pre>
                </details>
              ))}
            {!data.investmentEvents.some((e) => e.investmentId === i.id) && (
              <p>Original sample history; no session corrections.</p>
            )}
          </section>
        </aside>
      </div>
      {dialog && (
        <InvestmentDialog
          investment={i}
          {...dialog}
          onClose={() => setDialog(null)}
        />
      )}
    </>
  );
}
