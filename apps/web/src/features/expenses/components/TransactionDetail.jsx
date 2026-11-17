import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useWorkspace } from '../../finance/WorkspaceContext.js';
import { money, dateLabel } from '../../finance/data/calculations.js';
import { duplicateCandidates } from '../expenseService.js';
import { Field, CategorySelect } from './ExpenseUI.jsx';
import TransactionForm from './TransactionForm.jsx';
export default function TransactionDetail({ transaction: t, onSelect }) {
  const { ledger, command, canEdit } = useWorkspace(),
    data = ledger.data;
  const [mode, setMode] = useState('details'),
    [error, setError] = useState(''),
    [other, setOther] = useState('');
  const [parts, setParts] = useState(() => {
    const p = data.transactionSplits.filter((s) => s.transactionId === t.id);
    return p.length
      ? p.map((s) => ({ ...s, amount: (s.amount / 100).toFixed(2) }))
      : [
          { categoryId: '', amount: '' },
          { categoryId: '', amount: '' },
        ];
  });
  const run = (action, payload) => {
    try {
      command('expense:' + action, payload);
      setError('');
      setMode('details');
    } catch (e) {
      setError(e.message);
    }
  };
  const candidates = duplicateCandidates(data, t),
    payment = data.payments.find((p) => p.transactionId === t.id),
    links = data.allocations.filter((a) => a.paymentId === payment?.id),
    pair = data.transactionTransfers.find(
      (x) => x.outgoingId === t.id || x.incomingId === t.id,
    );
  return (
    <div className="transaction-detail">
      <strong className="detail-amount">{money(t.amount, t.currency)}</strong>
      <p>
        {dateLabel(t.date)} · {t.type} ·{' '}
        {t.excluded ? 'Excluded' : t.reviewStatus || 'reviewed'}
      </p>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      <dl className="client-facts">
        <dt>Original description</dt>
        <dd>{t.originalDescription || t.description}</dd>
        <dt>Original amount</dt>
        <dd>{money(t.originalAmount ?? t.amount, t.currency)}</dd>
        <dt>Currency / Account</dt>
        <dd>
          {t.currency} · {data.accounts.find((a) => a.id === t.accountId)?.name}
        </dd>
        <dt>Original source</dt>
        <dd>{t.originalSource || t.source || 'Manual invoice receipt'}</dd>
        <dt>Import batch</dt>
        <dd>{t.importBatchId || 'Not imported'}</dd>
        <dt>Notes</dt>
        <dd>{t.notes || 'No notes'}</dd>
      </dl>
      {links.map((a) => (
        <p key={a.id}>
          <Link className="text-button" to={`/income/invoices/${a.invoiceId}`}>
            View Linked Invoice ·{' '}
            {data.invoices.find((i) => i.id === a.invoiceId)?.number}
          </Link>{' '}
          · {money(a.amount, t.currency)} allocated
        </p>
      ))}
      <div className="income-actions">
        <button
          className="compact-button"
          disabled={!canEdit}
          onClick={() => setMode(mode === 'edit' ? 'details' : 'edit')}
        >
          Edit Transaction
        </button>
        <button
          className="compact-button"
          disabled={!canEdit || t.type !== 'expense' || t.excluded}
          onClick={() => setMode('split')}
        >
          Split Transaction
        </button>
        <button
          className="compact-button"
          disabled={!canEdit}
          onClick={() => setMode('transfer')}
        >
          Mark Internal Transfer
        </button>
        <button
          className="compact-button"
          disabled={!canEdit}
          onClick={() => setMode('duplicate')}
        >
          Review Duplicate
        </button>
        <button
          className="compact-button"
          disabled={!canEdit}
          onClick={() => {
            if (
              t.excluded ||
              window.confirm(
                'Exclude this transaction from financial totals? History will be preserved.',
              )
            )
              run(t.excluded ? 'restore' : 'exclude', { ids: [t.id] });
          }}
        >
          {t.excluded ? 'Restore Excluded Transaction' : 'Exclude Transaction'}
        </button>
      </div>
      {mode === 'edit' && (
        <TransactionForm
          key={t.id}
          transaction={t}
          onSaved={() => setMode('details')}
        />
      )}
      {mode === 'split' && (
        <section className="finance-card">
          <h3>Split allocations</h3>
          <p>
            Positive allocations must total {money(-t.amount, t.currency)}. The
            original expense stays in the ledger once.
          </p>
          {parts.map((s, i) => (
            <fieldset className="split-row" key={i}>
              <legend>Split {i + 1}</legend>
              <CategorySelect
                label={`Split category ${i + 1}`}
                value={s.categoryId}
                onChange={(v) =>
                  setParts((p) =>
                    p.map((x, j) => (j === i ? { ...x, categoryId: v } : x)),
                  )
                }
              />
              <Field
                label={`Split amount ${i + 1}`}
                value={s.amount}
                onChange={(e) =>
                  setParts((p) =>
                    p.map((x, j) =>
                      j === i ? { ...x, amount: e.target.value } : x,
                    ),
                  )
                }
              />
              <button
                className="text-button"
                onClick={() => setParts((p) => p.filter((_, j) => j !== i))}
              >
                Remove Split {i + 1}
              </button>
            </fieldset>
          ))}
          <div className="income-actions">
            <button
              className="compact-button"
              onClick={() =>
                setParts((p) => [...p, { categoryId: '', amount: '' }])
              }
            >
              Add Split
            </button>
            <button
              className="compact-button brand-button"
              disabled={!canEdit}
              onClick={() => run('split', { id: t.id, parts })}
            >
              Confirm Splits
            </button>
            <button
              className="compact-button"
              disabled={!canEdit}
              onClick={() => run('split', { id: t.id, parts: [] })}
            >
              Remove All Splits
            </button>
          </div>
        </section>
      )}
      {mode === 'transfer' && (
        <section className="finance-card">
          <h3>Review internal transfer</h3>
          <p>
            Transfers retain account-balance effects but are excluded from
            income and expenses. No opposite entry is created.
          </p>
          {pair ? (
            <button
              className="compact-button"
              disabled={!canEdit}
              onClick={() => run('unlinkTransfer', { id: t.id })}
            >
              Unlink Transfer Pair
            </button>
          ) : (
            <>
              <button
                className="compact-button"
                disabled={!canEdit}
                onClick={() =>
                  run('saveTransaction', {
                    id: t.id,
                    transaction: { ...t, type: 'transfer', categoryId: null },
                  })
                }
              >
                Confirm Single Transfer
              </button>
              <Field label="Matching account entry">
                <select
                  aria-label="Matching account entry"
                  value={other}
                  onChange={(e) => setOther(e.target.value)}
                >
                  <option value="">Select opposite entry</option>
                  {data.transactions
                    .filter(
                      (x) =>
                        x.workspaceId === t.workspaceId &&
                        x.currency === t.currency &&
                        x.accountId !== t.accountId &&
                        x.amount === -t.amount &&
                        !x.excluded,
                    )
                    .map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.description} · {dateLabel(x.date)}
                      </option>
                    ))}
                </select>
              </Field>
              <button
                className="compact-button brand-button"
                disabled={!canEdit || !other}
                onClick={() =>
                  run('linkTransfer', { id: t.id, otherId: other })
                }
              >
                Confirm Transfer Pair
              </button>
            </>
          )}
        </section>
      )}
      {mode === 'duplicate' && (
        <section className="finance-card">
          <h3>Duplicate review</h3>
          <p>
            Matches compare workspace, account, currency, original description,
            date and signed amount, or a shared source reference. Similarity is
            not proof of duplication.
          </p>
          {candidates.length ? (
            candidates.map((c) => (
              <div className="source-row" key={c.id}>
                <button className="text-button" onClick={() => onSelect(c.id)}>
                  View candidate: {c.description} ·{' '}
                  {money(c.amount, c.currency)}
                </button>
                <button
                  className="compact-button"
                  disabled={!canEdit || c.excluded}
                  onClick={() => {
                    if (
                      window.confirm(
                        'Keep this original and exclude the selected transaction?',
                      )
                    )
                      run('duplicateDecision', {
                        id: t.id,
                        decision: 'original',
                        originalId: c.id,
                      });
                  }}
                >
                  Keep Original · {c.id}
                </button>
              </div>
            ))
          ) : (
            <p>
              No exact candidate found. The sample review flag may require
              manual investigation.
            </p>
          )}
          <div className="income-actions">
            <button
              className="compact-button"
              disabled={!canEdit}
              onClick={() =>
                run('duplicateDecision', { id: t.id, decision: 'both' })
              }
            >
              Keep Both / Keep Selected
            </button>
            <button
              className="compact-button"
              disabled={!canEdit}
              onClick={() => {
                if (
                  window.confirm('Exclude selected transaction as a duplicate?')
                )
                  run('duplicateDecision', { id: t.id, decision: 'exclude' });
              }}
            >
              Exclude Selected Duplicate
            </button>
            <button
              className="compact-button"
              onClick={() => setMode('details')}
            >
              Cancel Review
            </button>
          </div>
        </section>
      )}
      <section className="finance-card">
        <h3>Audit history</h3>
        {data.transactionEvents
          .filter((e) => e.transactionId === t.id)
          .map((e) => (
            <p key={e.id}>
              {dateLabel(e.date)} · {e.text}
            </p>
          ))}
        {!data.transactionEvents.some((e) => e.transactionId === t.id) && (
          <p>Original sample record; no session edits.</p>
        )}
      </section>
    </div>
  );
}
