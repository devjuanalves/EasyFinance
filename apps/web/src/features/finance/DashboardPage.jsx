import { Link } from 'react-router-dom';
import { portfolio } from '../investments/investmentMath.js';
import { displayMoney } from '../investments/format.js';
import { useNavigate } from 'react-router-dom';
import { useWorkspace } from './WorkspaceContext.js';
import { summarize, money, dateLabel } from './data/calculations.js';
import FinancialFilters from './components/FinancialFilters.jsx';
import { CashFlowChart, CategoryChart } from './components/FinancialCharts.jsx';
import {
  KpiCards,
  InsightsAndReviews,
  RecentTransactions,
} from './components/DashboardSections.jsx';
export default function DashboardPage() {
  const navigate = useNavigate();
  const { filters, ledger, workspaceName, setFilter } = useWorkspace();
  const summary = ledger.data ? summarize(ledger.data, filters) : null;
  const investments = ledger.data
    ? portfolio(ledger.data, filters, {
        start: summary.period.start,
        end: [summary.period.end, ledger.data.coverageEnd].sort()[0],
      })
    : null;
  return (
    <main className="workspace-content dashboard-page">
      <div className="page-heading">
        <div>
          <span className="app-badge">FINANCIAL OVERVIEW</span>
          <h1>Financial Overview</h1>
          <p>Understand your finances and make smarter decisions.</p>
        </div>
        <button
          className="compact-button brand-button"
          onClick={() => navigate('/expenses/transactions?add=1')}
        >
          ＋ Add Transaction
        </button>
      </div>
      <FinancialFilters />
      <p className="scope-note">
        {workspaceName} · {filters.currency} native amounts only · No
        exchange-rate conversion
      </p>
      {ledger.isPending ? (
        <div className="finance-card loading-state" role="status">
          <span className="spinner" />
          Loading financial sample…
        </div>
      ) : ledger.isError ? (
        <div className="finance-card" role="alert">
          <h2>Financial data unavailable</h2>
          <p>{ledger.error.message}</p>
          <button
            className="secondary-button"
            onClick={() => {
              setFilter('scenario', 'normal');
            }}
          >
            Retry with normal sample
          </button>
        </div>
      ) : (
        <>
          <p className="data-provenance">
            {summary.source} · {dateLabel(summary.period.start)} –{' '}
            {dateLabel(summary.period.end)} · Last available date:{' '}
            {dateLabel(ledger.data.coverageEnd)}
          </p>
          {!summary.complete && (
            <p className="partial-banner" role="status">
              Partial data: records only through{' '}
              {dateLabel(ledger.data.coverageEnd)}. Totals are incomplete;
              balance and comparisons are unavailable.
            </p>
          )}
          {!summary.rows.length && (
            <div className="empty-ledger">
              <h2>No transactions for this selection</h2>
              <p>
                Try a different period or account. Statement import is a future
                feature.
              </p>
              <button
                className="secondary-button"
                onClick={() => navigate('/expenses/import')}
              >
                Import Statement
              </button>
            </div>
          )}
          <KpiCards summary={summary} currency={filters.currency} />
          <div className="charts-grid">
            <section className="finance-card">
              <h2>Cash Flow</h2>
              <p className="muted">Track your income and expenses over time.</p>
              <CashFlowChart summary={summary} currency={filters.currency} />
              <button
                className="text-button"
                onClick={() => navigate('/expenses/transactions')}
              >
                Detailed cash flow statement →
              </button>
            </section>
            <section className="finance-card">
              <h2>Expenses by Category</h2>
              <p className="muted">Categories reconcile to total spending.</p>
              <CategoryChart summary={summary} currency={filters.currency} />
              <button
                className="compact-button"
                onClick={() => navigate('/expenses')}
              >
                Explore expenses
              </button>
            </section>
          </div>
          <section
            className="finance-card investment-dashboard-summary"
            aria-label="Investment summary"
          >
            <div className="section-heading">
              <h2>Investment Portfolio</h2>
              <Link className="text-button" to="/investments">
                View Investments →
              </Link>
            </div>
            <strong className="kpi-value">
              {displayMoney(investments.currentValue, filters.currency)}
            </strong>
            <p>
              Manual valuation dates:{' '}
              {investments.valuationDates.map(dateLabel).join(' · ') || 'None'}.
              Remaining cost basis:{' '}
              {displayMoney(investments.basis, filters.currency)}.
            </p>
            <p className="muted">
              All investment accounts in this workspace and currency. Separate
              from bank balances and operating cash flow; cash-account and
              participant filters do not allocate holdings. No currency
              conversion.
            </p>
          </section>
          <InsightsAndReviews summary={summary} currency={filters.currency} />
          <section className="finance-card balance-section">
            <div className="section-heading">
              <div>
                <h2>Account Balance Trend</h2>
                <p className="muted">
                  Opening balance plus all signed movements, including
                  transfers.
                </p>
              </div>
              <strong>
                {summary.balance === null
                  ? 'Unavailable'
                  : money(summary.balance, filters.currency)}
              </strong>
            </div>
            <p className="muted">
              Opening at period start:{' '}
              {summary.openingBalance === null
                ? 'Unavailable'
                : money(summary.openingBalance, filters.currency)}
              . Participant filters cannot allocate account-level balances.
            </p>
            <CashFlowChart
              summary={summary}
              currency={filters.currency}
              balance
            />
          </section>
          <RecentTransactions
            summary={summary}
            data={ledger.data}
            currency={filters.currency}
          />
        </>
      )}
    </main>
  );
}
