import { displayMoney } from '../investments/format.js';
import { Link } from 'react-router-dom';
import { useWorkspace } from '../finance/WorkspaceContext.js';
import { money } from '../finance/data/calculations.js';
import { CategoryChart } from '../finance/components/FinancialCharts.jsx';
export default function AssistantResponse({ message }) {
  const { send, dismissSuggestion, setNotice, busy } = useWorkspace();
  if (message.loading)
    return (
      <div className="assistant-response" role="status">
        Calculating from the sample ledger…
      </div>
    );
  if (message.error)
    return (
      <div className="assistant-response" role="alert">
        <p>{message.error}</p>
        <button
          className="secondary-button"
          disabled={busy}
          onClick={() => send(message.question, { retryId: message.id })}
        >
          Retry response
        </button>
      </div>
    );
  const response = message.response;
  const { summary, currency } = response;
  if (response.portfolio)
    return (
      <article className="assistant-response">
        <p className="response-text">{response.text}</p>
        <div className="response-metrics">
          {[
            ['Portfolio value', response.portfolio.currentValue],
            ['Remaining capital', response.portfolio.basis],
            ['Unrealized gain/loss', response.portfolio.unrealized],
          ].map(([label, value]) => (
            <div key={label}>
              <span>{label}</span>
              <strong>{displayMoney(value, currency)}</strong>
            </div>
          ))}
        </div>
        <p>{response.context}</p>
        <p className="muted">
          {response.source} · Valuation dates:{' '}
          {response.portfolio.valuationDates.join(', ') || 'None'}
        </p>
        <Link to="/investments">Review Investments</Link>
      </article>
    );
  return (
    <article className="assistant-response">
      <p className="response-text">{response.text}</p>
      {response.partial && (
        <p className="partial-banner">
          Partial sample data: these totals are incomplete.
        </p>
      )}
      <div className="response-metrics">
        {[
          ['Total income', summary.income],
          ['Total spending', summary.expenses],
          ['Net cash flow', summary.net],
        ].map(([label, value]) => (
          <div key={label}>
            <span>{label}</span>
            <strong>{money(value, currency)}</strong>
          </div>
        ))}
      </div>
      <h3>Category Distribution</h3>
      <CategoryChart summary={summary} currency={currency} compact />
      {summary.reviews.uncategorized.length > 0 &&
        !message.suggestionDismissed && (
          <aside className="suggestion-review">
            <h3>Categorization suggestion</h3>
            <p>
              {summary.reviews.uncategorized.length} uncategorized
              transaction(s), totaling{' '}
              {money(
                summary.reviews.uncategorized.reduce(
                  (sum, t) => sum - t.amount,
                  0,
                ),
                currency,
              )}
              . The sample merchant description “Woolworths Metro” suggests
              groceries; this is an unverified demo suggestion.
            </p>
            <div>
              <button
                className="compact-button"
                onClick={() => dismissSuggestion(message.id)}
              >
                Dismiss
              </button>
              <button
                className="compact-button brand-button"
                onClick={() =>
                  setNotice({
                    title: 'Review AI suggestion',
                    body: 'This suggestion is unverified. Open uncategorized transactions to review and choose a category yourself; no changes have been applied.',
                    href: '/expenses/transactions?status=uncategorized',
                    linkLabel: 'Review uncategorized transactions',
                  })
                }
              >
                Review suggestions →
              </button>
            </div>
          </aside>
        )}
      <Link className="text-button" to="/expenses/transactions">
        Review expense transactions →
      </Link>
      <Link className="response-action" to="/income">
        View income & invoices →
      </Link>
      <Link className="response-action" to="/dashboard">
        View financial overview →
      </Link>
      <footer>
        {response.source}
        <br />
        {response.context}
        <br />
        Snapshot at response time · fictional data, not financial advice
      </footer>
    </article>
  );
}
