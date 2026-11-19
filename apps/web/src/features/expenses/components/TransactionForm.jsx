import { useState } from 'react';
import { useWorkspace } from '../../finance/WorkspaceContext.js';
import { Field, CategorySelect } from './ExpenseUI.jsx';
export default function TransactionForm({
  transaction,
  onSaved,
  defaultType = 'expense',
}) {
  const { ledger, filters, command, canEdit, persistent } = useWorkspace(),
    data = ledger.data;
  const [form, setForm] = useState(() =>
    transaction
      ? {
          ...transaction,
          amount: persistent
            ? (() => {
                const n = BigInt(transaction.amountMinor),
                  a = n < 0n ? -n : n;
                return `${n < 0n ? '-' : ''}${a / 100n}.${String(a % 100n).padStart(2, '0')}`;
              })()
            : (transaction.amount / 100).toFixed(2),
        }
      : {
          date: data.asOf,
          description: '',
          amount: '',
          type: defaultType,
          accountId:
            data.accounts.find(
              (a) =>
                a.workspaceId === filters.workspaceId &&
                a.currency === filters.currency &&
                (filters.accountId === 'all' || a.id === filters.accountId),
            )?.id || '',
          currency: filters.currency,
          categoryId: '',
          notes: '',
        },
  );
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const change = (key, value) => {
    setForm((f) => ({
      ...f,
      [key]: value,
      ...(key === 'type' ? { categoryId: '' } : {}),
    }));
    setError('');
  };
  return (
    <form
      className="income-form"
      noValidate
      onSubmit={async (e) => {
        e.preventDefault();
        if (saving) return;
        setSaving(true);
        try {
          const id = await command('expense:saveTransaction', {
            id: transaction?.id,
            transaction: form,
          });
          onSaved(id);
        } catch (e) {
          setError(e.message);
        } finally {
          setSaving(false);
        }
      }}
    >
      <div className="form-grid">
        <Field
          label="Transaction date"
          type="date"
          value={form.date}
          onChange={(e) => change('date', e.target.value)}
        />
        <Field
          label="Signed amount"
          inputMode="decimal"
          value={form.amount}
          onChange={(e) => change('amount', e.target.value)}
        />
        <Field
          label="Description"
          value={form.description}
          onChange={(e) => change('description', e.target.value)}
        />
        <Field label="Transaction type">
          <select
            aria-label="Transaction type"
            value={form.type}
            onChange={(e) => change('type', e.target.value)}
          >
            {(persistent
              ? ['expense', 'income']
              : ['expense', 'income', 'transfer']
            ).map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </Field>
        <Field label="Transaction account">
          <select
            aria-label="Transaction account"
            disabled={persistent && Boolean(transaction)}
            value={form.accountId}
            onChange={(e) => change('accountId', e.target.value)}
          >
            {data.accounts
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
        </Field>
        {form.type !== 'transfer' && (
          <CategorySelect
            label="Transaction category"
            type={form.type}
            value={form.categoryId}
            onChange={(v) => change('categoryId', v)}
          />
        )}
      </div>
      <p className="scope-note">
        {filters.currency} only. Enter negative expenses and positive income.
        {persistent
          ? 'Saved to the development database. Account and currency are fixed after creation.'
          : 'Dates use sample coverage 1 August–31 October 2026. Transfers retain their signed balance effect.'}
      </p>
      {!persistent && (
        <Field label="Transaction notes">
          <textarea
            aria-label="Transaction notes"
            value={form.notes || ''}
            onChange={(e) => change('notes', e.target.value)}
          />
        </Field>
      )}
      {transaction && (
        <p className="scope-note">
          Original bank data and invoice allocations are preserved. Financial
          changes to allocated receipts or linked transfers require a corrective
          workflow.
        </p>
      )}
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      <button className="primary-button" disabled={!canEdit || saving}>
        Save Transaction
      </button>
    </form>
  );
}
