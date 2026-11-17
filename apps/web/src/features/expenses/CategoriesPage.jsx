import AppIcon from '../../components/ui/AppIcon.jsx';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useWorkspace } from '../finance/WorkspaceContext.js';
import FinancialFilters from '../finance/components/FinancialFilters.jsx';
import AppDialog from '../../components/ui/AppDialog.jsx';
import { ExpensePage, Field, CategorySelect } from './components/ExpenseUI.jsx';
import {
  expenseSummary,
  transactionRows,
  rulePreview,
  matchRules,
} from './expenseService.js';
import { money } from '../finance/data/calculations.js';
export default function CategoriesPage() {
  const { ledger, filters } = useWorkspace();
  return (
    <ExpensePage
      title="Categories & Classification Rules"
      subtitle="Organize your categories. Preview deterministic suggestions before applying them."
    >
      {ledger.data && (
        <Categories
          key={`${filters.workspaceId}-${filters.currency}`}
          data={ledger.data}
        />
      )}
    </ExpensePage>
  );
}
function Categories({ data }) {
  const { filters, command, canEdit } = useWorkspace(),
    [search, setSearch] = useState(''),
    [editor, setEditor] = useState(null),
    [previewId, setPreviewId] = useState(null),
    [selected, setSelected] = useState([]),
    [error, setError] = useState(''),
    [raw, setRaw] = useState('Woolworths Metro'),
    [simulation, setSimulation] = useState(null);
  const s = expenseSummary(data, filters),
    rows = transactionRows(data, filters),
    categories = data.categories.filter(
      (c) =>
        c.workspaceId === filters.workspaceId &&
        c.kind !== 'transfer' &&
        c.id !== 'uncategorized' &&
        c.name.toLowerCase().includes(search.toLowerCase()),
    ),
    rules = data.categoryRules
      .filter((r) => r.workspaceId === filters.workspaceId)
      .sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id)),
    preview = previewId ? rulePreview(data, filters, previewId) : [];
  const run = (action, payload) => {
    try {
      command('expense:' + action, payload);
      setError('');
    } catch (e) {
      setError(e.message);
    }
  };
  return (
    <>
      <div className="income-actions">
        <button
          className="compact-button"
          disabled={!canEdit}
          onClick={() => setEditor({ kind: 'category' })}
        >
          Add Category
        </button>
        <button
          className="compact-button brand-button"
          disabled={!canEdit}
          onClick={() => setEditor({ kind: 'rule' })}
        >
          Create Rule
        </button>
      </div>
      <div className="finance-card income-filter-panel">
        <FinancialFilters />
        <Field
          label="Search Categories"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      <p className="scope-note">
        {categories.filter((c) => !c.archived).length} active categories ·{' '}
        {money(s.total, filters.currency)} total spending in the selected
        period. Archived categories retain history.
      </p>
      <div className="category-grid">
        {categories.map((c) => {
          const amount = s.categories.find((x) => x.id === c.id)?.amount || 0,
            count = rows.filter(
              (t) =>
                !t.excluded &&
                (t.categoryId === c.id ||
                  data.transactionSplits.some(
                    (s) => s.transactionId === t.id && s.categoryId === c.id,
                  )),
            ).length;
          return (
            <article className="finance-card category-card" key={c.id}>
              <div className="section-heading">
                <span
                  className="category-symbol"
                  style={{ color: c.color }}
                  aria-label={`${c.icon} icon`}
                >
                  <AppIcon name={c.icon} width="24" height="24" />
                </span>
                <h2>{c.name}</h2>
              </div>
              <p>
                {c.kind} · {c.archived ? 'Archived' : 'Active'} · {count}{' '}
                transactions
              </p>
              <strong>{money(amount, filters.currency)}</strong>
              <progress max={s.total || 1} value={amount} />
              <div className="income-actions">
                <button
                  className="text-button"
                  disabled={!canEdit}
                  onClick={() => setEditor({ kind: 'category', record: c })}
                >
                  Edit {c.name}
                </button>
                <button
                  className="text-button"
                  disabled={!canEdit || c.archived}
                  onClick={() => {
                    if (
                      window.confirm(
                        `Archive ${c.name}? Historical transactions remain unchanged.`,
                      )
                    )
                      run('archiveCategory', { id: c.id });
                  }}
                >
                  Archive {c.name}
                </button>
                <Link
                  className="text-button"
                  to={`/expenses/transactions?category=${c.id}`}
                >
                  View Transactions
                </Link>
              </div>
            </article>
          );
        })}
      </div>
      {!categories.length && (
        <p className="empty-ledger">
          No categories match this workspace or search.
        </p>
      )}
      <div className="charts-grid">
        <section className="finance-card">
          <h2>Classification Rules</h2>
          <p className="muted">
            Lowest priority number first, then stable rule ID. Saving does not
            apply changes. Manual and reviewed classifications are protected.
          </p>
          {!rules.length && <p>No rules in this workspace.</p>}
          {rules.map((r) => (
            <article className="rule-card" key={r.id}>
              <h3>
                #{r.priority} · {r.name}
              </h3>
              <p>
                {r.field} {r.operator} “{r.value}” →{' '}
                {data.categories.find((c) => c.id === r.categoryId)?.name}
              </p>
              <p>{r.enabled ? 'Enabled' : 'Disabled'}</p>
              <div className="income-actions">
                <button
                  className="compact-button"
                  disabled={!canEdit}
                  onClick={() => setEditor({ kind: 'rule', record: r })}
                >
                  Edit Rule · {r.name}
                </button>
                <button
                  className="compact-button"
                  disabled={!canEdit}
                  onClick={() => run('toggleRule', { id: r.id })}
                >
                  {r.enabled ? 'Disable' : 'Enable'} Rule · {r.name}
                </button>
                <button
                  className="text-button"
                  disabled={!canEdit}
                  onClick={() => {
                    if (
                      window.confirm(
                        `Delete rule ${r.name}? Transaction history is retained.`,
                      )
                    )
                      run('deleteRule', { id: r.id });
                  }}
                >
                  Delete Rule · {r.name}
                </button>
                <button
                  className="compact-button"
                  onClick={() => {
                    setPreviewId(r.id);
                    setSelected([]);
                  }}
                >
                  Preview Matches · {r.name}
                </button>
              </div>
            </article>
          ))}
        </section>
        <section className="finance-card">
          <h2>Rule Test Simulator</h2>
          <p>Tests an expense description only. No transaction changes.</p>
          <Field
            label="Test description"
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
          />
          <button
            className="compact-button brand-button"
            onClick={() =>
              setSimulation(
                matchRules(data, {
                  description: raw,
                  workspaceId: filters.workspaceId,
                  type: 'expense',
                }),
              )
            }
          >
            Test Rules
          </button>
          {simulation && (
            <p role="status">
              {simulation.length
                ? `Selected rule: ${simulation[0].name}. ${simulation.length} matching rule(s).`
                : 'No matching rule.'}
            </p>
          )}
          <Link
            className="text-button"
            to="/expenses/transactions?status=pending"
          >
            Review pending transactions →
          </Link>
        </section>
      </div>
      <AppDialog
        open={Boolean(editor)}
        title={editor?.kind === 'category' ? 'Category Editor' : 'Rule Editor'}
        onClose={() => setEditor(null)}
      >
        {editor && (
          <TaxonomyForm
            key={`${editor.kind}-${editor.record?.id || 'new'}`}
            editor={editor}
            onSaved={() => setEditor(null)}
          />
        )}
      </AppDialog>
      <AppDialog
        open={Boolean(previewId)}
        title="Rule Match Preview"
        onClose={() => setPreviewId(null)}
      >
        <p>
          {preview.length} matching transactions in this workspace/currency,
          across all dates. Only unreviewed, non-manual, unsplit records are
          eligible.
        </p>
        {preview.map((p) => (
          <div className="rule-card" key={p.transaction.id}>
            <label>
              <input
                type="checkbox"
                aria-label={`Apply suggestion to ${p.transaction.description}`}
                disabled={
                  !p.eligible || p.proposed.id !== previewId || !canEdit
                }
                checked={selected.includes(p.transaction.id)}
                onChange={(e) =>
                  setSelected((s) =>
                    e.target.checked
                      ? [...s, p.transaction.id]
                      : s.filter((id) => id !== p.transaction.id),
                  )
                }
              />
              {p.transaction.description}
            </label>
            <p>
              Existing:{' '}
              {data.categories.find((c) => c.id === p.transaction.categoryId)
                ?.name || 'Uncategorized'}{' '}
              → Proposed:{' '}
              {
                data.categories.find((c) => c.id === p.proposed.categoryId)
                  ?.name
              }
            </p>
            <p>
              {p.conflict
                ? 'Conflict · multiple categories match; explicit priority selects the proposal.'
                : 'Deterministic match.'}{' '}
              {!p.eligible ? 'Protected manual/reviewed/split record.' : ''}
            </p>
          </div>
        ))}
        {!preview.length && (
          <p>
            No matches. Disabled rules and archived categories cannot suggest
            changes.
          </p>
        )}
        <button
          className="primary-button"
          disabled={!canEdit || !selected.length}
          onClick={() => {
            try {
              command('expense:applyRule', { id: previewId, ids: selected });
              setPreviewId(null);
              setSelected([]);
            } catch (e) {
              setError(e.message);
              setPreviewId(null);
            }
          }}
        >
          Confirm Suggested Changes
        </button>
      </AppDialog>
    </>
  );
}
function TaxonomyForm({ editor, onSaved }) {
  const { command, canEdit } = useWorkspace(),
    isCategory = editor.kind === 'category';
  const [form, setForm] = useState(
      editor.record ||
        (isCategory
          ? { name: '', kind: 'expense', icon: 'expenses', color: '#E43900' }
          : {
              name: '',
              field: 'description',
              operator: 'contains',
              value: '',
              categoryId: '',
              priority: 10,
              enabled: true,
            }),
    ),
    [error, setError] = useState('');
  const change = (key, value) => setForm((f) => ({ ...f, [key]: value }));
  return (
    <form
      className="income-form"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        try {
          command(isCategory ? 'expense:saveCategory' : 'expense:saveRule', {
            id: editor.record?.id,
            [isCategory ? 'category' : 'rule']: form,
          });
          onSaved();
        } catch (e) {
          setError(e.message);
        }
      }}
    >
      <Field
        label={isCategory ? 'Category name' : 'Rule name'}
        value={form.name}
        onChange={(e) => change('name', e.target.value)}
      />
      {isCategory ? (
        <>
          <Field label="Category kind">
            <select
              aria-label="Category kind"
              value={form.kind}
              disabled={Boolean(editor.record)}
              onChange={(e) => change('kind', e.target.value)}
            >
              <option>expense</option>
              <option>income</option>
            </select>
          </Field>
          <Field label="Category icon">
            <select
              aria-label="Category icon"
              value={form.icon}
              onChange={(e) => change('icon', e.target.value)}
            >
              {['home', 'expenses', 'income', 'attach', 'settings', 'chat'].map(
                (v) => (
                  <option key={v}>{v}</option>
                ),
              )}
            </select>
          </Field>
          <Field
            label="Category color"
            type="color"
            value={form.color}
            onChange={(e) => change('color', e.target.value)}
          />
        </>
      ) : (
        <>
          <Field label="Matching field">
            <select
              aria-label="Matching field"
              value={form.field}
              onChange={(e) => change('field', e.target.value)}
            >
              {['description', 'merchant', 'reference'].map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </Field>
          <Field label="Operator">
            <select
              aria-label="Operator"
              value={form.operator}
              onChange={(e) => change('operator', e.target.value)}
            >
              {['contains', 'equals', 'startsWith'].map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </Field>
          <Field
            label="Matching value"
            value={form.value}
            onChange={(e) => change('value', e.target.value)}
          />
          <CategorySelect
            type={null}
            label="Assigned category"
            value={form.categoryId}
            onChange={(v) => change('categoryId', v)}
          />
          <Field
            label="Priority"
            type="number"
            min="0"
            max="9999"
            value={form.priority}
            onChange={(e) => change('priority', e.target.value)}
          />
          <label>
            <input
              type="checkbox"
              checked={form.enabled}
              onChange={(e) => change('enabled', e.target.checked)}
            />{' '}
            Enabled
          </label>
        </>
      )}
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      <button className="primary-button" disabled={!canEdit}>
        {isCategory ? 'Save Category' : 'Save Rule'}
      </button>
    </form>
  );
}
