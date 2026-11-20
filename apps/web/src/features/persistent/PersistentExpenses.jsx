import { useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  api,
  decimalToMinor,
  formatMinor,
} from '../../services/persistentApi.js';
import { useAuth } from '../auth/hooks/useAuth.js';
import { WorkspaceContext, useWorkspace } from '../finance/WorkspaceContext.js';
import { Field, IncomeKpis } from '../income/components/IncomeUI.jsx';
import TransactionForm from '../expenses/components/TransactionForm.jsx';
import AppDialog from '../../components/ui/AppDialog.jsx';
import '../expenses/expenses.css';
export default function PersistentExpenses({ overview = false }) {
  const [routeParams] = useSearchParams();
  const navigate = useNavigate();
  function closeDialog() {
    setDialog(null);
    if (routeParams.has('add'))
      navigate('/expenses/transactions', { replace: true });
  }
  const user = useAuth(),
    demo = useWorkspace(),
    cache = useQueryClient();
  const [workspaceId, setWorkspace] = useState(
      routeParams.get('workspace') || '',
    ),
    [currency, setCurrency] = useState('AUD'),
    [accountId, setAccount] = useState(''),
    [search, setSearch] = useState(''),
    [start, setStart] = useState(''),
    [end, setEnd] = useState(''),
    [page, setPage] = useState(1),
    [dialog, setDialog] = useState(() =>
      routeParams.has('add') ? { mode: 'new' } : null,
    ),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [operation, setOperation] = useState(() => crypto.randomUUID());
  const workspaces = useQuery({
    queryKey: ['persistent', user.id, 'workspaces'],
    queryFn: () => api('/workspaces'),
    retry: false,
  });
  const selected = workspaceId
    ? workspaces.data?.find((w) => w.id === workspaceId)
    : workspaces.data?.[0];
  const wid = selected?.id,
    root = `/workspaces/${wid}`,
    prefix = ['persistent', user.id, wid];
  const params = new URLSearchParams({
    currency,
    ...(accountId ? { accountId } : {}),
    ...(search ? { search } : {}),
    ...(start ? { start } : {}),
    ...(end ? { end } : {}),
  });
  const query = useQuery({
    queryKey: [...prefix, currency, accountId, search, start, end, page],
    enabled: !!wid,
    queryFn: async ({ signal }) => {
      const [accounts, categories, transactions, summary] = await Promise.all([
        api(root + '/accounts?currency=' + currency, { signal }),
        api(root + '/categories', { signal }),
        api(root + '/transactions?' + params + '&page=' + page + '&limit=10', {
          signal,
        }),
        api(root + '/expenses/summary?' + params, { signal }),
      ]);
      return { accounts, categories, transactions, summary };
    },
    retry: false,
  });
  const details = useQuery({
    queryKey: [...prefix, 'detail', dialog?.id],
    enabled: !!dialog?.id,
    queryFn: () => api(root + '/transactions/' + dialog.id),
    retry: false,
  });
  const canEdit = ['owner', 'editor'].includes(selected?.role),
    data = query.data;
  async function refresh() {
    await cache.invalidateQueries({ queryKey: prefix });
  }
  async function command(_action, { transaction, id }) {
    setBusy(true);
    try {
      const body = {
        date: transaction.date,
        description: transaction.description,
        type: transaction.type,
        amountMinor: decimalToMinor(transaction.amount),
        categoryId: transaction.categoryId || null,
        ...(id
          ? { version: details.data.version }
          : { id: operation, accountId: transaction.accountId, currency }),
      };
      const row = await api(root + '/transactions' + (id ? '/' + id : ''), {
        method: id ? 'PATCH' : 'POST',
        body,
      });
      await refresh();
      return row.id;
    } finally {
      setBusy(false);
    }
  }
  function openNew() {
    setOperation(crypto.randomUUID());
    setDialog({ mode: 'new' });
    setError('');
  }
  const change = (setter, value) => {
    setter(value);
    setPage(1);
    setDialog(null);
    setError('');
  };
  const errorMessage =
    error || workspaces.error?.message || query.error?.message;
  return (
    <main className="workspace-content income-page expenses-page">
      <nav className="income-tabs" aria-label="Expenses navigation">
        <Link to={'/expenses?workspace=' + (wid || '')}>Overview</Link>
        <Link to={'/expenses/transactions?workspace=' + (wid || '')}>
          Transactions
        </Link>
        <Link to={'/expenses/import?workspace=' + (wid || '')}>
          Import Statement
        </Link>
      </nav>
      <div className="page-heading">
        <div>
          <span className="app-badge">PERSISTENT DEVELOPMENT DATA</span>
          <h1>{overview ? 'Expense Overview' : 'Transactions'}</h1>
          <p>
            Ledger and invoices saved in PostgreSQL. Remaining modules use
            separate demonstration data.
          </p>
        </div>
        <button
          className="compact-button brand-button"
          onClick={openNew}
          disabled={!canEdit || !data || query.isError}
        >
          ＋ {overview ? 'Add Expense' : 'Add Transaction'}
        </button>
      </div>
      <section className="finance-card income-filter-panel">
        <div className="form-grid">
          <Field label="Persistent workspace">
            <select
              aria-label="Persistent workspace"
              value={wid || ''}
              onChange={(e) => {
                change(setWorkspace, e.target.value);
                setAccount('');
              }}
            >
              {workspaces.data?.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name} · {w.role}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Currency">
            <select
              aria-label="Currency"
              value={currency}
              onChange={(e) => {
                change(setCurrency, e.target.value);
                setAccount('');
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
              onChange={(e) => change(setAccount, e.target.value)}
            >
              <option value="">All accounts</option>
              {data?.accounts.map((a) => (
                <option value={a.id} key={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </Field>
          <Field
            label="Search transactions"
            value={search}
            onChange={(e) => change(setSearch, e.target.value)}
          />
          <Field
            label="From date"
            type="date"
            value={start}
            onChange={(e) => change(setStart, e.target.value)}
          />
          <Field
            label="To date"
            type="date"
            value={end}
            onChange={(e) => change(setEnd, e.target.value)}
          />
        </div>
      </section>
      {errorMessage && (
        <section className="finance-card" role="alert">
          <p>{errorMessage}</p>
          <button
            onClick={() => {
              setError('');
              void workspaces.refetch();
              void query.refetch();
            }}
          >
            Retry data
          </button>
        </section>
      )}
      {workspaces.isPending || (wid && query.isPending) ? (
        <p role="status">Loading persistent ledger…</p>
      ) : null}
      {workspaces.data?.length === 0 && (
        <p className="finance-card">
          No active workspace membership. Pending invitations do not grant
          access.
        </p>
      )}
      {data && !query.isError && !workspaces.isError && (
        <>
          <IncomeKpis
            currency={currency}
            values={[
              [
                'Total Expenses',
                formatMinor(data.summary.expenseMinor, currency),
                'Non-excluded expenses, by booking date',
              ],
              [
                'Total Income',
                formatMinor(data.summary.incomeMinor, currency),
                'Confirmed ledger receipts; invoices are not added',
              ],
              [
                'Net Cash Flow',
                formatMinor(data.summary.netMinor, currency),
                'Internal transfers are neutral',
              ],
              [
                'Transaction count',
                String(data.transactions.count),
                'Includes excluded rows for review',
              ],
            ]}
          />
          {overview && (
            <section className="finance-card">
              <h2>Financial accounts</h2>
              {data.accounts.length ? (
                data.accounts.map((a) => (
                  <p key={a.id}>
                    {a.name} · Balance {formatMinor(a.balanceMinor, a.currency)}{' '}
                    · Opening {formatMinor(a.openingBalanceMinor, a.currency)}{' '}
                    on {a.openingDate.slice(0, 10)}
                  </p>
                ))
              ) : (
                <p>No account in this currency.</p>
              )}
              <Link to="/expenses/transactions">Manage Transactions</Link>
            </section>
          )}
          <section className="finance-card">
            <h2>{overview ? 'Recent transactions' : 'Transaction list'}</h2>
            {data.transactions.rows.length === 0 ? (
              <p>No transactions match these filters.</p>
            ) : (
              <div className="persistent-rows">
                {data.transactions.rows.map((t) => (
                  <article className="finance-card" key={t.id}>
                    <strong>{t.description}</strong>
                    <p>
                      {t.date} · {t.type} ·{' '}
                      {t.excluded ? 'Excluded' : 'Included'} · {t.source}
                    </p>
                    <strong>{formatMinor(t.amountMinor, t.currency)}</strong>
                    <div>
                      <button
                        className="compact-button"
                        onClick={() => {
                          setDialog({ mode: 'details', id: t.id });
                          setError('');
                        }}
                      >
                        View transaction
                        <span className="sr-only"> {t.description}</span>
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
            <div className="income-actions">
              <button
                className="compact-button"
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </button>
              <span>
                Page {page} of{' '}
                {Math.max(1, Math.ceil(data.transactions.count / 10))}
              </span>
              <button
                className="compact-button"
                disabled={page * 10 >= data.transactions.count}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </button>
            </div>
          </section>
        </>
      )}
      <AppDialog
        open={!!dialog}
        closeDisabled={busy}
        title={
          dialog?.mode === 'new' ? 'Add Transaction' : 'Transaction details'
        }
        onClose={closeDialog}
      >
        {dialog?.id && details.isPending && (
          <p role="status">Loading transaction…</p>
        )}
        {details.error && dialog?.id && (
          <p role="alert">{details.error.message}</p>
        )}
        {error && <p role="alert">{error}</p>}
        {dialog?.mode === 'details' && details.data && !details.isError && (
          <>
            <h3>{details.data.description}</h3>
            <p>
              {formatMinor(details.data.amountMinor, details.data.currency)} ·{' '}
              {details.data.date}
            </p>
            <p>
              {details.data.excluded ? 'Excluded' : 'Included'} ·{' '}
              {details.data.source}
            </p>
            <p>
              Original: {details.data.originalDescription} ·{' '}
              {formatMinor(
                details.data.originalAmountMinor,
                details.data.currency,
              )}{' '}
              · {details.data.originalDate}
            </p>
            {details.data.splits.map((s) => (
              <p key={s.id}>
                Split:{' '}
                {data?.categories.find((c) => c.id === s.categoryId)?.name ||
                  'Category'}{' '}
                · {formatMinor(s.amountMinor, details.data.currency)}
              </p>
            ))}
            <Field label="Transaction category">
              <select
                aria-label="Transaction category"
                value={details.data.categoryId || ''}
                disabled={
                  !canEdit ||
                  busy ||
                  details.data.type === 'transfer' ||
                  details.data.source === 'payment' ||
                  details.data.splits.length > 0
                }
                onChange={async (e) => {
                  setBusy(true);
                  setError('');
                  try {
                    await api(
                      root + '/transactions/' + details.data.id + '/category',
                      {
                        method: 'PATCH',
                        body: {
                          version: details.data.version,
                          categoryId: e.target.value || null,
                        },
                      },
                    );
                    await refresh();
                  } catch (e) {
                    setError(e.message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <option value="">Unclassified</option>
                {data?.categories
                  .filter(
                    (c) =>
                      c.kind === details.data.type &&
                      (!c.archivedAt || c.id === details.data.categoryId),
                  )
                  .map((c) => (
                    <option key={c.id} value={c.id} disabled={!!c.archivedAt}>
                      {c.name}
                    </option>
                  ))}
              </select>
            </Field>
            <div className="income-actions">
              <button
                className="compact-button"
                disabled={
                  !canEdit ||
                  busy ||
                  details.data.source !== 'manual' ||
                  details.data.type === 'transfer' ||
                  details.data.splits.length > 0
                }
                onClick={() => setDialog((d) => ({ ...d, mode: 'edit' }))}
              >
                Edit Transaction
              </button>
              <button
                className="compact-button"
                disabled={!canEdit || busy || details.data.type === 'transfer'}
                onClick={async () => {
                  setBusy(true);
                  setError('');
                  try {
                    await api(
                      root + '/transactions/' + details.data.id + '/exclusion',
                      {
                        method: 'POST',
                        body: {
                          version: details.data.version,
                          excluded: !details.data.excluded,
                        },
                      },
                    );
                    await refresh();
                  } catch (e) {
                    setError(e.message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {details.data.excluded
                  ? 'Restore Transaction'
                  : 'Exclude Transaction'}
              </button>
            </div>
            <p className="scope-note">
              Imported records allow category-only updates. Splits, transfers
              and invoice-linked records retain protected history; corrective
              workflows remain unavailable.
            </p>
          </>
        )}
        {data &&
          ['new', 'edit'].includes(dialog?.mode) &&
          (!dialog.id || details.data) && (
            <WorkspaceContext.Provider
              value={{
                ...demo,
                persistent: true,
                canEdit,
                filters: {
                  workspaceId: wid,
                  currency,
                  accountId: accountId || 'all',
                },
                ledger: {
                  data: {
                    ...data,
                    asOf: new Date().toISOString().slice(0, 10),
                    categories: data.categories,
                    accounts: data.accounts,
                  },
                },
                command,
              }}
            >
              <TransactionForm
                transaction={
                  dialog.id
                    ? {
                        ...details.data,
                        amount: Number(details.data.amountMinor),
                      }
                    : undefined
                }
                onSaved={closeDialog}
              />
            </WorkspaceContext.Provider>
          )}
      </AppDialog>
    </main>
  );
}
