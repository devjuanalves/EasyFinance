import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useWorkspace } from '../finance/WorkspaceContext.js';
import FinancialFilters from '../finance/components/FinancialFilters.jsx';
import { money, dateLabel } from '../finance/data/calculations.js';
import { incomeSummary } from './incomeService.js';
import {
  IncomePage,
  IncomeKpis,
  ClientFilter,
  StatusBadge,
  InvoiceLink,
  Field,
  Empty,
} from './components/IncomeUI.jsx';
import InvoiceActions from './components/InvoiceActions.jsx';
import { exportInvoices } from './documentActions.js';
export default function InvoiceList() {
  const { ledger, filters, canEdit } = useWorkspace(),
    [params] = useSearchParams();
  const [clientId, setClient] = useState(params.get('client') || 'all'),
    [search, setSearch] = useState(''),
    [status, setStatus] = useState('all'),
    [page, setPage] = useState(1),
    [selected, setSelected] = useState([]);
  const data = ledger.data,
    s = data
      ? incomeSummary(data, filters, { clientId, search, status })
      : null,
    pages = Math.max(1, Math.ceil((s?.invoices.length || 0) / 5)),
    current = Math.min(page, pages);
  const rows = s?.invoices.slice((current - 1) * 5, current * 5) || [];
  const chosen = s?.invoices.filter((i) => selected.includes(i.id)) || [];
  const filter = (setter, value) => {
    setter(value);
    setPage(1);
    setSelected([]);
  };
  return (
    <IncomePage
      title="Invoices"
      subtitle="Create, organize, and track your client billing."
      actions={
        <>
          <Link className="compact-button" to="/income/clients">
            Manage Clients
          </Link>
          {canEdit && (
            <Link
              className="compact-button brand-button"
              to="/income/invoices/new"
            >
              ＋ New Invoice
            </Link>
          )}
        </>
      }
    >
      {data && (
        <>
          <IncomeKpis
            currency={filters.currency}
            values={[
              [
                'Total Invoiced',
                s.invoiced,
                'Selected issue period; finalized only',
              ],
              [
                'Outstanding',
                s.outstanding,
                'Includes overdue; excludes drafts/cancelled',
              ],
              [
                'Paid',
                s.paid,
                'Allocated receipts for selected issued invoices',
              ],
              ['Overdue', s.overdue, 'Unpaid and past due at sample date'],
            ]}
          />
          <section className="finance-card income-filter-panel">
            <FinancialFilters />
            <div className="form-grid">
              <Field
                label="Search invoices"
                type="search"
                placeholder="Invoice number, client, or notes"
                value={search}
                onChange={(e) => filter(setSearch, e.target.value)}
              />
              <Field label="Invoice status">
                <select
                  aria-label="Invoice status"
                  value={status}
                  onChange={(e) => filter(setStatus, e.target.value)}
                >
                  <option value="all">All statuses</option>
                  {[
                    'draft',
                    'prepared',
                    'sent',
                    'partial',
                    'paid',
                    'overdue',
                    'cancelled',
                  ].map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </Field>
              <ClientFilter
                value={clientId}
                onChange={(v) => filter(setClient, v)}
              />
            </div>
          </section>
          <section className="finance-card">
            <div className="section-heading">
              <p>
                {s.invoices.length} matching invoices · KPIs use period and
                client scope
              </p>
              <button
                className="compact-button"
                disabled={!chosen.length}
                onClick={() => exportInvoices(chosen, data.clients)}
              >
                Export Selection CSV ({chosen.length})
              </button>
            </div>
            {!rows.length ? (
              <Empty>No invoices match these filters.</Empty>
            ) : (
              <div className="income-table-wrap">
                <table className="income-table invoice-list-table">
                  <caption className="sr-only">
                    Invoices with their outstanding balances
                  </caption>
                  <thead>
                    <tr>
                      <th>Select</th>
                      <th>Invoice / Client</th>
                      <th>Issue / Due</th>
                      <th>Total</th>
                      <th>Outstanding</th>
                      <th>Status / Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((i) => (
                      <tr key={i.id}>
                        <td>
                          <input
                            type="checkbox"
                            aria-label={`Select ${i.number}`}
                            checked={selected.includes(i.id)}
                            onChange={(e) =>
                              setSelected(
                                e.target.checked
                                  ? [...selected, i.id]
                                  : selected.filter((id) => id !== i.id),
                              )
                            }
                          />
                        </td>
                        <th>
                          <InvoiceLink invoice={i} />
                          <small>
                            {
                              data.clients.find((c) => c.id === i.clientId)
                                ?.name
                            }
                          </small>
                        </th>
                        <td data-label="Issue / Due">
                          {dateLabel(i.issuedDate)}
                          <small>Due {dateLabel(i.dueDate)}</small>
                        </td>
                        <td data-label="Total">{money(i.total, i.currency)}</td>
                        <td data-label="Outstanding">
                          {i.lifecycle === 'cancelled'
                            ? 'Cancelled'
                            : money(i.total - i.paid, i.currency)}
                          {i.lifecycle === 'draft' && (
                            <small>Draft estimate</small>
                          )}
                        </td>
                        <td>
                          <StatusBadge status={i.status} />
                          <InvoiceActions invoice={i} compact />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="pagination">
              <span>
                Page {current} of {pages}
              </span>
              <button
                className="compact-button"
                disabled={current === 1}
                onClick={() => setPage(current - 1)}
              >
                Previous
              </button>
              <button
                className="compact-button"
                disabled={current === pages}
                onClick={() => setPage(current + 1)}
              >
                Next
              </button>
            </div>
          </section>
        </>
      )}
    </IncomePage>
  );
}
