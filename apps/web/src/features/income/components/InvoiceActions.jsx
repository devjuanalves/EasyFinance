import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AppDialog from '../../../components/ui/AppDialog.jsx';
import { useWorkspace } from '../../finance/WorkspaceContext.js';
import InvoicePreview from './InvoicePreview.jsx';
import { printInvoice } from '../documentActions.js';
export default function InvoiceActions({ invoice, compact = false }) {
  const { ledger, canEdit, command } = useWorkspace(),
    navigate = useNavigate();
  const [action, setAction] = useState(null),
    [error, setError] = useState(''),
    [recipient, setRecipient] = useState(''),
    [feedback, setFeedback] = useState('');
  const printRef = useRef(null);
  const client = ledger.data.clients.find((c) => c.id === invoice.clientId),
    items = ledger.data.invoiceItems.filter((i) => i.invoiceId === invoice.id);
  function open(name) {
    setError('');
    setRecipient(client?.email || '');
    setAction(name);
  }
  function run(name, payload = {}) {
    try {
      const id = command(name, { id: invoice.id, ...payload });
      setAction(null);
      if (name === 'duplicateInvoice') navigate(`/income/invoices/${id}/edit`);
      if (name === 'prepareSend')
        setFeedback('Prepared for review. No email was sent.');
    } catch (error) {
      setError(error.message);
    }
  }
  const buttons = (
    <>
      <Link className="compact-button" to={`/income/invoices/${invoice.id}`}>
        View Invoice
      </Link>
      {canEdit && invoice.lifecycle === 'draft' ? (
        <Link
          className="compact-button"
          to={`/income/invoices/${invoice.id}/edit`}
        >
          Edit Invoice
        </Link>
      ) : (
        <button disabled title="Only drafts can be edited">
          Edit unavailable
        </button>
      )}
      <button
        className="compact-button"
        disabled={!canEdit}
        onClick={() => run('duplicateInvoice')}
      >
        Duplicate Invoice
      </button>
      <button className="compact-button" onClick={() => open('pdf')}>
        Print / Save PDF
      </button>
      <button
        className="compact-button"
        disabled={
          !canEdit || invoice.lifecycle === 'cancelled' || client?.archived
        }
        onClick={() => open('send')}
      >
        {invoice.historicalDelivery ? 'Prepare Resend' : 'Prepare Send'}
      </button>
      <button
        className="compact-button"
        disabled={
          !canEdit || invoice.lifecycle === 'cancelled' || invoice.paid > 0
        }
        onClick={() => open('cancel')}
      >
        Cancel Invoice
      </button>
    </>
  );
  return (
    <div className="invoice-actions">
      {compact ? (
        <details>
          <summary>Actions</summary>
          <div className="income-actions">{buttons}</div>
        </details>
      ) : (
        <div className="income-actions">{buttons}</div>
      )}
      {feedback && <p role="status">{feedback}</p>}
      {error && !action && <p role="alert">{error}</p>}
      <AppDialog
        open={action === 'cancel'}
        title="Cancel invoice?"
        onClose={() => setAction(null)}
      >
        <p>
          Cancel {invoice.number}? Historical records remain. Invoices with
          allocated payments cannot be cancelled here.
        </p>
        {error && <p role="alert">{error}</p>}
        <div className="dialog-actions">
          <button className="secondary-button" onClick={() => setAction(null)}>
            Keep invoice
          </button>
          <button
            className="primary-button"
            onClick={() => run('cancelInvoice')}
          >
            Confirm cancellation
          </button>
        </div>
      </AppDialog>
      <AppDialog
        open={action === 'send'}
        title="Prepare invoice for sending"
        onClose={() => setAction(null)}
      >
        <p>
          Review the recipient. Confirming finalizes this invoice in the demo
          and locks editing. It does not send email.
        </p>
        <label className="income-field">
          Recipient email
          <input
            aria-label="Recipient email"
            type="email"
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
          />
        </label>
        {error && <p role="alert">{error}</p>}
        <button
          className="primary-button"
          onClick={() => run('prepareSend', { recipient })}
        >
          Confirm preparation — no email
        </button>
      </AppDialog>
      <AppDialog
        open={action === 'pdf'}
        title="Invoice document preview"
        onClose={() => setAction(null)}
      >
        {action === 'pdf' && (
          <>
            <p>
              Use your browser’s print dialog and select “Save as PDF”. No
              download is claimed until you save it.
            </p>
            <button
              className="primary-button"
              onClick={() => printInvoice(printRef.current)}
            >
              Print / Save as PDF
            </button>
            <div ref={printRef}>
              <InvoicePreview
                invoice={invoice}
                client={invoice.clientSnapshot || client}
                items={items}
              />
            </div>
          </>
        )}
      </AppDialog>
    </div>
  );
}
