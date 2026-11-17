import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useWorkspace } from '../finance/WorkspaceContext.js';
import { money } from '../finance/data/calculations.js';
import { billable } from '../finance/data/invoiceMath.js';
import AppDialog from '../../components/ui/AppDialog.jsx';
import {
  IncomePage,
  IncomeKpis,
  Field,
  InvoiceLink,
} from './components/IncomeUI.jsx';
import ClientForm from './components/ClientForm.jsx';
import RecurringTemplateForm from './components/RecurringTemplateForm.jsx';
export default function ClientsPage() {
  const { ledger, filters, canEdit, command } = useWorkspace(),
    [params] = useSearchParams(),
    navigate = useNavigate();
  const [selected, setSelected] = useState(params.get('client')),
    [edit, setEdit] = useState(null),
    [archive, setArchive] = useState(null),
    [template, setTemplate] = useState(null),
    [search, setSearch] = useState(''),
    [type, setType] = useState('all'),
    [status, setStatus] = useState('all'),
    [error, setError] = useState('');
  const data = ledger.data;
  const scoped =
      data?.clients.filter((c) => c.workspaceId === filters.workspaceId) || [],
    clients = scoped.filter(
      (c) =>
        `${c.name} ${c.businessName} ${c.email}`
          .toLowerCase()
          .includes(search.toLowerCase()) &&
        (type === 'all' || c.type === type) &&
        (status === 'all' || (status === 'active' ? !c.archived : c.archived)),
    );
  const client = scoped.find((c) => c.id === selected) || clients[0];
  const invoices =
    data?.invoices.filter(
      (i) =>
        i.workspaceId === filters.workspaceId &&
        i.currency === filters.currency,
    ) || [];
  const billed = invoices.filter(billable),
    sum = (rows) => rows.reduce((n, i) => n + i.total, 0),
    outstanding = (rows) => rows.reduce((n, i) => n + i.total - i.paid, 0);
  return (
    <IncomePage
      title="Clients & Employers"
      subtitle="Manage your recurring clients, billing entities, and payment terms."
      actions={
        <button
          className="compact-button brand-button"
          disabled={!canEdit}
          onClick={() => setEdit({})}
        >
          ＋ Add Client
        </button>
      }
    >
      {data && (
        <>
          <IncomeKpis
            currency={filters.currency}
            values={[
              [
                'Total Clients',
                `${scoped.length} entities`,
                `${scoped.filter((c) => !c.archived).length} active clients`,
              ],
              [
                'Total Invoiced',
                sum(billed),
                `All issue dates · ${filters.currency} only`,
              ],
              [
                'Outstanding Receivables',
                outstanding(billed),
                'Historical invoices retained when clients are archived',
              ],
            ]}
          />
          <div className="client-directory-grid">
            <section className="finance-card">
              <div className="form-grid">
                <Field
                  label="Search Clients"
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <Field label="Client Type Filter">
                  <select
                    aria-label="Client Type Filter"
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                  >
                    <option value="all">All types</option>
                    <option value="business">Business</option>
                    <option value="individual">Individual</option>
                  </select>
                </Field>
                <Field label="Client Status Filter">
                  <select
                    aria-label="Client Status Filter"
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                  >
                    <option value="all">All clients</option>
                    <option value="active">Active</option>
                    <option value="archived">Archived</option>
                  </select>
                </Field>
              </div>
              {!clients.length ? (
                <p>No clients match this selection.</p>
              ) : (
                <table className="income-table client-table">
                  <caption className="sr-only">
                    Client directory totals in {filters.currency}
                  </caption>
                  <thead>
                    <tr>
                      <th>Client / Business</th>
                      <th>Contact</th>
                      <th>Invoiced / Outstanding</th>
                      <th>Latest Invoice</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clients.map((c) => {
                      const rows = billed.filter((i) => i.clientId === c.id),
                        latest = invoices
                          .filter((i) => i.clientId === c.id)
                          .sort((a, b) =>
                            b.issuedDate.localeCompare(a.issuedDate),
                          )[0];
                      return (
                        <tr key={c.id}>
                          <th>
                            <button
                              className="text-button"
                              onClick={() => setSelected(c.id)}
                            >
                              {c.name}
                            </button>
                            <small>{c.businessName}</small>
                            <span className="invoice-status">
                              {c.archived ? 'Archived' : 'Active'}
                            </span>
                            <div className="income-actions">
                              <button
                                className="compact-button"
                                onClick={() => setSelected(c.id)}
                              >
                                View Client
                              </button>
                              {canEdit && !c.archived && (
                                <Link
                                  className="compact-button"
                                  to={`/income/invoices/new?client=${c.id}`}
                                >
                                  Create Invoice
                                </Link>
                              )}
                            </div>
                          </th>
                          <td data-label="Contact">
                            {c.email || 'No email'}
                            <small>{c.type}</small>
                          </td>
                          <td data-label="Invoiced / Outstanding">
                            {money(sum(rows), filters.currency)}
                            <small>
                              Open {money(outstanding(rows), filters.currency)}
                            </small>
                          </td>
                          <td data-label="Latest Invoice">
                            {latest ? (
                              <InvoiceLink invoice={latest} />
                            ) : (
                              'No invoices'
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </section>
            {client && (
              <aside className="client-profile finance-card">
                <h2>{client.name}</h2>
                <span className="invoice-status">
                  {client.archived ? 'Archived' : 'Active'}
                </span>
                <p>{client.businessName}</p>
                <div className="income-actions">
                  <button
                    className="compact-button"
                    disabled={!canEdit}
                    onClick={() => setEdit(client)}
                  >
                    Edit Client
                  </button>
                  <button
                    className="compact-button"
                    disabled={!canEdit || client.archived}
                    onClick={() => setArchive(client)}
                  >
                    Archive Client
                  </button>
                  {canEdit && !client.archived && (
                    <Link
                      className="compact-button brand-button"
                      to={`/income/invoices/new?client=${client.id}`}
                    >
                      Create Invoice for Client
                    </Link>
                  )}
                </div>
                <dl className="client-details">
                  <dt>Email</dt>
                  <dd>{client.email || 'Not supplied'}</dd>
                  <dt>Address</dt>
                  <dd>{client.address || 'Not supplied'}</dd>
                  <dt>Default Currency</dt>
                  <dd>{client.defaultCurrency}</dd>
                  <dt>Payment Terms</dt>
                  <dd>Net {client.paymentTerms} days</dd>
                  <dt>Tax Identifier</dt>
                  <dd>{client.taxId || 'Not supplied'} · not verified</dd>
                </dl>
                <Link
                  className="text-button"
                  to={`/income/invoices?client=${client.id}`}
                >
                  View Client Invoices →
                </Link>
                <hr />
                <h3>Recurring Invoice Templates</h3>
                <button
                  className="compact-button"
                  disabled={!canEdit || client.archived}
                  onClick={() => setTemplate(client)}
                >
                  Create Recurring Invoice Template
                </button>
                {data.recurringRules
                  .filter(
                    (r) =>
                      r.clientId === client.id &&
                      r.workspaceId === filters.workspaceId,
                  )
                  .map((rule) => (
                    <article className="insight" key={rule.id}>
                      <strong>{rule.name}</strong>
                      <p>
                        {rule.frequency} · {rule.currency}
                        <br />
                        Next preparation: {rule.nextDate}
                        <br />
                        Review only · no background sending
                      </p>
                      <button
                        className="compact-button"
                        disabled={
                          !canEdit ||
                          client.archived ||
                          rule.nextDate > data.asOf
                        }
                        onClick={() => {
                          try {
                            const id = command('prepareRecurring', {
                              id: rule.id,
                            });
                            navigate(`/income/invoices/${id}`);
                          } catch (e) {
                            setError(e.message);
                          }
                        }}
                      >
                        Prepare Draft Now
                      </button>
                    </article>
                  ))}
                {error && <p role="alert">{error}</p>}
              </aside>
            )}
          </div>
          <AppDialog
            open={Boolean(edit)}
            title={edit?.id ? 'Edit Client' : 'Add Client'}
            onClose={() => setEdit(null)}
          >
            {edit && (
              <ClientForm
                key={edit.id || 'new'}
                client={edit.id ? edit : undefined}
                onSaved={(id) => {
                  setSelected(id);
                  setEdit(null);
                }}
              />
            )}
          </AppDialog>
          <AppDialog
            open={Boolean(archive)}
            title="Archive client?"
            onClose={() => setArchive(null)}
          >
            <p>
              Archive {archive?.name}? Existing invoices, allocations and
              payment history will remain available.
            </p>
            <button
              className="primary-button"
              onClick={() => {
                command('archiveClient', { id: archive.id });
                setArchive(null);
              }}
            >
              Confirm Archive
            </button>
          </AppDialog>
          <AppDialog
            open={Boolean(template)}
            title="Create Recurring Invoice Template"
            onClose={() => setTemplate(null)}
          >
            {template && (
              <RecurringTemplateForm
                client={template}
                onSaved={() => setTemplate(null)}
              />
            )}
          </AppDialog>
        </>
      )}
    </IncomePage>
  );
}
