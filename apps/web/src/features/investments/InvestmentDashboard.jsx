import Link from './InvestmentLink.jsx';
import { displayMoney } from './format.js';
import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useWorkspace } from '../finance/WorkspaceContext.js';
import { periods } from '../finance/data/financialData.js';
import { money, dateLabel } from '../finance/data/calculations.js';
import { IncomeKpis } from '../income/components/IncomeUI.jsx';
import { portfolio, portfolioHistory, CURRENCIES } from './investmentMath.js';
import {
  InvestmentPage,
  InvestmentFilters,
  ValueChart,
  Allocation,
  ActivityTable,
} from './InvestmentUI.jsx';
import { InvestmentDialog } from './InvestmentDialogs.jsx';
export default function InvestmentDashboard() {
  const { filters } = useWorkspace();
  return <Dashboard key={filters.workspaceId} />;
}
function Dashboard() {
  const {
      ledger,
      filters,
      setFilter,
      canEdit,
      periods: livePeriods,
    } = useWorkspace(),
    location = useLocation();
  const [options, setOptions] = useState({
      accountId: 'all',
      assetType: 'all',
      periodId: filters.periodId,
    }),
    [currency, setCurrency] = useState(filters.currency),
    [selected, setSelected] = useState(null),
    [search, setSearch] = useState('');
  const period =
      (livePeriods || periods).find((p) => p.id === options.periodId) ||
      (livePeriods || periods)[0] ||
      periods[0],
    data = ledger.data;
  const scope = { ...filters, currency };
  const reportOptions = {
    ...options,
    start: period.start,
    end: data ? [period.end, data.coverageEnd].sort()[0] : period.end,
  };
  const summary = data ? portfolio(data, scope, reportOptions) : null;
  useEffect(() => {
    if (location.hash && data)
      document.getElementById(location.hash.slice(1))?.scrollIntoView();
  }, [location.hash, data]);
  return (
    <InvestmentPage
      title="Investments"
      subtitle="Track your manually managed portfolio, positions and recorded performance."
      actions={
        <>
          <button
            className="compact-button"
            disabled={!canEdit || !summary?.holdings.length}
            onClick={() =>
              document
                .getElementById('holdings')
                ?.scrollIntoView({ behavior: 'smooth' })
            }
          >
            Update Values
          </button>
          <Link className="compact-button brand-button" to="/investments/new">
            ＋ Add Investment
          </Link>
        </>
      }
    >
      <InvestmentFilters
        options={options}
        setOptions={setOptions}
        currency={currency}
        setCurrency={(c) => {
          setCurrency(c);
          if (c !== 'all') setFilter('currency', c);
        }}
      />
      {summary && (
        <>
          <p className="data-provenance">
            As of {dateLabel(reportOptions.end)} · Manual valuation dates:{' '}
            {summary.valuationDates.length
              ? summary.valuationDates.map(dateLabel).join(' · ')
              : 'None'}{' '}
            · Cash accounts are separate.
          </p>
          {summary.mixed && (
            <section className="finance-card" role="status">
              <h2>Combined value unavailable across currencies</h2>
              <p>No exchange-rate conversion.</p>
              {CURRENCIES.map((c) => {
                const p = portfolio(
                  data,
                  { ...filters, currency: c },
                  reportOptions,
                );
                return p.holdings.length ? (
                  <p key={c}>
                    {c} subtotal: {displayMoney(p.currentValue, c)}
                  </p>
                ) : null;
              })}
            </section>
          )}
          <IncomeKpis
            currency={currency === 'all' ? 'AUD' : currency}
            values={[
              [
                'Current Portfolio Value',
                summary.currentValue ?? 'Unavailable',
                summary.missing
                  ? `${summary.missing} holdings need a comparable valuation`
                  : 'Latest comparable manual values; not live',
              ],
              [
                'Capital Invested',
                summary.basis ?? 'Unavailable',
                'Remaining weighted-average cost basis',
              ],
              [
                'Unrealized Gain/Loss',
                summary.unrealized ?? 'Unavailable',
                'Current value minus remaining cost; not received income',
              ],
              [
                'Contributions',
                summary.contributions ?? 'Unavailable',
                'New capital from buys/contributions in the selected period; excludes fees',
              ],
            ]}
          />
          {!summary.holdings.length ? (
            <section className="finance-card">
              <h2>No investments for this selection</h2>
              <p>Change filters or add a manual investment.</p>
            </section>
          ) : (
            <>
              <div className="charts-grid">
                {!summary.mixed && (
                  <ValueChart
                    rows={portfolioHistory(data, scope, reportOptions)}
                    currency={currency === 'all' ? 'AUD' : currency}
                  />
                )}
                <Allocation summary={summary} currency={currency} />
              </div>
              <section
                className="investment-insights"
                aria-label="Portfolio observations"
              >
                <article className="finance-card">
                  <h2>Largest Allocation</h2>
                  <p>
                    {summary.allocation.length
                      ? `${[...summary.allocation].sort((a, b) => b.value - a.value)[0].type} is the largest asset class by recorded value.`
                      : 'Comparable values are required.'}
                  </p>
                  <a href="#holdings">Explore holdings →</a>
                </article>
                <article className="finance-card">
                  <h2>Valuation Review</h2>
                  <p>
                    {summary.stale} holdings have no valuation or one older than
                    30 days. {summary.missing} need a comparable value.
                  </p>
                  <a href="#holdings">Update values →</a>
                </article>
                <article className="finance-card">
                  <h2>Recorded Capital</h2>
                  <p>
                    {displayMoney(
                      summary.contributions,
                      currency === 'all' ? 'AUD' : currency,
                    )}{' '}
                    added in this period. This is not operating income or
                    consumption spending.
                  </p>
                  <a href="#activity">View activity →</a>
                </article>
              </section>
            </>
          )}
          <section className="finance-card" id="holdings">
            <div className="section-heading">
              <h2>My Investments · {summary.holdings.length} holdings</h2>
              <label className="income-field">
                Search holdings
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </label>
            </div>
            <p className="muted">
              Choose Update Value for a holding to record its dated valuation.
            </p>
            <div className="income-table-wrap">
              <table className="income-table investment-table">
                <caption className="sr-only">
                  Manual investment holdings
                </caption>
                <thead>
                  <tr>
                    {[
                      'Investment / Type',
                      'Account / Quantity',
                      'Cost / Value',
                      'Gain / Updated',
                      'Actions',
                    ].map((s) => (
                      <th key={s}>{s}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {summary.holdings
                    .filter((i) =>
                      `${i.name} ${i.symbol}`
                        .toLowerCase()
                        .includes(search.toLowerCase()),
                    )
                    .map((i) => (
                      <tr key={i.id}>
                        <td data-label="Investment / Type">
                          <Link to={`/investments/${i.id}`}>{i.name}</Link>
                          <small>
                            {i.assetType === 'Custom'
                              ? i.customType
                              : i.assetType}{' '}
                            · {i.symbol || 'Manual asset'}
                          </small>
                        </td>
                        <td data-label="Account / Quantity">
                          {i.account?.institution}
                          <small>{i.account?.name}</small>
                          <small>
                            {i.position.averageCost !== null
                              ? `${i.position.quantity} units · ${i.position.averageCost} ${i.currency} average cost`
                              : 'Principal-based holding'}
                          </small>
                        </td>
                        <td data-label="Cost / Value">
                          <small>
                            Cost: {money(i.position.basis, i.currency)}
                          </small>
                          <strong>
                            {displayMoney(i.position.currentValue, i.currency)}
                          </strong>
                        </td>
                        <td data-label="Gain / Updated">
                          {displayMoney(i.position.unrealized, i.currency)}
                          <small>
                            {i.position.valuation
                              ? dateLabel(i.position.valuation.valuedAt)
                              : 'No valuation'}
                          </small>
                          {i.position.closed
                            ? 'Closed position'
                            : i.position.valuationStale
                              ? 'Position changed · revalue'
                              : ''}
                        </td>
                        <td data-label="Actions">
                          <div className="income-actions">
                            <Link
                              className="text-button"
                              to={`/investments/${i.id}`}
                            >
                              View Holding
                            </Link>
                            <Link
                              className="text-button"
                              to={`/investments/${i.id}/edit`}
                            >
                              Edit Holding
                            </Link>
                            {[
                              ['valuation', 'Update Value'],
                              ['contribution', 'Record Contribution'],
                              ['withdrawal', 'Record Withdrawal'],
                            ].map(([mode, label]) => (
                              <button
                                key={mode}
                                disabled={!canEdit}
                                className="text-button"
                                onClick={() =>
                                  setSelected({ investment: i, mode })
                                }
                              >
                                {label}
                              </button>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
              {!summary.holdings.some((i) =>
                `${i.name} ${i.symbol}`
                  .toLowerCase()
                  .includes(search.toLowerCase()),
              ) && <p>No holdings match this search.</p>}
            </div>
          </section>
          <section className="finance-card" id="activity">
            <h2>Recent Investment Activity</h2>
            <p>Selected reporting period; investment activity only.</p>
            <ActivityTable rows={summary.activity.slice(0, 10)} />
          </section>
          {selected && (
            <InvestmentDialog {...selected} onClose={() => setSelected(null)} />
          )}
        </>
      )}
    </InvestmentPage>
  );
}
