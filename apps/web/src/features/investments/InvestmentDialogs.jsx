import { displayMoney } from './format.js';
import { useState } from 'react';
import AppDialog from '../../components/ui/AppDialog.jsx';
import { Field } from '../income/components/IncomeUI.jsx';
import { useWorkspace } from '../finance/WorkspaceContext.js';
import { initialAmounts, quantityBased, cents } from './investmentMath.js';
export function InvestmentDialog({ investment, mode, movement, onClose }) {
  return (
    <AppDialog
      open={!!mode}
      title={
        mode === 'valuation'
          ? 'Update Value'
          : movement
            ? 'Correct Investment Activity'
            : `Record ${{ buy: 'Purchase', sell: 'Sale', contribution: 'Contribution', withdrawal: 'Withdrawal', dividend: 'Dividend', interest: 'Interest', fee: 'Fee' }[mode] || 'Activity'}`
      }
      onClose={onClose}
    >
      {mode && (
        <Entry
          key={`${investment.id}-${mode}-${movement?.id || 'new'}`}
          investment={investment}
          mode={mode}
          movement={movement}
          onClose={onClose}
        />
      )}
    </AppDialog>
  );
}
function Entry({ investment, mode, movement, onClose }) {
  const { ledger, command, canEdit } = useWorkspace();
  const [form, setForm] = useState(() =>
    movement
      ? {
          ...movement,
          amount: (movement.amount / 100).toFixed(2),
          fee: (movement.fee / 100).toFixed(2),
        }
      : {
          date: ledger.data.asOf,
          valuedAt: ledger.data.asOf,
          type: mode,
          currency: investment.currency,
          quantity: '',
          unitPrice: '',
          amount: '',
          fee: '0',
          estimatedValue: '',
          notes: '',
        },
  );
  const [error, setError] = useState('');
  const change = (key, value) => setForm({ ...form, [key]: value });
  const isUnits =
    quantityBased(investment) &&
    ['buy', 'sell', 'contribution', 'withdrawal'].includes(mode);
  let preview;
  try {
    preview =
      mode === 'valuation'
        ? cents(form.estimatedValue)
        : isUnits && mode !== 'withdrawal'
          ? initialAmounts({ ...form, assetType: investment.assetType }).amount
          : !isUnits
            ? cents(form.amount)
            : null;
  } catch {
    preview = null;
  }
  function submit(e) {
    e.preventDefault();
    setError('');
    try {
      if (
        movement &&
        !window.confirm(
          'Confirm correction of this historical activity? Later movements will be revalidated.',
        )
      )
        return;
      command(
        `investment:${mode === 'valuation' ? 'valuation' : movement ? 'editMovement' : 'recordMovement'}`,
        {
          id: investment.id,
          movementId: movement?.id,
          form,
          confirmed: !!movement,
        },
      );
      onClose();
    } catch (e) {
      setError(e.message);
    }
  }
  return (
    <form className="investment-dialog" noValidate onSubmit={submit}>
      <p>
        {investment.name} · {investment.currency} · Portfolio-only record. No
        bank transaction will be created.
      </p>
      {movement && (
        <p className="partial-banner">
          Correction preserves an audit snapshot and replays later activity.
          Existing valuations may require review.
        </p>
      )}
      <div className="form-grid">
        <Field
          label={mode === 'valuation' ? 'Valuation date' : 'Movement date'}
          type="date"
          value={mode === 'valuation' ? form.valuedAt : form.date}
          onChange={(e) =>
            change(mode === 'valuation' ? 'valuedAt' : 'date', e.target.value)
          }
        />
        <Field label="Movement currency" value={form.currency} readOnly />
        {mode === 'valuation' ? (
          <Field
            label="Estimated value"
            inputMode="decimal"
            value={form.estimatedValue}
            onChange={(e) => change('estimatedValue', e.target.value)}
          />
        ) : (
          <>
            {isUnits ? (
              <>
                <Field
                  label="Movement quantity"
                  inputMode="decimal"
                  value={form.quantity || ''}
                  onChange={(e) => change('quantity', e.target.value)}
                />
                {mode !== 'withdrawal' && (
                  <Field
                    label="Movement unit price"
                    inputMode="decimal"
                    value={form.unitPrice || ''}
                    onChange={(e) => change('unitPrice', e.target.value)}
                  />
                )}
              </>
            ) : (
              <Field
                label={
                  mode === 'withdrawal'
                    ? 'Withdrawal amount'
                    : 'Movement amount'
                }
                inputMode="decimal"
                value={form.amount}
                onChange={(e) => change('amount', e.target.value)}
              />
            )}
            {mode !== 'fee' && (
              <Field
                label="Movement fee"
                inputMode="decimal"
                value={form.fee}
                onChange={(e) => change('fee', e.target.value)}
              />
            )}
          </>
        )}
        <Field label="Activity notes">
          <textarea
            value={form.notes}
            onChange={(e) => change('notes', e.target.value)}
          />
        </Field>
      </div>
      <p>
        {mode === 'withdrawal' && isUnits
          ? 'In-kind withdrawal: removes proportional cost basis, with no realized profit.'
          : `Amount preview: ${displayMoney(preview, investment.currency)}`}
      </p>
      {mode === 'withdrawal' && !isUnits && (
        <p>Reduces principal at cost; not a profit calculation.</p>
      )}
      {mode === 'valuation' && (
        <p>
          Enter zero only for a deliberate zero valuation. A blank value is not
          zero.
        </p>
      )}
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      <div className="income-actions">
        <button className="compact-button brand-button" disabled={!canEdit}>
          {mode === 'valuation'
            ? 'Save Valuation'
            : movement
              ? 'Confirm Correction'
              : 'Save Movement'}
        </button>
        <button type="button" className="compact-button" onClick={onClose}>
          Cancel
        </button>
      </div>
    </form>
  );
}
export function AccountDialog({ currency, onClose, onCreated }) {
  const { command } = useWorkspace();
  const [form, setForm] = useState({ name: '', institution: '', currency });
  const [error, setError] = useState('');
  return (
    <AppDialog open title="Add Investment Account" onClose={onClose}>
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          try {
            const id = command('investment:createAccount', form);
            onCreated(id);
            onClose();
          } catch (e) {
            setError(e.message);
          }
        }}
      >
        <p>Manual account metadata only. No institution connection.</p>
        <div className="form-grid">
          {[
            ['name', 'Account name'],
            ['institution', 'Financial institution'],
          ].map(([key, label]) => (
            <Field
              key={key}
              label={label}
              value={form[key]}
              onChange={(e) => setForm({ ...form, [key]: e.target.value })}
            />
          ))}
          <Field label="Account currency" value={currency} readOnly />
        </div>
        {error && <p role="alert">{error}</p>}
        <button className="compact-button brand-button">Save Account</button>
      </form>
    </AppDialog>
  );
}
