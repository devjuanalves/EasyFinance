import { useEffect, useRef, useState } from 'react';
import {
  Link,
  useBlocker,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom';
import { useWorkspace } from '../finance/WorkspaceContext.js';
import AppDialog from '../../components/ui/AppDialog.jsx';
import {
  blankInvoice,
  editableInvoice,
  validateInvoice,
  addDays,
} from './incomeService.js';
import { invoiceTotals } from '../finance/data/invoiceMath.js';
import { IncomePage, Field } from './components/IncomeUI.jsx';
import InvoiceItems from './components/InvoiceItems.jsx';
import InvoicePreview, { InvoiceTotals } from './components/InvoicePreview.jsx';
import ClientForm from './components/ClientForm.jsx';
import { printInvoice } from './documentActions.js';
export default function InvoiceEditor() {
  const { id } = useParams(),
    { ledger, filters, canEdit } = useWorkspace();
  const [params] = useSearchParams();
  const data = ledger.data,
    invoice = data?.invoices.find(
      (i) => i.id === id && i.workspaceId === filters.workspaceId,
    );
  return (
    <IncomePage
      title={id ? 'Edit Invoice' : 'Create Invoice'}
      subtitle="Build your invoice, review the amounts, and save a session draft."
    >
      {data &&
        (!canEdit ? (
          <p className="finance-card">
            Editing unavailable for this data state or role.
          </p>
        ) : id && (!invoice || invoice.lifecycle !== 'draft') ? (
          <section className="finance-card">
            <h2>Invoice editing unavailable</h2>
            <p>
              Only drafts in the current workspace can be edited. Finalized
              records require a corrective workflow.
            </p>
            <Link to="/income/invoices">Back to invoices</Link>
          </section>
        ) : (
          <EditorForm
            key={`${filters.workspaceId}-${id || 'new'}`}
            invoice={invoice}
            clientId={params.get('client')}
          />
        ))}
    </IncomePage>
  );
}
function EditorForm({ invoice, clientId }) {
  const { ledger, filters, command, setUnsaved } = useWorkspace(),
    data = ledger.data,
    navigate = useNavigate();
  const [initial] = useState(() =>
    invoice
      ? editableInvoice(data, invoice)
      : blankInvoice(data, filters, clientId),
  );
  const [form, setForm] = useState(initial),
    [error, setError] = useState(''),
    [addClient, setAddClient] = useState(false),
    [preview, setPreview] = useState(false),
    [prepare, setPrepare] = useState(false),
    [recipient, setRecipient] = useState('');
  const saved = useRef(false),
    printRef = useRef(null);
  const dirty = JSON.stringify(form) !== JSON.stringify(initial);
  const blocker = useBlocker(() => dirty && !saved.current);
  useEffect(() => {
    setUnsaved(dirty);
    const handler = (e) => {
      if (dirty && !saved.current) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => {
      setUnsaved(false);
      window.removeEventListener('beforeunload', handler);
    };
  }, [dirty, setUnsaved]);
  const client = data.clients.find(
    (c) => c.id === form.clientId && c.workspaceId === filters.workspaceId,
  );
  let totals, calcError;
  try {
    totals = invoiceTotals(form.items, form.discount);
  } catch (e) {
    calcError = e.message;
  }
  function change(name, value) {
    setError('');
    setForm({ ...form, [name]: value });
  }
  function chooseClient(id) {
    setError('');
    const client = data.clients.find((c) => c.id === id);
    const currency = client?.defaultCurrency || form.currency;
    setForm({
      ...form,
      clientId: id,
      currency,
      accountId:
        data.accounts.find(
          (a) =>
            a.workspaceId === filters.workspaceId && a.currency === currency,
        )?.id || '',
      paymentTerms: client?.paymentTerms || '14',
      dueDate: addDays(form.issuedDate, Number(client?.paymentTerms || 14)),
    });
  }
  function save(send = false) {
    try {
      validateInvoice(data, filters.workspaceId, form, invoice?.id);
      if (send && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient))
        throw new Error('Enter a valid recipient email.');
      if (send && totals.total <= 0)
        throw new Error('Total must be greater than zero before finalizing.');
      const id = command('saveInvoice', { id: invoice?.id, draft: form });
      if (send) command('prepareSend', { id, recipient });
      saved.current = true;
      setUnsaved(false);
      navigate(`/income/invoices/${id}`);
    } catch (e) {
      setError(e.message);
    }
  }
  return (
    <>
      <div className="income-actions editor-toolbar">
        <Link className="compact-button" to="/income/invoices">
          Back / Cancel
        </Link>
        <button className="compact-button" onClick={() => setPreview(!preview)}>
          {preview ? 'Edit Form' : 'Preview Invoice'}
        </button>
        <button className="compact-button" onClick={() => save()}>
          Save Draft
        </button>
        <button
          className="compact-button brand-button"
          onClick={() => {
            try {
              validateInvoice(data, filters.workspaceId, form, invoice?.id);
              setError('');
              setRecipient(client?.email || '');
              setPrepare(true);
            } catch (e) {
              setError(e.message);
            }
          }}
        >
          Review & Prepare Send
        </button>
      </div>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      <div className={`invoice-editor-grid ${preview ? 'show-preview' : ''}`}>
        <form
          className="invoice-edit-form"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <section className="finance-card">
            <h2>Invoice Terms & Schedule</h2>
            <div className="form-grid">
              <Field
                label="Invoice Number"
                value={form.number}
                onChange={(e) => change('number', e.target.value)}
                required
              />
              <Field
                label="Issue Date"
                type="date"
                value={form.issuedDate}
                onChange={(e) => change('issuedDate', e.target.value)}
              />
              <Field
                label="Due Date"
                type="date"
                value={form.dueDate}
                onChange={(e) => change('dueDate', e.target.value)}
              />
              <Field
                label="Payment Terms (days)"
                inputMode="numeric"
                value={form.paymentTerms}
                onChange={(e) => change('paymentTerms', e.target.value)}
              />
              <Field label="Invoice Currency">
                <select
                  aria-label="Invoice Currency"
                  value={form.currency}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      currency: e.target.value,
                      accountId:
                        data.accounts.find(
                          (a) =>
                            a.workspaceId === filters.workspaceId &&
                            a.currency === e.target.value,
                        )?.id || '',
                    })
                  }
                >
                  <option>AUD</option>
                  <option>EUR</option>
                </select>
              </Field>
              <Field label="Receiving Account">
                <select
                  aria-label="Receiving Account"
                  value={form.accountId}
                  onChange={(e) => change('accountId', e.target.value)}
                >
                  <option value="">Select account</option>
                  {data.accounts
                    .filter(
                      (a) =>
                        a.workspaceId === filters.workspaceId &&
                        a.currency === form.currency,
                    )
                    .map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                </select>
              </Field>
            </div>
            <p className="muted">
              Sample issue date must be between {data.coverageStart} and{' '}
              {data.asOf}. Terms are descriptive; Due Date controls the
              deadline.
            </p>
          </section>
          <section className="finance-card">
            <div className="section-heading">
              <h2>Bill To Client</h2>
              <button
                type="button"
                className="text-button"
                onClick={() => setAddClient(true)}
              >
                ＋ Add Client
              </button>
            </div>
            <Field label="Select Client">
              <select
                aria-label="Select Client"
                value={form.clientId}
                onChange={(e) => chooseClient(e.target.value)}
              >
                <option value="">Select a client</option>
                {data.clients
                  .filter(
                    (c) => c.workspaceId === filters.workspaceId && !c.archived,
                  )
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
              </select>
            </Field>
            {client && (
              <p className="invoice-billto">
                {client.businessName || client.name}
                <br />
                {client.email}
                <br />
                {client.address}
              </p>
            )}
          </section>
          <InvoiceItems
            items={form.items}
            currency={form.currency}
            onChange={(items) => change('items', items)}
          />
          <section className="finance-card">
            <h2>Summary & Taxation</h2>
            <Field
              label="Discount amount"
              inputMode="decimal"
              value={form.discount}
              onChange={(e) => change('discount', e.target.value)}
            />
            <p className="muted">
              Tax is optional per item. No GST is applied automatically.
              Discount is allocated before tax.
            </p>
            {totals ? (
              <InvoiceTotals totals={totals} currency={form.currency} />
            ) : (
              <p role="alert">{calcError}</p>
            )}
          </section>
          <section className="finance-card">
            <h2>Payment Instructions & Notes</h2>
            <Field label="Payment Instructions">
              <textarea
                aria-label="Payment Instructions"
                value={form.paymentInstructions}
                onChange={(e) => change('paymentInstructions', e.target.value)}
              />
            </Field>
            <Field label="Notes">
              <textarea
                aria-label="Notes"
                value={form.notes}
                onChange={(e) => change('notes', e.target.value)}
              />
            </Field>
          </section>
        </form>
        <aside className="editor-live-preview">
          <div className="section-heading">
            <h2>Live Preview</h2>
            <button
              className="compact-button"
              onClick={() => printInvoice(printRef.current)}
            >
              Print / Save PDF
            </button>
          </div>
          <div ref={printRef}>
            <InvoicePreview invoice={form} client={client} items={form.items} />
          </div>
        </aside>
      </div>
      <AppDialog
        open={addClient}
        title="Add Client"
        onClose={() => setAddClient(false)}
      >
        {addClient && (
          <ClientForm
            onSaved={(id, savedClient) => {
              setForm({
                ...form,
                clientId: id,
                currency: savedClient.defaultCurrency,
                accountId:
                  data.accounts.find(
                    (a) =>
                      a.workspaceId === filters.workspaceId &&
                      a.currency === savedClient.defaultCurrency,
                  )?.id || '',
                paymentTerms: savedClient.paymentTerms,
              });
              setAddClient(false);
            }}
          />
        )}
      </AppDialog>
      <AppDialog
        open={prepare}
        title="Confirm invoice preparation"
        onClose={() => setPrepare(false)}
      >
        <p>
          This finalizes the invoice for review and locks editing. No email is
          sent.
        </p>
        <Field
          label="Recipient email"
          type="email"
          value={recipient}
          onChange={(e) => setRecipient(e.target.value)}
        />
        {error && <p role="alert">{error}</p>}
        <button className="primary-button" onClick={() => save(true)}>
          Confirm preparation — no email
        </button>
      </AppDialog>
      <AppDialog
        open={blocker.state === 'blocked'}
        title="Discard unsaved changes?"
        onClose={() => blocker.reset?.()}
      >
        <p>Your invoice changes have not been saved.</p>
        <div className="dialog-actions">
          <button className="secondary-button" onClick={() => blocker.reset()}>
            Keep editing
          </button>
          <button
            className="primary-button"
            onClick={() => {
              setUnsaved(false);
              blocker.proceed();
            }}
          >
            Discard changes
          </button>
        </div>
      </AppDialog>
    </>
  );
}
