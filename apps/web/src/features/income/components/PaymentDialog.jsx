import { useState } from 'react';
import { useWorkspace } from '../../finance/WorkspaceContext.js';
import { eligibleTransactions } from '../incomeService.js';
import { money, dateLabel } from '../../finance/data/calculations.js';
import { Field } from './IncomeUI.jsx';
export default function PaymentDialog({ invoice, onSaved }) {
  const { ledger, command, canEdit } = useWorkspace();
  const data = ledger.data;
  const [form, setForm] = useState({
    amount: ((invoice.total - invoice.paid) / 100).toFixed(2),
    date: data.asOf,
    method: 'bank',
    reference: '',
    transactionId: '',
  });
  const [error, setError] = useState('');
  const transactions = eligibleTransactions(data, invoice);
  const change = (name, value) => setForm({ ...form, [name]: value });
  return (
    <form
      className="income-form"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        try {
          command('recordPayment', { id: invoice.id, ...form });
          onSaved();
        } catch (e) {
          setError(e.message);
        }
      }}
    >
      <p>
        {money(invoice.total - invoice.paid, invoice.currency)} outstanding. A
        new payment adds one confirmed income movement. An existing transaction
        link only allocates existing money.
      </p>
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
      <Field
        label={`Payment Amount (${invoice.currency})`}
        inputMode="decimal"
        value={form.amount}
        onChange={(e) => change('amount', e.target.value)}
      />
      <Field label="Existing Transaction Link">
        <select
          aria-label="Existing Transaction Link"
          value={form.transactionId}
          onChange={(e) => change('transactionId', e.target.value)}
        >
          <option value="">New confirmed payment</option>
          {transactions.map((t) => (
            <option value={t.id} key={t.id}>
              {t.description} · {dateLabel(t.date)} ·{' '}
              {money(t.amount, t.currency)}
            </option>
          ))}
        </select>
      </Field>
      {form.transactionId ? (
        <p className="partial-banner">
          The existing receipt date, account, currency and method will be
          retained. Review its reference carefully; older payments may represent
          advances.
        </p>
      ) : (
        <>
          <Field
            label="Payment Date"
            type="date"
            value={form.date}
            onChange={(e) => change('date', e.target.value)}
          />
          <Field label="Payment Method">
            <select
              aria-label="Payment Method"
              value={form.method}
              onChange={(e) => change('method', e.target.value)}
            >
              {['bank', 'cash', 'card', 'other'].map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          </Field>
          <Field
            label="Payment Reference"
            value={form.reference}
            onChange={(e) => change('reference', e.target.value)}
          />
        </>
      )}
      <button className="primary-button" disabled={!canEdit}>
        Confirm Payment
      </button>
    </form>
  );
}
