import { financialData, periods } from '../data/financialData.js';
import { useWorkspace } from '../WorkspaceContext.js';
export default function FinancialFilters({ compact = false }) {
  const { filters, setFilter } = useWorkspace();
  return (
    <div className={`financial-filters ${compact ? 'compact-filters' : ''}`}>
      <label>
        Period
        <select
          aria-label="Period"
          value={filters.periodId}
          onChange={(e) => setFilter('periodId', e.target.value)}
        >
          {periods.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        Financial account
        <select
          aria-label="Financial account"
          value={filters.accountId}
          onChange={(e) => setFilter('accountId', e.target.value)}
        >
          <option value="all">All accounts</option>
          {financialData.accounts
            .filter(
              (a) =>
                a.workspaceId === filters.workspaceId &&
                a.currency === filters.currency,
            )
            .map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
        </select>
      </label>
      <label>
        Currency
        <select
          aria-label="Currency"
          value={filters.currency}
          onChange={(e) => setFilter('currency', e.target.value)}
        >
          <option value="AUD">AUD · native amounts</option>
          <option value="EUR">EUR · native amounts</option>
          <option value="USD">USD · native amounts</option>
          <option disabled>Other currencies · conversion unavailable</option>
        </select>
      </label>
      {!compact && (
        <>
          <label>
            Participant
            <select
              aria-label="Participant"
              value={filters.participantId}
              onChange={(e) => setFilter('participantId', e.target.value)}
            >
              <option value="all">All participants</option>
              {financialData.participants.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Demo data state
            <select
              aria-label="Demo data state"
              value={filters.scenario}
              onChange={(e) => setFilter('scenario', e.target.value)}
            >
              <option value="normal">Normal sample data</option>
              <option value="partial">Partial sample data</option>
              <option value="empty">Empty sample data</option>
              <option value="error">Simulated error</option>
            </select>
          </label>
        </>
      )}
    </div>
  );
}
