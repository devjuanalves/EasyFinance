import Link from './InvestmentLink.jsx';
import { displayMoney } from './format.js';
import { useEffect, useRef, useState } from 'react';
import { useBlocker, useNavigate, useParams } from 'react-router-dom';
import { useWorkspace } from '../finance/WorkspaceContext.js';
import AppDialog from '../../components/ui/AppDialog.jsx';
import { Field } from '../income/components/IncomeUI.jsx';
import { InvestmentPage } from './InvestmentUI.jsx';
import { AccountDialog } from './InvestmentDialogs.jsx';
import {
  ASSET_TYPES,
  CURRENCIES,
  initialAmounts,
  quantityBased,
  cents,
  positionAt,
} from './investmentMath.js';
import { blankInvestment } from './investmentService.js';
export default function InvestmentEditor() {
  const { id } = useParams(),
    { ledger, filters, canEdit } = useWorkspace();
  const investment = ledger.data?.investments.find(
    (i) => i.id === id && i.workspaceId === filters.workspaceId,
  );
  return (
    <InvestmentPage
      title={id ? 'Edit Investment' : 'Add Investment'}
      subtitle="Organize your holdings with dated, manual valuations."
    >
      {ledger.data &&
        (!canEdit ? (
          <p className="finance-card">
            Editing unavailable for this role or data state.
          </p>
        ) : id && !investment ? (
          <p className="finance-card">
            Investment not found in this workspace.
          </p>
        ) : (
          <Editor
            key={`${filters.workspaceId}-${id || 'new'}`}
            investment={investment}
          />
        ))}
    </InvestmentPage>
  );
}
function Editor({ investment }) {
  const { ledger, filters, command, setUnsaved, persistent } = useWorkspace(),
    data = ledger.data,
    navigate = useNavigate();
  const [initial] = useState(() =>
    investment
      ? { ...blankInvestment(data, filters), ...investment }
      : blankInvestment(data, filters),
  );
  const [form, setForm] = useState(initial),
    [error, setError] = useState(''),
    [addAccount, setAddAccount] = useState(false);
  const saved = useRef(false);
  const dirty = JSON.stringify(form) !== JSON.stringify(initial);
  const blocker = useBlocker(() => dirty && !saved.current);
  useEffect(() => {
    setUnsaved(dirty ? 'investment' : false);
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
  const change = (key, value) => {
    setError('');
    setForm({ ...form, [key]: value });
  };
  const accounts = data.investmentAccounts.filter(
      (a) =>
        a.workspaceId === filters.workspaceId &&
        a.currency === form.currency &&
        !a.archived,
    ),
    account = accounts.find((a) => a.id === form.investmentAccountId);
  let preview, previewError;
  try {
    if (investment) {
      const p = positionAt(data, investment);
      preview = {
        amount: p.basis,
        fee: null,
        costBasis: p.basis,
        value: p.currentValue,
        difference: p.unrealized,
      };
    } else {
      const p = initialAmounts(form),
        value =
          form.estimatedValue.trim() === ''
            ? null
            : cents(form.estimatedValue, 'Estimated value');
      preview = {
        ...p,
        value,
        difference: value === null ? null : value - p.costBasis,
      };
    }
  } catch (e) {
    previewError = e.message;
  }
  async function save(e) {
    e.preventDefault();
    try {
      const id = await command(
        `investment:${investment ? 'update' : 'create'}`,
        {
          id: investment?.id,
          expectedVersion: initial.version,
          form,
        },
      );
      saved.current = true;
      setUnsaved(false);
      navigate(
        `/investments/${id}${persistent ? `?workspace=${filters.workspaceId}` : ''}`,
      );
    } catch (e) {
      setError(e.message);
    }
  }
  return (
    <>
      <form noValidate onSubmit={save}>
        <div className="investment-editor-grid">
          <div>
            <section className="finance-card">
              <h2>Basic Information</h2>
              <div className="form-grid">
                <Field
                  label="Investment name"
                  value={form.name}
                  onChange={(e) => change('name', e.target.value)}
                />
                <Field label="Asset type">
                  <select
                    aria-label="Asset type"
                    disabled={!!investment}
                    value={form.assetType}
                    onChange={(e) => change('assetType', e.target.value)}
                  >
                    {ASSET_TYPES.map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                  </select>
                </Field>
                {form.assetType === 'Custom' && (
                  <Field
                    label="Custom category"
                    value={form.customType}
                    onChange={(e) => change('customType', e.target.value)}
                  />
                )}
                <Field
                  label="Symbol / ticker (optional)"
                  value={form.symbol}
                  onChange={(e) => change('symbol', e.target.value)}
                />
                <Field label="Holding currency">
                  <select
                    aria-label="Holding currency"
                    disabled={!!investment}
                    value={form.currency}
                    onChange={(e) => {
                      const currency = e.target.value;
                      setForm({
                        ...form,
                        currency,
                        investmentAccountId:
                          data.investmentAccounts.find(
                            (a) =>
                              a.workspaceId === filters.workspaceId &&
                              a.currency === currency &&
                              !a.archived,
                          )?.id || '',
                      });
                    }}
                  >
                    {CURRENCIES.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Investment account">
                  <select
                    aria-label="Investment account"
                    value={form.investmentAccountId}
                    onChange={(e) =>
                      change('investmentAccountId', e.target.value)
                    }
                  >
                    <option value="">Select an account</option>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field
                  label="Financial institution"
                  readOnly
                  value={account?.institution || ''}
                />
              </div>
              <button
                type="button"
                className="text-button"
                onClick={() => setAddAccount(true)}
              >
                Add Institution / Account
              </button>
            </section>
            {investment ? (
              <section className="finance-card">
                <h2>Historical Position</h2>
                <p>
                  Editing metadata preserves all movements and valuations. Use
                  Details to record new activity or confirm a historical
                  correction. Currency and asset type are locked.
                </p>
                <Link to={`/investments/${investment.id}`}>
                  View investment history
                </Link>
              </section>
            ) : (
              <>
                <section className="finance-card">
                  <h2>Initial Position & Cost Basis</h2>
                  <div className="form-grid">
                    <Field
                      label={
                        quantityBased(form) ? 'Purchase date' : 'Start date'
                      }
                      type="date"
                      value={form.date}
                      onChange={(e) => change('date', e.target.value)}
                    />
                    {quantityBased(form) ? (
                      <>
                        <Field
                          label="Quantity"
                          inputMode="decimal"
                          value={form.quantity}
                          onChange={(e) => change('quantity', e.target.value)}
                        />
                        <Field
                          label="Unit price"
                          inputMode="decimal"
                          value={form.unitPrice}
                          onChange={(e) => change('unitPrice', e.target.value)}
                        />
                      </>
                    ) : (
                      <Field
                        label="Principal amount"
                        inputMode="decimal"
                        value={form.amount}
                        onChange={(e) => change('amount', e.target.value)}
                      />
                    )}
                    <Field
                      label="Purchase fee"
                      inputMode="decimal"
                      value={form.fee}
                      onChange={(e) => change('fee', e.target.value)}
                    />
                  </div>
                  <p className="muted">
                    Up to 8 decimal places for units/prices; amounts and fees
                    use cents. No cash transaction is created.{' '}
                    {persistent ? 'Accounting dates' : 'Sample dates'} through{' '}
                    {data.asOf}.
                  </p>
                </section>
                <section className="finance-card">
                  <h2>Current Valuation</h2>
                  <p className="partial-banner">
                    Manually recorded value. Leave blank if unknown; zero means
                    a deliberate zero valuation.
                  </p>
                  <div className="form-grid">
                    <Field
                      label="Estimated current value"
                      inputMode="decimal"
                      value={form.estimatedValue}
                      onChange={(e) => change('estimatedValue', e.target.value)}
                    />
                    <Field
                      label="Valuation date"
                      type="date"
                      value={form.valuedAt}
                      onChange={(e) => change('valuedAt', e.target.value)}
                    />
                  </div>
                </section>
              </>
            )}
            <section className="finance-card">
              <h2>Classification & Notes</h2>
              <div className="form-grid">
                <Field
                  label="Custom tags (optional)"
                  value={form.tags}
                  onChange={(e) => change('tags', e.target.value)}
                />
                {form.assetType === 'Fixed Income' && (
                  <Field
                    label="Interest information (notes only)"
                    value={form.interestInfo || ''}
                    onChange={(e) => change('interestInfo', e.target.value)}
                  />
                )}
                <Field label="Investment notes">
                  <textarea
                    value={form.notes}
                    onChange={(e) => change('notes', e.target.value)}
                  />
                </Field>
              </div>
            </section>
          </div>
          <aside className="finance-card investment-summary">
            <span className="app-badge">POSITION SUMMARY</span>
            <h2>{form.name || 'New investment'}</h2>
            <p>
              {form.assetType} · {form.currency}
            </p>
            <dl>
              {[
                ['Initial capital', preview?.amount],
                ['Fees', preview?.fee],
                ['Cost basis', preview?.costBasis],
                ['Estimated current value', preview?.value],
                ['Difference', preview?.difference],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt>
                    {investment && label === 'Initial capital'
                      ? 'Remaining capital'
                      : label}
                  </dt>
                  <dd>{displayMoney(value, form.currency)}</dd>
                </div>
              ))}
            </dl>
            {previewError && <p>{previewError}</p>}
            <p className="muted">
              Weighted-average cost. No tax assessment, forecast or live price.
            </p>
          </aside>
        </div>
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        <div className="finance-card investment-form-actions">
          <Link className="compact-button" to="/investments">
            Back / Cancel
          </Link>
          <button className="compact-button brand-button">
            {investment ? 'Save Changes' : 'Save Investment'}
          </button>
        </div>
      </form>
      {addAccount && (
        <AccountDialog
          currency={form.currency}
          onClose={() => setAddAccount(false)}
          onCreated={(id) => change('investmentAccountId', id)}
        />
      )}
      <AppDialog
        open={blocker.state === 'blocked'}
        title="Unsaved investment changes"
        onClose={() => blocker.reset?.()}
      >
        <p>Your investment form has unsaved changes.</p>
        <div className="income-actions">
          <button className="compact-button" onClick={() => blocker.reset()}>
            Keep Editing
          </button>
          <button
            className="compact-button brand-button"
            onClick={() => blocker.proceed()}
          >
            Discard Changes
          </button>
        </div>
      </AppDialog>
    </>
  );
}
