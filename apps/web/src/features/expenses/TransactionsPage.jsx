import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useWorkspace } from '../finance/WorkspaceContext.js';
import FinancialFilters from '../finance/components/FinancialFilters.jsx';
import { IncomeKpis } from '../income/components/IncomeUI.jsx';
import {
  ExpensePage,
  Field,
  CategorySelect,
  TransactionTable,
  Pagination,
} from './components/ExpenseUI.jsx';
import AppDialog from '../../components/ui/AppDialog.jsx';
import TransactionForm from './components/TransactionForm.jsx';
import TransactionDetail from './components/TransactionDetail.jsx';
import { transactionRows } from './expenseService.js';
import { downloadCSV } from './csv.js';
import {
  calculateExpenses,
  calculateIncome,
} from '../finance/data/calculations.js';
export default function TransactionsPage() {
  const { ledger, filters } = useWorkspace();
  return (
    <ExpensePage
      title="Transactions"
      subtitle="Review, categorize and audit your shared financial ledger."
      actions={
        <Link className="compact-button" to="/expenses/import">
          Import Statement
        </Link>
      }
    >
      {ledger.data && (
        <Transactions
          key={`${filters.workspaceId}-${filters.currency}`}
          data={ledger.data}
        />
      )}
    </ExpensePage>
  );
}
function Transactions({ data }) {
  const { filters, command, canEdit } = useWorkspace(),
    [params, setParams] = useSearchParams();
  const [query, setQuery] = useState({
      search: '',
      type: 'all',
      status: params.get('status') || 'all',
      categoryId: params.get('category') || 'all',
      source: 'all',
      start: '',
      end: '',
    }),
    [page, setPage] = useState(1),
    [selected, setSelected] = useState([]),
    [adding, setAdding] = useState(params.get('add') === '1'),
    [bulkCategory, setBulkCategory] = useState(''),
    [error, setError] = useState('');
  const rows = transactionRows(data, filters, query),
    pages = Math.max(1, Math.ceil(rows.length / 7)),
    current = Math.min(page, pages),
    ids = selected.filter((id) => rows.some((t) => t.id === id));
  const t = data.transactions.find(
    (t) =>
      t.id === params.get('id') &&
      t.workspaceId === filters.workspaceId &&
      t.currency === filters.currency,
  );
  const change = (key, value) => {
    setQuery((q) => ({ ...q, [key]: value }));
    setPage(1);
    setSelected([]);
  };
  const run = (action, payload) => {
    try {
      command('expense:' + action, payload);
      setError('');
      setSelected([]);
    } catch (e) {
      setError(e.message);
    }
  };
  const exportRows = () =>
    downloadCSV([
      [
        'Date',
        'Description',
        'Original description',
        'Currency',
        'Amount',
        'Type',
        'Category',
        'Status',
        'Source',
        'Batch',
      ],
      ...(ids.length ? rows.filter((t) => ids.includes(t.id)) : rows).map(
        (t) => [
          t.date,
          t.description,
          t.originalDescription || t.description,
          t.currency,
          (t.amount / 100).toFixed(2),
          t.type,
          data.categories.find((c) => c.id === t.categoryId)?.name ||
            'Uncategorized',
          t.excluded ? 'excluded' : t.reviewStatus,
          t.source || 'manual',
          t.importBatchId || '',
        ],
      ),
    ]);
  return (
    <>
      <div className="income-actions">
        <button
          className="compact-button brand-button"
          disabled={!canEdit}
          onClick={() => setAdding(true)}
        >
          ＋ Add Transaction
        </button>
        <button className="compact-button" onClick={exportRows}>
          Export {ids.length ? 'Selected' : 'Filtered'} CSV
        </button>
      </div>
      <IncomeKpis
        currency={filters.currency}
        values={[
          [
            'Total Expenses',
            calculateExpenses(rows),
            'Current filtered non-excluded rows',
          ],
          ['Total Income', calculateIncome(rows), 'Transfers excluded'],
          [
            'Uncategorized',
            String(
              rows.filter(
                (t) => !t.categoryId && !t.excluded && t.type === 'expense',
              ).length,
            ),
            'Expense review queue',
          ],
          [
            'Audit Queue',
            String(
              rows.filter((t) => t.reviewStatus === 'pending' && !t.excluded)
                .length,
            ),
            'Pending review',
          ],
        ]}
      />
      <div className="finance-card income-filter-panel">
        <FinancialFilters />
        <div className="form-grid">
          <Field
            label="Search transactions"
            value={query.search}
            onChange={(e) => change('search', e.target.value)}
          />
          <CategorySelect
            label="Filter category"
            type={null}
            includeArchived
            all
            value={query.categoryId}
            onChange={(v) => change('categoryId', v || 'uncategorized')}
          />
          {[
            ['type', 'Filter type', ['all', 'expense', 'income', 'transfer']],
            [
              'status',
              'Review status',
              [
                'all',
                'pending',
                'reviewed',
                'uncategorized',
                'duplicate',
                'excluded',
              ],
            ],
            ['source', 'Source', ['all', 'fixture', 'manual', 'import']],
          ].map(([key, label, values]) => (
            <Field key={key} label={label}>
              <select
                aria-label={label}
                value={query[key]}
                onChange={(e) => change(key, e.target.value)}
              >
                {values.map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </Field>
          ))}
          <Field
            label="From date"
            type="date"
            value={query.start}
            onChange={(e) => change('start', e.target.value)}
          />
          <Field
            label="To date"
            type="date"
            value={query.end}
            onChange={(e) => change('end', e.target.value)}
          />
        </div>
      </div>
      <section className="finance-card">
        <div className="bulk-toolbar">
          <label>
            <input
              type="checkbox"
              aria-label="Select all filtered transactions"
              checked={rows.length > 0 && ids.length === rows.length}
              onChange={(e) =>
                setSelected(e.target.checked ? rows.map((t) => t.id) : [])
              }
            />{' '}
            Select all filtered ({rows.length})
          </label>
          <CategorySelect
            label="Bulk category"
            type={null}
            value={bulkCategory}
            onChange={setBulkCategory}
          />
          <button
            className="compact-button"
            disabled={!canEdit || !ids.length}
            onClick={() =>
              run('bulkCategory', { ids, categoryId: bulkCategory })
            }
          >
            Assign Category
          </button>
          <button
            className="compact-button"
            disabled={!canEdit || !ids.length}
            onClick={() => run('markReviewed', { ids })}
          >
            Mark Reviewed
          </button>
          <button
            className="compact-button"
            disabled={!canEdit || !ids.length}
            onClick={() => {
              if (
                window.confirm(`Exclude ${ids.length} selected transactions?`)
              )
                run('exclude', { ids });
            }}
          >
            Exclude Selected
          </button>
        </div>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <TransactionTable
          rows={rows.slice((current - 1) * 7, current * 7)}
          data={data}
          selected={ids}
          onSelect={(id) =>
            setSelected((s) =>
              s.includes(id) ? s.filter((x) => x !== id) : [...s, id],
            )
          }
          onView={(id) => setParams({ id })}
        />
        <Pagination page={current} pages={pages} onChange={setPage} />
      </section>
      <AppDialog
        open={adding}
        title="Add Transaction"
        onClose={() => setAdding(false)}
      >
        {adding && (
          <TransactionForm
            defaultType={params.get('type') === 'income' ? 'income' : 'expense'}
            onSaved={(id) => {
              setAdding(false);
              setParams({ id });
            }}
          />
        )}
      </AppDialog>
      <AppDialog
        open={Boolean(t)}
        title={t?.description || 'Transaction details'}
        onClose={() => setParams({})}
      >
        {t && (
          <TransactionDetail
            key={t.id}
            transaction={t}
            onSelect={(id) => setParams({ id })}
          />
        )}
      </AppDialog>
    </>
  );
}
