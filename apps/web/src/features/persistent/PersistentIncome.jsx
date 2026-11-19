import { useWorkspace } from '../finance/WorkspaceContext.js';
import { useEffect, useRef, useState } from 'react';
import {
  Link,
  useBlocker,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  api,
  decimalToMinor,
  formatMinor,
} from '../../services/persistentApi.js';
import { useAuth } from '../auth/hooks/useAuth.js';
import {
  IncomePage,
  IncomeKpis,
  Field,
  StatusBadge,
} from '../income/components/IncomeUI.jsx';
import InvoiceItems from '../income/components/InvoiceItems.jsx';
import InvoicePreview, {
  InvoiceTotals,
} from '../income/components/InvoicePreview.jsx';
import ClientForm from '../income/components/ClientForm.jsx';
import { invoiceTotals } from '../finance/data/invoiceMath.js';
import { printInvoice } from '../income/documentActions.js';
import AppDialog from '../../components/ui/AppDialog.jsx';
import '../income/income.css';
const decimal = (n) =>
  `${BigInt(n) / 100n}.${(BigInt(n) % 100n).toString().padStart(2, '0')}`;
const today = () => new Date().toISOString().slice(0, 10);
const title = {
  overview: 'Income Overview',
  list: 'Invoices',
  new: 'Create Invoice',
  edit: 'Edit Invoice',
  detail: 'Invoice Details',
  clients: 'Clients & Employers',
};
function Failure({ query }) {
  return (
    <section className="finance-card" role="alert">
      <p>{query.error.message}</p>
      <button className="compact-button" onClick={() => query.refetch()}>
        Retry
      </button>
    </section>
  );
}
export default function PersistentIncome({ screen = 'overview' }) {
  const user = useAuth(),
    [params, setParams] = useSearchParams();
  const workspaces = useQuery({
    queryKey: ['persistent', user.id, 'workspaces'],
    queryFn: () => api('/workspaces'),
    retry: false,
  });
  const selected = params.has('workspace')
    ? workspaces.data?.find((w) => w.id === params.get('workspace'))
    : workspaces.data?.[0];
  return (
    <IncomePage
      persistent
      title={title[screen]}
      subtitle="Saved to the development database. Issuing an invoice does not receive money or send email."
    >
      {workspaces.isPending ? (
        <p role="status">Loading workspaces…</p>
      ) : workspaces.isError ? (
        <Failure query={workspaces} />
      ) : selected ? (
        <>
          <Field label="Persistent workspace">
            <select
              aria-label="Persistent workspace"
              value={selected.id}
              onChange={(e) => setParams({ workspace: e.target.value })}
            >
              {workspaces.data.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name} · {w.role}
                </option>
              ))}
            </select>
          </Field>
          <IncomeContent
            key={selected.id + screen}
            workspace={selected}
            screen={screen}
          />
        </>
      ) : (
        <p>No authorized workspace.</p>
      )}
    </IncomePage>
  );
}
function IncomeContent({ workspace, screen }) {
  const { id } = useParams(),
    [params] = useSearchParams(),
    user = useAuth(),
    cache = useQueryClient(),
    navigate = useNavigate();
  const root = `/workspaces/${workspace.id}`,
    prefix = ['persistent', user.id, workspace.id],
    link = (p) => `${p}?workspace=${workspace.id}`;
  const [currency, setCurrency] = useState(workspace.currency || 'AUD'),
    [search, setSearch] = useState(''),
    [status, setStatus] = useState(''),
    [clientId, setClient] = useState(params.get('client') || ''),
    [accountId, setAccount] = useState(''),
    [start, setStart] = useState(''),
    [end, setEnd] = useState(''),
    [page, setPage] = useState(1),
    [dialog, setDialog] = useState(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const canEdit = ['owner', 'editor'].includes(workspace.role);
  const common = new URLSearchParams({
    currency,
    ...(clientId ? { clientId } : {}),
    ...(accountId ? { accountId } : {}),
    ...(start ? { start } : {}),
    ...(end ? { end } : {}),
  });
  const supporting = useQuery({
    queryKey: [...prefix, 'income-support'],
    queryFn: async () => ({
      clients: await api(root + '/clients'),
      accounts: await api(root + '/accounts'),
    }),
    retry: false,
  });
  const rows = useQuery({
    queryKey: [...prefix, 'invoices', common.toString(), search, status, page],
    enabled: ['overview', 'list'].includes(screen),
    queryFn: () =>
      api(
        root +
          '/invoices?' +
          common +
          `&page=${page}&limit=10` +
          (search ? '&search=' + encodeURIComponent(search) : '') +
          (status ? '&status=' + status : ''),
      ),
    retry: false,
  });
  const summary = useQuery({
    queryKey: [...prefix, 'income-summary', common.toString()],
    enabled: screen === 'overview',
    queryFn: () => api(root + '/income/summary?' + common),
    retry: false,
  });
  const detail = useQuery({
    queryKey: [...prefix, 'invoice', id],
    enabled: !!id,
    queryFn: () => api(root + '/invoices/' + id),
    retry: false,
  });
  async function refresh() {
    await cache.invalidateQueries({ queryKey: prefix });
  }
  async function action(path, body) {
    setBusy(true);
    setError('');
    try {
      const result = await api(root + path, { method: 'POST', body });
      await refresh();
      setDialog(null);
      return result;
    } catch (e) {
      setError(e.message);
      return null;
    } finally {
      setBusy(false);
    }
  }
  const clients = supporting.data?.clients || [],
    accounts = supporting.data?.accounts || [];
  const invoice = detail.data;
  const filteredClients = clients.filter(
    (c) =>
      (c.name + ' ' + c.businessName + ' ' + c.email)
        .toLowerCase()
        .includes(search.toLowerCase()) &&
      (!status || (status === 'archived') === c.archived),
  );
  const money = (n) => formatMinor(n, currency);
  return (
    <>
      <div className="income-actions">
        <Link className="compact-button" to={link('/income')}>
          Overview
        </Link>
        <Link className="compact-button" to={link('/income/invoices')}>
          Manage Invoices
        </Link>
        <Link className="compact-button" to={link('/income/clients')}>
          Manage Clients
        </Link>
        {canEdit && (
          <Link
            className="compact-button brand-button"
            to={link('/income/invoices/new')}
          >
            New Invoice
          </Link>
        )}
      </div>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      {supporting.isPending ? (
        <p role="status">Loading accounts and clients…</p>
      ) : supporting.isError ? (
        <Failure query={supporting} />
      ) : (
        <>
          {['overview', 'list'].includes(screen) && (
            <>
              <section className="finance-card form-grid">
                <Field label="Currency">
                  <select
                    aria-label="Currency"
                    value={currency}
                    onChange={(e) => {
                      setCurrency(e.target.value);
                      setAccount('');
                      setPage(1);
                    }}
                  >
                    {['AUD', 'EUR', 'USD'].map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Financial account">
                  <select
                    aria-label="Financial account"
                    value={accountId}
                    onChange={(e) => {
                      setAccount(e.target.value);
                      setPage(1);
                    }}
                  >
                    <option value="">All accounts</option>
                    {accounts
                      .filter((a) => a.currency === currency)
                      .map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                  </select>
                </Field>
                <Field label="Client">
                  <select
                    aria-label="Client"
                    value={clientId}
                    onChange={(e) => {
                      setClient(e.target.value);
                      setPage(1);
                    }}
                  >
                    <option value="">All clients</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field
                  label="Period start"
                  type="date"
                  value={start}
                  onChange={(e) => {
                    setStart(e.target.value);
                    setPage(1);
                  }}
                />
                <Field
                  label="Period end"
                  type="date"
                  value={end}
                  onChange={(e) => {
                    setEnd(e.target.value);
                    setPage(1);
                  }}
                />
                <Field
                  label="Search invoices"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                />
                <Field label="Invoice status">
                  <select
                    aria-label="Invoice status"
                    value={status}
                    onChange={(e) => {
                      setStatus(e.target.value);
                      setPage(1);
                    }}
                  >
                    <option value="">All statuses</option>
                    {[
                      'draft',
                      'issued',
                      'partial',
                      'paid',
                      'overdue',
                      'cancelled',
                    ].map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </Field>
              </section>
              {screen === 'overview' &&
                (summary.isPending ? (
                  <p role="status">Loading income totals…</p>
                ) : summary.isError ? (
                  <Failure query={summary} />
                ) : (
                  <IncomeKpis
                    currency={currency}
                    values={[
                      [
                        'Total Received',
                        money(summary.data.receivedMinor),
                        'Confirmed income by receipt date; transfers excluded',
                      ],
                      [
                        'Total Invoiced',
                        money(summary.data.invoicedMinor),
                        'Issued invoices by issue date',
                      ],
                      [
                        'Outstanding Amount',
                        money(summary.data.outstandingMinor),
                        'Unpaid issued balances',
                      ],
                      [
                        'Overdue Amount',
                        money(summary.data.overdueMinor),
                        'Subset of outstanding, as of today',
                      ],
                    ]}
                  />
                ))}
              {rows.isPending ? (
                <p role="status">Loading invoices…</p>
              ) : rows.isError ? (
                <Failure query={rows} />
              ) : (
                <>
                  {screen === 'list' && (
                    <IncomeKpis
                      currency={currency}
                      values={[
                        [
                          'Total Invoiced',
                          money(rows.data.summary.invoicedMinor),
                          'Issue-period invoices',
                        ],
                        [
                          'Outstanding',
                          money(rows.data.summary.outstandingMinor),
                          'Unpaid issued balances',
                        ],
                        [
                          'Paid',
                          money(rows.data.summary.paidMinor),
                          'Allocations on issue-period invoices',
                        ],
                        [
                          'Overdue',
                          money(rows.data.summary.overdueMinor),
                          'Subset of outstanding',
                        ],
                      ]}
                    />
                  )}
                  <section className="finance-card">
                    <h2>
                      {screen === 'overview'
                        ? 'Recent invoices'
                        : 'Invoice list'}
                    </h2>
                    <p className="muted">
                      {screen === 'overview'
                        ? 'Summary uses period/account/client/currency. Search and status narrow the rows.'
                        : 'Summary uses period/account/client/currency and search. Status narrows the rows.'}
                    </p>
                    {!rows.data.count ? (
                      <p>No invoices for this selection.</p>
                    ) : (
                      <div className="income-table-wrap">
                        <table className="income-table">
                          <caption className="sr-only">
                            Persistent invoices
                          </caption>
                          <thead>
                            <tr>
                              {[
                                'Invoice',
                                'Client',
                                'Issue / Due',
                                'Total',
                                'Outstanding',
                                'Status',
                                'Actions',
                              ].map((x) => (
                                <th key={x}>{x}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {rows.data.rows.map((r) => (
                              <tr key={r.id}>
                                <td data-label="Invoice">
                                  <Link to={link('/income/invoices/' + r.id)}>
                                    {r.number}
                                  </Link>
                                </td>
                                <td data-label="Client">{r.client.name}</td>
                                <td data-label="Issue / Due">
                                  {r.issuedDate}
                                  <br />
                                  {r.dueDate}
                                </td>
                                <td data-label="Total">
                                  {formatMinor(r.totalMinor, r.currency)}
                                </td>
                                <td data-label="Outstanding">
                                  {formatMinor(r.outstandingMinor, r.currency)}
                                </td>
                                <td data-label="Status">
                                  <StatusBadge status={r.status} />
                                </td>
                                <td data-label="Actions">
                                  <Link
                                    className="text-button"
                                    to={link('/income/invoices/' + r.id)}
                                  >
                                    View Invoice
                                  </Link>
                                  {canEdit && r.lifecycle === 'draft' && (
                                    <Link
                                      className="text-button"
                                      to={link(
                                        '/income/invoices/' + r.id + '/edit',
                                      )}
                                    >
                                      Edit Invoice
                                    </Link>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                    <div className="income-actions">
                      <button
                        className="compact-button"
                        disabled={page === 1}
                        onClick={() => setPage(page - 1)}
                      >
                        Previous
                      </button>
                      <span>
                        Page {page} · {rows.data.count} invoices
                      </span>
                      <button
                        className="compact-button"
                        disabled={page * 10 >= rows.data.count}
                        onClick={() => setPage(page + 1)}
                      >
                        Next
                      </button>
                    </div>
                  </section>
                </>
              )}
            </>
          )}
          {screen === 'clients' && (
            <>
              <section className="finance-card">
                <div className="income-actions">
                  <Field
                    label="Search clients"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                  <Field label="Client status">
                    <select
                      aria-label="Client status"
                      value={status}
                      onChange={(e) => setStatus(e.target.value)}
                    >
                      <option value="">All clients</option>
                      <option value="active">Active</option>
                      <option value="archived">Archived</option>
                    </select>
                  </Field>
                  {canEdit && (
                    <button
                      className="compact-button brand-button"
                      onClick={() =>
                        setDialog({
                          type: 'client',
                          operation: crypto.randomUUID(),
                        })
                      }
                    >
                      Add Client
                    </button>
                  )}
                </div>
              </section>
              <div className="client-grid">
                {filteredClients.map((c) => (
                  <article className="finance-card" key={c.id}>
                    <h2>{c.name}</h2>
                    <p>
                      {c.businessName} · {c.archived ? 'Archived' : 'Active'}
                    </p>
                    <p>{c.email}</p>
                    <p>
                      {c.defaultCurrency} · Net {c.paymentTerms} days
                    </p>
                    <div className="income-actions">
                      <button
                        className="compact-button"
                        onClick={() => setDialog({ type: 'client', client: c })}
                      >
                        {canEdit ? 'Edit Client' : 'View Client'}
                      </button>
                      {canEdit && !c.archived && (
                        <Link
                          className="compact-button"
                          to={link('/income/invoices/new') + '&client=' + c.id}
                        >
                          Create Invoice
                        </Link>
                      )}
                      {canEdit && (
                        <button
                          className="text-button"
                          onClick={() =>
                            setDialog({ type: 'archive', client: c })
                          }
                        >
                          {c.archived ? 'Restore Client' : 'Archive Client'}
                        </button>
                      )}
                    </div>
                  </article>
                ))}
              </div>
              {!filteredClients.length && (
                <p className="finance-card">No clients for this selection.</p>
              )}
              <p className="muted">
                Recurring templates are not connected in API mode. No drafts are
                scheduled or sent automatically.
              </p>
            </>
          )}
          {['new', 'edit'].includes(screen) &&
            (screen === 'edit' && detail.isPending ? (
              <p role="status">Loading draft…</p>
            ) : screen === 'edit' && detail.isError ? (
              <Failure query={detail} />
            ) : !canEdit ? (
              <p>Read-only workspace: editing is unavailable.</p>
            ) : screen === 'edit' && invoice.lifecycle !== 'draft' ? (
              <p className="finance-card">
                Only drafts can be edited. Issued financial records require a
                corrective workflow.
              </p>
            ) : (
              <PersistentEditor
                key={id || 'new'}
                invoice={invoice}
                clients={clients}
                accounts={accounts}
                root={root}
                link={link}
                refresh={refresh}
                preselected={params.get('client')}
              />
            ))}
          {screen === 'detail' &&
            (detail.isPending ? (
              <p role="status">Loading invoice…</p>
            ) : detail.isError ? (
              <Failure query={detail} />
            ) : (
              invoice && (
                <>
                  <div className="income-actions">
                    <StatusBadge status={invoice.status} />
                    {canEdit && invoice.lifecycle === 'draft' && (
                      <>
                        <Link
                          className="compact-button"
                          to={link('/income/invoices/' + id + '/edit')}
                        >
                          Edit Invoice
                        </Link>
                        <button
                          className="compact-button brand-button"
                          onClick={() => setDialog({ type: 'issue' })}
                        >
                          Issue Invoice
                        </button>
                      </>
                    )}
                    {canEdit &&
                      invoice.lifecycle === 'issued' &&
                      BigInt(invoice.outstandingMinor) > 0n && (
                        <button
                          className="compact-button brand-button"
                          onClick={() =>
                            setDialog({
                              type: 'payment',
                              operation: crypto.randomUUID(),
                            })
                          }
                        >
                          Record Payment
                        </button>
                      )}
                    {canEdit && (
                      <button
                        className="compact-button"
                        onClick={() =>
                          setDialog({
                            type: 'duplicate',
                            operation: crypto.randomUUID(),
                          })
                        }
                      >
                        Duplicate Invoice
                      </button>
                    )}
                    {canEdit &&
                      invoice.lifecycle !== 'cancelled' &&
                      invoice.paidMinor === '0' && (
                        <button
                          className="text-button"
                          onClick={() => setDialog({ type: 'cancel' })}
                        >
                          Cancel Invoice
                        </button>
                      )}
                  </div>
                  <IncomeKpis
                    currency={invoice.currency}
                    values={[
                      [
                        'Invoice Total',
                        formatMinor(invoice.totalMinor, invoice.currency),
                        'Billed amount',
                      ],
                      [
                        'Received',
                        formatMinor(invoice.paidMinor, invoice.currency),
                        'Allocated receipts',
                      ],
                      [
                        'Outstanding',
                        formatMinor(invoice.outstandingMinor, invoice.currency),
                        'Unpaid issued balance',
                      ],
                    ]}
                  />
                  <PersistentDocument invoice={invoice} />
                  <section className="finance-card">
                    <h2>Payment History</h2>
                    {invoice.payments.length ? (
                      invoice.payments.map((p) => (
                        <article key={p.allocationId}>
                          <strong>
                            {formatMinor(p.amountMinor, invoice.currency)}
                          </strong>
                          <p>
                            {p.date} · {p.method} · {p.reference}
                          </p>
                          <Link to={link('/expenses/transactions')}>
                            View Transactions
                          </Link>
                        </article>
                      ))
                    ) : (
                      <p>No payments recorded.</p>
                    )}
                  </section>
                  <section className="finance-card">
                    <h2>Activity Timeline</h2>
                    <ul>
                      {invoice.activity.map((e) => (
                        <li key={e.id}>
                          {e.action} · {new Date(e.createdAt).toLocaleString()}
                        </li>
                      ))}
                    </ul>
                  </section>
                  <p className="muted">
                    Email delivery and automatic bank matching are unavailable.
                    Existing receipts can be linked explicitly in Record
                    Payment. Refunds and credit notes require a future
                    corrective workflow.
                  </p>
                </>
              )
            ))}
        </>
      )}
      <AppDialog
        open={!!dialog}
        title={
          {
            client: dialog?.client ? 'Client Details' : 'Add Client',
            archive: 'Confirm client status',
            issue: 'Issue invoice for review',
            cancel: 'Cancel invoice',
            duplicate: 'Duplicate invoice',
            payment: 'Record Payment',
          }[dialog?.type] || ''
        }
        onClose={() => {
          setDialog(null);
          setError('');
        }}
        closeDisabled={busy}
        wide
      >
        {error && <p role="alert">{error}</p>}
        {dialog?.type === 'client' && (
          <ClientForm
            key={dialog.client?.id || dialog.operation}
            client={dialog.client}
            editable={canEdit}
            onSubmitClient={async (form) => {
              setBusy(true);
              try {
                const { id: ignored, archived, ...body } = form;
                void ignored;
                void archived;
                const result = await api(
                  root +
                    '/clients' +
                    (dialog.client ? '/' + dialog.client.id : ''),
                  {
                    method: dialog.client ? 'PATCH' : 'POST',
                    body: {
                      ...body,
                      ...(!dialog.client ? { id: dialog.operation } : {}),
                    },
                  },
                );
                await refresh();
                return result.id;
              } finally {
                setBusy(false);
              }
            }}
            onSaved={() => setDialog(null)}
          />
        )}
        {dialog?.type === 'archive' && (
          <>
            <p>Historical invoices and payments are preserved.</p>
            <button
              className="primary-button"
              disabled={busy}
              onClick={() =>
                action('/clients/' + dialog.client.id + '/archive', {
                  archived: !dialog.client.archived,
                })
              }
            >
              Confirm client status
            </button>
          </>
        )}
        {['issue', 'cancel'].includes(dialog?.type) && (
          <>
            <p>
              {dialog.type === 'issue'
                ? 'This locks the financial document. No email is sent and no income is recorded.'
                : 'Cancel this unpaid invoice? Historical records are retained.'}
            </p>
            <button
              className="primary-button"
              disabled={busy}
              onClick={() =>
                action('/invoices/' + id + '/' + dialog.type, {
                  version: invoice.version,
                })
              }
            >
              Confirm {dialog.type === 'issue' ? 'Issue' : 'Cancellation'}
            </button>
          </>
        )}
        {dialog?.type === 'duplicate' && (
          <DuplicateForm
            busy={busy}
            onSave={async (number) => {
              const r = await action('/invoices/' + id + '/duplicate', {
                id: dialog.operation,
                number,
              });
              if (r) navigate(link('/income/invoices/' + r.id));
            }}
          />
        )}
        {dialog?.type === 'payment' && (
          <PaymentForm
            key={dialog.operation}
            invoice={invoice}
            busy={busy}
            onSave={(body) =>
              action('/invoices/' + id + '/payments', {
                ...body,
                idempotencyKey: dialog.operation,
              })
            }
          />
        )}
      </AppDialog>
    </>
  );
}
function DuplicateForm({ busy, onSave }) {
  const [number, setNumber] = useState('');
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave(number);
      }}
    >
      <Field
        label="New invoice number"
        value={number}
        onChange={(e) => setNumber(e.target.value)}
        required
      />
      <button className="primary-button" disabled={busy}>
        Create duplicate draft
      </button>
    </form>
  );
}
function PaymentForm({ invoice, busy, onSave }) {
  const [amount, setAmount] = useState(decimal(invoice.outstandingMinor)),
    [date, setDate] = useState(today()),
    [method, setMethod] = useState('bank transfer'),
    [reference, setReference] = useState(''),
    [transactionId, setTransaction] = useState(''),
    [error, setError] = useState('');
  return (
    <form
      className="income-form"
      onSubmit={(e) => {
        e.preventDefault();
        try {
          setError('');
          onSave({
            amountMinor: decimalToMinor(amount),
            date,
            method,
            reference,
            ...(transactionId ? { transactionId } : {}),
          });
        } catch (e) {
          setError(e.message);
        }
      }}
    >
      {error && <p role="alert">{error}</p>}
      <p>
        Records money already received in {invoice.currency}. This does not
        process a payment.
      </p>
      <Field
        label="Payment Amount"
        value={amount}
        inputMode="decimal"
        onChange={(e) => setAmount(e.target.value)}
      />
      <Field
        label="Payment Date"
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
      />
      <Field
        label="Payment Method"
        value={method}
        onChange={(e) => setMethod(e.target.value)}
      />
      <Field
        label="Reference"
        value={reference}
        onChange={(e) => setReference(e.target.value)}
      />
      <Field
        label="Existing Transaction ID (optional)"
        value={transactionId}
        onChange={(e) => setTransaction(e.target.value)}
      />
      <p className="muted">
        An existing receipt must match the account, currency and date. Linking
        it does not add income again.
      </p>
      <button className="primary-button" disabled={busy}>
        Confirm Payment
      </button>
    </form>
  );
}
function PersistentDocument({ invoice }) {
  const ref = useRef(null);
  return (
    <>
      <button
        className="compact-button"
        onClick={() => printInvoice(ref.current, invoice.number)}
      >
        Print / Save PDF
      </button>
      <div ref={ref}>
        <InvoicePreview
          persistent
          invoice={{
            ...invoice,
            discount: decimal(invoice.discountMinor),
            paid:
              invoice.lifecycle === 'draft'
                ? undefined
                : Number(invoice.paidMinor),
          }}
          client={invoice.client}
          items={invoice.items}
        />
      </div>
    </>
  );
}
function PersistentEditor({
  invoice,
  clients,
  accounts,
  root,
  link,
  refresh,
  preselected,
}) {
  const { setUnsaved } = useWorkspace();
  const navigate = useNavigate(),
    saved = useRef(false),
    [operation] = useState(() => crypto.randomUUID());
  const [initial] = useState(() => {
    const client =
        clients.find((c) => c.id === preselected && !c.archived) ||
        clients.find((c) => !c.archived),
      currency = client?.defaultCurrency || 'AUD';
    return invoice
      ? {
          number: invoice.number,
          clientId: invoice.clientId,
          accountId: invoice.accountId,
          currency: invoice.currency,
          issuedDate: invoice.issuedDate,
          dueDate: invoice.dueDate,
          paymentTerms: invoice.paymentTerms,
          items: invoice.items,
          discount: decimal(invoice.discountMinor),
          notes: invoice.notes,
          paymentInstructions: invoice.paymentInstructions,
        }
      : {
          number: 'INV-' + crypto.randomUUID().slice(0, 8),
          clientId: client?.id || '',
          accountId:
            accounts.find((a) => a.currency === currency && !a.archivedAt)
              ?.id || '',
          currency,
          issuedDate: today(),
          dueDate: today(),
          paymentTerms: client?.paymentTerms || '14',
          items: [
            {
              description: '',
              quantity: '1',
              unit: 'hours',
              unitPrice: '0',
              taxRate: '0',
            },
          ],
          discount: '0',
          notes: '',
          paymentInstructions: '',
        };
  });
  const [form, setForm] = useState(initial),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [preview, setPreview] = useState(false);
  const dirty = JSON.stringify(form) !== JSON.stringify(initial),
    blocker = useBlocker(() => dirty && !saved.current);
  useEffect(() => {
    setUnsaved(dirty);
    const h = (e) => {
      if (dirty && !saved.current) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', h);
    return () => {
      setUnsaved(false);
      window.removeEventListener('beforeunload', h);
    };
  }, [dirty, setUnsaved]);
  const change = (k, v) => setForm({ ...form, [k]: v });
  let totals, calculationError;
  try {
    totals = invoiceTotals(form.items, form.discount);
  } catch (e) {
    calculationError = e.message;
  }
  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const result = await api(
        root + '/invoices' + (invoice ? '/' + invoice.id : ''),
        {
          method: invoice ? 'PATCH' : 'POST',
          body: {
            ...form,
            ...(invoice ? { version: invoice.version } : { id: operation }),
          },
        },
      );
      saved.current = true;
      await refresh();
      navigate(link('/income/invoices/' + result.id));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="income-actions">
        <Link to={link('/income/invoices')}>Back / Cancel</Link>
        <Link to={link('/income/clients')}>Add / Manage Clients</Link>
        <button className="compact-button" onClick={() => setPreview(!preview)}>
          {preview ? 'Edit Form' : 'Preview Invoice'}
        </button>
      </div>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      <form className="invoice-edit-form" onSubmit={save}>
        <fieldset disabled={busy}>
          <legend className="sr-only">Invoice editor</legend>
          <section className="finance-card">
            <h2>Invoice Terms & Schedule</h2>
            <div className="form-grid">
              <Field
                label="Invoice Number"
                value={form.number}
                onChange={(e) => change('number', e.target.value)}
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
                value={form.paymentTerms}
                onChange={(e) => change('paymentTerms', e.target.value)}
              />
              <Field label="Client">
                <select
                  aria-label="Client"
                  value={form.clientId}
                  onChange={(e) => {
                    const c = clients.find((c) => c.id === e.target.value);
                    setForm({
                      ...form,
                      clientId: e.target.value,
                      currency: c.defaultCurrency,
                      paymentTerms: c.paymentTerms,
                      accountId:
                        accounts.find(
                          (a) =>
                            a.currency === c.defaultCurrency && !a.archivedAt,
                        )?.id || '',
                    });
                  }}
                >
                  <option value="">Select a client</option>
                  {clients
                    .filter((c) => !c.archived)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                </select>
              </Field>
              <Field label="Currency">
                <select
                  aria-label="Currency"
                  value={form.currency}
                  onChange={(e) => change('currency', e.target.value)}
                >
                  {['AUD', 'EUR', 'USD'].map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </Field>
              <Field label="Receiving Account">
                <select
                  aria-label="Receiving Account"
                  value={form.accountId}
                  onChange={(e) => change('accountId', e.target.value)}
                >
                  <option value="">Select an account</option>
                  {accounts
                    .filter(
                      (a) => a.currency === form.currency && !a.archivedAt,
                    )
                    .map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                </select>
              </Field>
            </div>
          </section>
          <InvoiceItems
            items={form.items}
            currency={form.currency}
            onChange={(items) => change('items', items)}
          />
          <section className="finance-card">
            <Field
              label="Discount"
              inputMode="decimal"
              value={form.discount}
              onChange={(e) => change('discount', e.target.value)}
            />
            <Field
              label="Notes"
              value={form.notes}
              onChange={(e) => change('notes', e.target.value)}
            />
            <Field
              label="Payment Instructions"
              value={form.paymentInstructions}
              onChange={(e) => change('paymentInstructions', e.target.value)}
            />
            {totals ? (
              <InvoiceTotals totals={totals} currency={form.currency} />
            ) : (
              <p role="alert">{calculationError}</p>
            )}
            <button className="primary-button" disabled={busy || !totals}>
              Save Draft
            </button>
          </section>
        </fieldset>
      </form>
      {preview && (
        <InvoicePreview
          persistent
          invoice={form}
          client={clients.find((c) => c.id === form.clientId)}
          items={form.items}
        />
      )}
      <AppDialog
        open={blocker.state === 'blocked'}
        title="Unsaved invoice"
        onClose={() => blocker.reset?.()}
      >
        <p>Discard unsaved changes?</p>
        <button className="compact-button" onClick={() => blocker.reset()}>
          Keep editing
        </button>
        <button className="compact-button" onClick={() => blocker.proceed()}>
          Discard changes
        </button>
      </AppDialog>
    </>
  );
}
