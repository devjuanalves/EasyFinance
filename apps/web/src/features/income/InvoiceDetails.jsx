import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useWorkspace } from '../finance/WorkspaceContext.js';
import { money, dateLabel } from '../finance/data/calculations.js';
import { billable } from '../finance/data/invoiceMath.js';
import AppDialog from '../../components/ui/AppDialog.jsx';
import { IncomePage, IncomeKpis, StatusBadge } from './components/IncomeUI.jsx';
import InvoicePreview from './components/InvoicePreview.jsx';
import InvoiceActions from './components/InvoiceActions.jsx';
import PaymentDialog from './components/PaymentDialog.jsx';
export default function InvoiceDetails() {
  const { id } = useParams(),
    { ledger, filters, command, canEdit } = useWorkspace();
  const [pay, setPay] = useState(false),
    [review, setReview] = useState(null),
    [error, setError] = useState('');
  const data = ledger.data,
    invoice = data?.invoices.find(
      (i) => i.id === id && i.workspaceId === filters.workspaceId,
    ),
    client = data?.clients.find((c) => c.id === invoice?.clientId);
  const matches =
    data?.bankMatches.filter(
      (m) =>
        m.invoiceId === id &&
        m.workspaceId === filters.workspaceId &&
        m.status === 'pending',
    ) || [];
  const paymentRows =
    data?.allocations
      .filter((a) => a.invoiceId === invoice?.id)
      .map((a) => ({
        ...a,
        payment: data.payments.find((p) => p.id === a.paymentId),
      })) || [];
  return (
    <IncomePage
      title={invoice ? `Invoice ${invoice.number}` : 'Invoice Details'}
      subtitle="Review the document, receipts, and reconciliation history."
      actions={
        invoice && (
          <button
            className="compact-button brand-button"
            disabled={
              !canEdit || !billable(invoice) || invoice.paid >= invoice.total
            }
            onClick={() => setPay(true)}
          >
            ＋ Record Payment
          </button>
        )
      }
    >
      {data &&
        (!invoice ? (
          <p className="finance-card">
            Invoice not found in this workspace.{' '}
            <Link to="/income/invoices">Back to invoices</Link>
          </p>
        ) : (
          <>
            <div className="section-heading">
              <StatusBadge status={invoice.status} />
              <Link className="text-button" to="/income/invoices">
                Back to invoices
              </Link>
            </div>
            <InvoiceActions invoice={invoice} />
            <IncomeKpis
              currency={invoice.currency}
              values={[
                [
                  'Total Invoiced',
                  invoice.total,
                  invoice.lifecycle === 'draft'
                    ? 'Draft estimate, not billed'
                    : 'Document total',
                ],
                [
                  'Amount Received',
                  invoice.paid,
                  'Allocated confirmed payments',
                ],
                [
                  'Outstanding Balance',
                  invoice.lifecycle === 'cancelled'
                    ? 0
                    : invoice.total - invoice.paid,
                  invoice.lifecycle === 'draft'
                    ? 'Draft estimate; not receivable'
                    : 'Remaining invoice amount',
                ],
              ]}
            />
            <div className="invoice-detail-grid">
              <div>
                {matches.map((match) => {
                  const transaction = data.transactions.find(
                    (t) => t.id === match.transactionId,
                  );
                  return (
                    <section className="finance-card bank-match" key={match.id}>
                      <h2>Possible Bank Match</h2>
                      <p>
                        {transaction?.description} ·{' '}
                        {dateLabel(transaction?.date)} ·{' '}
                        {money(match.amount, invoice.currency)}
                      </p>
                      <p>{match.reason}</p>
                      <div className="income-actions">
                        <button
                          className="compact-button brand-button"
                          disabled={!canEdit}
                          onClick={() => {
                            setError('');
                            setReview(match);
                          }}
                        >
                          Review Bank Match
                        </button>
                        <button
                          className="compact-button"
                          disabled={!canEdit}
                          onClick={() => {
                            try {
                              command('dismissMatch', { id: match.id });
                            } catch (e) {
                              setError(e.message);
                            }
                          }}
                        >
                          Dismiss Suggestion
                        </button>
                      </div>
                    </section>
                  );
                })}
                <InvoicePreview
                  invoice={invoice}
                  client={invoice.clientSnapshot || client}
                  items={data.invoiceItems.filter(
                    (i) => i.invoiceId === invoice.id,
                  )}
                />
                <section className="finance-card">
                  <h2>Recorded Payments History</h2>
                  {!paymentRows.length ? (
                    <p>No payments allocated to this invoice.</p>
                  ) : (
                    <table className="income-table">
                      <caption className="sr-only">
                        Invoice payment allocations
                      </caption>
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Allocated amount</th>
                          <th>Method / Reference</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paymentRows.map((row) => (
                          <tr key={row.id}>
                            <th>{dateLabel(row.payment.date)}</th>
                            <td data-label="Allocated">
                              {money(row.amount, invoice.currency)}
                            </td>
                            <td data-label="Method / Reference">
                              {row.payment.method}
                              <small>
                                {row.payment.reference || 'No reference'}
                              </small>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </section>
              </div>
              <aside>
                <section className="finance-card">
                  <h2>Client Snapshot</h2>
                  <strong>
                    {client?.name}
                    {client?.archived ? ' (archived)' : ''}
                  </strong>
                  <p>{client?.email}</p>
                  <p>{client?.address}</p>
                  <Link
                    className="text-button"
                    to={`/income/clients?client=${client?.id}`}
                  >
                    View Client →
                  </Link>
                  <p className="muted">
                    The document preserves billing details captured at creation.
                  </p>
                </section>
                <section className="finance-card">
                  <h2>Activity Timeline</h2>
                  <ol className="invoice-timeline">
                    {data.events
                      .filter((e) => e.invoiceId === invoice.id)
                      .map((e) => (
                        <li key={e.id}>
                          <strong>{e.text}</strong>
                          <small>{dateLabel(e.date)}</small>
                        </li>
                      ))}
                  </ol>
                </section>
              </aside>
            </div>
            <AppDialog
              open={pay}
              title="Record Payment"
              onClose={() => setPay(false)}
            >
              {pay && (
                <PaymentDialog
                  invoice={invoice}
                  onSaved={() => setPay(false)}
                />
              )}
            </AppDialog>
            <AppDialog
              open={Boolean(review)}
              title="Review Bank Match"
              onClose={() => setReview(null)}
            >
              <p>
                Allocate {money(review?.amount || 0, invoice.currency)} from the
                existing confirmed receipt. No new income will be created.
                Confirm only after reviewing the reference and date above.
              </p>
              {error && <p role="alert">{error}</p>}
              <button
                className="primary-button"
                disabled={!canEdit}
                onClick={() => {
                  try {
                    command('confirmMatch', { matchId: review.id });
                    setReview(null);
                  } catch (e) {
                    setError(e.message);
                  }
                }}
              >
                Confirm Match
              </button>
            </AppDialog>
          </>
        ))}
    </IncomePage>
  );
}
