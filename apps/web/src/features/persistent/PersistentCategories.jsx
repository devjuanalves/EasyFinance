import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/persistentApi.js';
import { Field } from '../income/components/IncomeUI.jsx';
import AppDialog from '../../components/ui/AppDialog.jsx';
import AppIcon from '../../components/ui/AppIcon.jsx';
import { usePersistentWorkspace } from './usePersistentWorkspace.js';
import '../expenses/expenses.css';
export default function PersistentCategories() {
  const { wid, selected, workspaces, setWorkspace, prefix } =
      usePersistentWorkspace(),
    cache = useQueryClient();
  const [search, setSearch] = useState(''),
    [editor, setEditor] = useState(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const root = `/workspaces/${wid}/categories`,
    canEdit = ['owner', 'editor'].includes(selected?.role);
  const query = useQuery({
    queryKey: [...prefix, 'categories'],
    enabled: !!wid,
    queryFn: ({ signal }) => api(root, { signal }),
    retry: false,
  });
  async function save(body, record) {
    setBusy(true);
    setError('');
    try {
      await api(root + (record ? '/' + record.id : ''), {
        method: record ? 'PATCH' : 'POST',
        body,
      });
      await cache.invalidateQueries({ queryKey: prefix });
      setEditor(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function archive(c) {
    if (
      !window.confirm(
        `Archive ${c.name}? Historical references remain unchanged.`,
      )
    )
      return;
    setBusy(true);
    setError('');
    try {
      await api(root + '/' + c.id + '/archive', {
        method: 'POST',
        body: { updatedAt: c.updatedAt },
      });
      await cache.invalidateQueries({ queryKey: prefix });
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  const rows =
    query.data?.filter((c) =>
      c.name.toLowerCase().includes(search.toLowerCase()),
    ) || [];
  return (
    <main className="workspace-content income-page expenses-page">
      <div className="page-heading">
        <div>
          <span className="app-badge">PERSISTENT CATEGORIES</span>
          <h1>Categories & Classification Rules</h1>
          <p>
            Organize categories without changing historical financial amounts.
          </p>
        </div>
        <button
          className="compact-button brand-button"
          disabled={!canEdit || busy}
          onClick={() => {
            setError('');
            setEditor({ id: crypto.randomUUID() });
          }}
        >
          Add Category
        </button>
      </div>
      <section className="finance-card income-filter-panel">
        <div className="form-grid">
          <Field label="Persistent workspace">
            <select
              aria-label="Persistent workspace"
              value={wid || ''}
              onChange={(e) => {
                setWorkspace(e.target.value);
                setEditor(null);
                setError('');
              }}
            >
              {workspaces.data?.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name} · {w.role}
                </option>
              ))}
            </select>
          </Field>
          <Field
            label="Search Categories"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </section>
      {((query.isPending && wid) || workspaces.isPending) && (
        <p role="status">Loading categories…</p>
      )}
      {(error || query.error || workspaces.error) && (
        <p role="alert" className="form-error">
          {error || query.error?.message || workspaces.error?.message}
        </p>
      )}
      {query.isError && (
        <button className="compact-button" onClick={() => query.refetch()}>
          Retry
        </button>
      )}
      {!workspaces.isPending && !selected && (
        <p>Select an authorized workspace.</p>
      )}
      <div className="category-grid">
        {!query.isError &&
          rows.map((c) => (
            <article className="finance-card category-card" key={c.id}>
              <div className="section-heading">
                <span
                  className="category-symbol"
                  style={{ color: c.color || '#E43900' }}
                >
                  <AppIcon name={c.icon || 'expenses'} width="24" height="24" />
                </span>
                <h2>{c.name}</h2>
              </div>
              <p>
                {c.kind} · {c.archivedAt ? 'Archived' : 'Active'}
              </p>
              <div className="income-actions">
                <button
                  className="text-button"
                  disabled={!canEdit || !!c.archivedAt || busy}
                  onClick={() => {
                    setError('');
                    setEditor({ record: c });
                  }}
                >
                  Edit {c.name}
                </button>
                <button
                  className="text-button"
                  disabled={!canEdit || !!c.archivedAt || busy}
                  onClick={() => archive(c)}
                >
                  Archive {c.name}
                </button>
                <Link to={`/dashboard?workspace=${wid}&category=${c.id}`}>
                  View Financial Summary
                </Link>
                <Link to={`/expenses/transactions?workspace=${wid}`}>
                  Assign to Transactions
                </Link>
              </div>
            </article>
          ))}
      </div>
      {query.isSuccess && !rows.length && (
        <p className="empty-ledger">
          No categories match this workspace or search.
        </p>
      )}
      <div className="charts-grid">
        <section className="finance-card">
          <h2>Classification Rules</h2>
          <p>
            Rule persistence and execution are unavailable. Manual transaction
            categorization is supported; archived categories retain historical
            references and cannot receive new assignments.
          </p>
          <button className="compact-button" disabled>
            Create Rule
          </button>
        </section>
        <section className="finance-card">
          <h2>Rule Test Simulator</h2>
          <p>No rule simulation runs in API mode.</p>
          <button className="compact-button" disabled>
            Test Rules
          </button>
        </section>
      </div>
      <AppDialog
        open={!!editor}
        title="Category Editor"
        onClose={() => {
          if (!busy) setEditor(null);
        }}
      >
        {editor && (
          <CategoryForm
            key={editor.record?.id || editor.id}
            editor={editor}
            busy={busy}
            save={save}
            error={error}
          />
        )}
      </AppDialog>
    </main>
  );
}
function CategoryForm({ editor, busy, save, error }) {
  const c = editor.record;
  const [name, setName] = useState(c?.name || ''),
    [kind, setKind] = useState(c?.kind || 'expense'),
    [color, setColor] = useState(c?.color || '#E43900');
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save(
          {
            name,
            color,
            icon: kind === 'income' ? 'income' : 'expenses',
            ...(c ? { updatedAt: c.updatedAt } : { id: editor.id, kind }),
          },
          c,
        );
      }}
    >
      <Field
        label="Category name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
        maxLength={100}
      />
      <Field label="Category kind">
        <select
          aria-label="Category kind"
          value={kind}
          disabled={!!c}
          onChange={(e) => setKind(e.target.value)}
        >
          <option value="expense">expense</option>
          <option value="income">income</option>
        </select>
      </Field>
      <Field
        label="Category color"
        type="color"
        value={color}
        onChange={(e) => setColor(e.target.value)}
      />
      <p>
        Kind is immutable after creation. No historical amounts are changed.
      </p>
      {error && <p role="alert">{error}</p>}
      <button className="primary-button" disabled={busy}>
        Save Category
      </button>
    </form>
  );
}
