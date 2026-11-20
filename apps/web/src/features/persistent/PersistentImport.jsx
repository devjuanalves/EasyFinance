import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/hooks/useAuth.js';
import { api, formatMinor } from '../../services/persistentApi.js';
import { Field } from '../income/components/IncomeUI.jsx';
import {
  validateStatementFile,
  parseCSV,
  suggestMapping,
} from '../expenses/csv.js';
import '../expenses/expenses.css';
export default function PersistentImport() {
  const user = useAuth(),
    cache = useQueryClient(),
    [params] = useSearchParams();
  const [selected, setSelected] = useState(params.get('workspace') || '');
  const workspaces = useQuery({
    queryKey: ['persistent', user.id, 'workspaces'],
    queryFn: () => api('/workspaces'),
    retry: false,
  });
  const workspace = selected
    ? workspaces.data?.find((w) => w.id === selected)
    : workspaces.data?.[0];
  return (
    <main className="workspace-content income-page expenses-page">
      <nav className="income-tabs" aria-label="Expenses navigation">
        <Link to={'/expenses?workspace=' + (workspace?.id || '')}>
          Overview
        </Link>
        <Link to={'/expenses/transactions?workspace=' + (workspace?.id || '')}>
          Transactions
        </Link>
        <Link to={'/expenses/import?workspace=' + (workspace?.id || '')}>
          Import Statement
        </Link>
      </nav>
      <div className="page-heading">
        <div>
          <span className="app-badge">PERSISTENT DEVELOPMENT DATA</span>
          <h1>Import Bank Statement</h1>
          <p>
            Upload → Parse → Review → Confirm. No financial writes before
            confirmation.
          </p>
        </div>
      </div>
      <Field label="Persistent workspace">
        <select
          aria-label="Persistent workspace"
          value={workspace?.id || ''}
          onChange={(e) => setSelected(e.target.value)}
        >
          {workspaces.data?.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name} · {w.role}
            </option>
          ))}
        </select>
      </Field>
      {workspaces.isPending && <p role="status">Loading workspaces…</p>}
      {workspaces.error && <p role="alert">{workspaces.error.message}</p>}
      {!workspaces.isPending && !workspace && (
        <p role="alert">No accessible workspace selected.</p>
      )}
      {workspace && (
        <ImportFlow
          key={workspace.id}
          workspace={workspace}
          user={user}
          cache={cache}
        />
      )}
    </main>
  );
}
function ImportFlow({ workspace, user, cache }) {
  const root = '/workspaces/' + workspace.id,
    prefix = ['persistent', user.id, workspace.id],
    canEdit = ['owner', 'editor'].includes(workspace.role);
  const support = useQuery({
    queryKey: [...prefix, 'import-support'],
    queryFn: async () => ({
      accounts: await api(root + '/accounts'),
      categories: await api(root + '/categories'),
      history: await api(root + '/imports'),
    }),
    retry: false,
  });
  const [accountId, setAccount] = useState(''),
    [file, setFile] = useState(null),
    [csv, setCsv] = useState(''),
    [parsed, setParsed] = useState(null),
    [mapping, setMapping] = useState(null),
    [review, setReview] = useState(null),
    [decisions, setDecisions] = useState([]),
    [result, setResult] = useState(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [key, setKey] = useState(() => crypto.randomUUID());
  const [options, setOptions] = useState({
    delimiter: 'auto',
    dateFormat: 'iso',
    decimal: 'dot',
    start: '1900-01-01',
    end: new Date().toISOString().slice(0, 10),
  });
  const accounts = support.data?.accounts.filter((a) => !a.archivedAt) || [],
    account = accounts.find((a) => a.id === accountId) || accounts[0];
  const categories = support.data?.categories || [];
  const reset = () => {
    setReview(null);
    setResult(null);
    setError('');
    setKey(crypto.randomUUID());
  };
  async function select(f) {
    reset();
    setParsed(null);
    setMapping(null);
    setCsv('');
    setFile(null);
    try {
      if (validateStatementFile(f) !== 'csv')
        throw new Error('PDF extraction is unavailable. Choose UTF-8 CSV.');
      setFile(f);
    } catch (e) {
      setError(e.message);
    }
  }
  async function analyze() {
    setBusy(true);
    setError('');
    try {
      const text = new TextDecoder('utf-8', { fatal: true }).decode(
        await file.arrayBuffer(),
      );
      const table = parseCSV(text, options.delimiter);
      setCsv(text);
      setParsed(table);
      setMapping(suggestMapping(table.headers));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  const body = () => ({
    csv,
    fileName: file.name,
    accountId: account.id,
    currency: account.currency,
    mapping,
    options,
  });
  async function preview() {
    setBusy(true);
    setError('');
    try {
      const p = await api(root + '/imports/preview', {
        method: 'POST',
        body: body(),
      });
      setReview(p);
      setDecisions(
        p.rows.map((r) => ({
          rowNumber: r.rowNumber,
          decision: r.error
            ? 'exclude'
            : r.candidates.length || r.within.length
              ? 'review'
              : 'keep',
          categoryId: null,
          matchId: null,
        })),
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function confirm() {
    setBusy(true);
    setError('');
    try {
      const r = await api(root + '/imports', {
        method: 'POST',
        body: {
          ...body(),
          key,
          previewHash: review.previewHash,
          decisions,
          confirmed: true,
        },
      });
      setResult(r);
      await cache.invalidateQueries({ queryKey: prefix });
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  const update = (index, changes) =>
    setDecisions((ds) =>
      ds.map((d, i) => (i === index ? { ...d, ...changes } : d)),
    );
  return (
    <>
      <ol className="import-stepper" aria-label="Import steps">
        {['Upload', 'Processing', 'Review', 'Complete'].map((s, i) => (
          <li
            key={s}
            aria-current={
              (result ? 3 : review ? 2 : busy ? 1 : 0) === i
                ? 'step'
                : undefined
            }
          >
            <span>{i + 1}</span>
            {s}
          </li>
        ))}
      </ol>
      {(error || support.error) && (
        <p role="alert" className="form-error finance-card">
          {error || support.error.message}
        </p>
      )}
      {support.isPending && (
        <p role="status">Loading accounts and import history…</p>
      )}
      {!canEdit && (
        <p className="finance-card">
          Viewer access: import history is read-only.
        </p>
      )}
      {!review && !result && (
        <section className="finance-card">
          <h2>Upload your statement</h2>
          <p>
            UTF-8 CSV, up to 2 MB and 500 rows. PDF/OCR and live bank feeds are
            unavailable.
          </p>
          <div
            className="statement-dropzone"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (e.dataTransfer.files.length === 1)
                void select(e.dataTransfer.files[0]);
              else setError('Choose one CSV at a time.');
            }}
          >
            <Field
              label="Browse Files"
              type="file"
              accept=".csv"
              disabled={!canEdit || busy}
              onChange={(e) => {
                if (e.target.files[0]) void select(e.target.files[0]);
                e.target.value = '';
              }}
            />
          </div>
          {file && (
            <p>
              {file.name} · {file.size} bytes{' '}
              <button
                className="text-button"
                onClick={() => {
                  reset();
                  setFile(null);
                  setParsed(null);
                }}
              >
                Remove File
              </button>
            </p>
          )}
          <div className="form-grid">
            <Field label="Statement account">
              <select
                aria-label="Statement account"
                value={account?.id || ''}
                onChange={(e) => {
                  setAccount(e.target.value);
                  reset();
                }}
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} · {a.currency}
                  </option>
                ))}
              </select>
            </Field>
            <p>
              Statement currency: {account?.currency || 'Select an account'}
            </p>
            {[
              ['start', 'Statement start'],
              ['end', 'Statement end'],
            ].map(([k, l]) => (
              <Field
                key={k}
                label={l}
                type="date"
                value={options[k]}
                onChange={(e) => {
                  setOptions((o) => ({ ...o, [k]: e.target.value }));
                  reset();
                }}
              />
            ))}
            {[
              [
                'delimiter',
                'Delimiter',
                [
                  ['auto', 'Detect reliably'],
                  [',', 'Comma'],
                  [';', 'Semicolon'],
                  ['\t', 'Tab'],
                ],
              ],
              [
                'dateFormat',
                'Date format',
                [
                  ['iso', 'YYYY-MM-DD'],
                  ['dmy', 'DD/MM/YYYY'],
                  ['mdy', 'MM/DD/YYYY'],
                ],
              ],
              [
                'decimal',
                'Decimal format',
                [
                  ['dot', '1,234.56'],
                  ['comma', '1.234,56'],
                ],
              ],
            ].map(([k, l, choices]) => (
              <Field key={k} label={l}>
                <select
                  aria-label={l}
                  value={options[k]}
                  onChange={(e) => {
                    setOptions((o) => ({ ...o, [k]: e.target.value }));
                    if (k === 'delimiter') setParsed(null);
                    reset();
                  }}
                >
                  {choices.map(([v, label]) => (
                    <option key={v} value={v}>
                      {label}
                    </option>
                  ))}
                </select>
              </Field>
            ))}
          </div>
          <button
            className="compact-button brand-button"
            disabled={!file || !account || !canEdit || busy}
            onClick={analyze}
          >
            Analyze Statement
          </button>
          {parsed && mapping && (
            <section className="mapping-panel">
              <h3>Confirm column mapping · {parsed.rows.length} records</h3>
              <p>Map signed Amount OR both Debit and Credit.</p>
              <div className="form-grid">
                {Object.entries(mapping).map(([k, v]) => (
                  <Field key={k} label={'Map ' + k}>
                    <select
                      aria-label={'Map ' + k}
                      value={v}
                      onChange={(e) =>
                        setMapping((m) => ({ ...m, [k]: e.target.value }))
                      }
                    >
                      <option value="">Not mapped</option>
                      {parsed.headers.map((h, i) => (
                        <option key={i} value={String(i)}>
                          {h}
                        </option>
                      ))}
                    </select>
                  </Field>
                ))}
              </div>
              <button
                className="compact-button brand-button"
                disabled={busy || !canEdit}
                onClick={preview}
              >
                Review Transactions
              </button>
            </section>
          )}
        </section>
      )}
      {review && !result && (
        <section className="finance-card persistent-import-review">
          <h2>Review transactions</h2>
          <p>
            Possible matches are suggestions, not confirmed duplicates. Match
            existing records without changing them, exclude rows, or explicitly
            Keep Both for distinct activity. Invalid rows must be excluded or
            repaired in the CSV.
          </p>
          {review.rows.map((r, i) => (
            <article className="finance-card" key={r.rowNumber}>
              <h3>
                Row {r.rowNumber} · {r.description || 'Invalid row'}
              </h3>
              {r.error ? (
                <p role="alert">{r.error}</p>
              ) : (
                <>
                  <p>
                    {r.date} · {formatMinor(String(r.amount), account.currency)}{' '}
                    · {r.reference}
                  </p>
                  {(r.candidates.length > 0 || r.within.length > 0) && (
                    <p className="scope-note">
                      Possible duplicate: {r.candidates.length} existing
                      matches; within-file rows {r.within.join(', ') || 'none'}.
                    </p>
                  )}
                  {r.candidates.map((c) => (
                    <p key={c.id}>
                      {c.description} · {c.date} ·{' '}
                      {formatMinor(c.amountMinor, account.currency)} ·{' '}
                      {c.source} {c.excluded ? '· excluded' : ''}
                    </p>
                  ))}
                </>
              )}
              <div className="form-grid">
                <Field label={'Decision row ' + r.rowNumber}>
                  <select
                    aria-label={'Decision row ' + r.rowNumber}
                    value={decisions[i].decision}
                    disabled={busy}
                    onChange={(e) =>
                      update(i, { decision: e.target.value, matchId: null })
                    }
                  >
                    <option value="review">Review required</option>
                    <option value="exclude">Exclude row</option>
                    {!r.error && (
                      <>
                        <option value="keep">Import new</option>
                        <option value="keep_both">
                          Keep Both — distinct activity
                        </option>
                        {r.candidates.some((c) => c.compatible) && (
                          <option value="match">
                            Use existing transaction
                          </option>
                        )}
                      </>
                    )}
                  </select>
                </Field>
                {decisions[i].decision === 'match' && (
                  <Field label={'Existing transaction row ' + r.rowNumber}>
                    <select
                      aria-label={'Existing transaction row ' + r.rowNumber}
                      value={decisions[i].matchId || ''}
                      onChange={(e) => update(i, { matchId: e.target.value })}
                    >
                      <option value="">Choose reviewed match</option>
                      {r.candidates
                        .filter((c) => c.compatible)
                        .map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.description} · {c.type}
                          </option>
                        ))}
                    </select>
                  </Field>
                )}
                {!r.error &&
                  ['keep', 'keep_both'].includes(decisions[i].decision) && (
                    <Field label={'Category row ' + r.rowNumber}>
                      <select
                        aria-label={'Category row ' + r.rowNumber}
                        value={decisions[i].categoryId || ''}
                        onChange={(e) =>
                          update(i, { categoryId: e.target.value || null })
                        }
                      >
                        <option value="">Unclassified</option>
                        {categories
                          .filter((c) => !c.archivedAt && c.kind === r.type)
                          .map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                      </select>
                    </Field>
                  )}
              </div>
            </article>
          ))}
          <div className="income-actions">
            <button
              className="compact-button"
              disabled={busy}
              onClick={() => setReview(null)}
            >
              Back to mapping
            </button>
            <button
              className="compact-button brand-button"
              disabled={
                busy ||
                !canEdit ||
                decisions.some(
                  (d) =>
                    d.decision === 'review' ||
                    (d.decision === 'match' && !d.matchId),
                )
              }
              onClick={confirm}
            >
              Confirm Import
            </button>
          </div>
          <p>
            All accepted rows commit atomically. No existing transaction is
            overwritten.
          </p>
        </section>
      )}
      {result && (
        <section className="finance-card" role="status">
          <h2>Import complete</h2>
          <p>
            {result.accepted} transactions imported from {result.rowCount}{' '}
            reviewed rows.
          </p>
          <Link to={'/expenses/transactions?workspace=' + workspace.id}>
            View Transactions
          </Link>
          <button
            className="compact-button"
            onClick={() => {
              reset();
              setFile(null);
              setParsed(null);
            }}
          >
            Import another statement
          </button>
        </section>
      )}
      <section className="finance-card">
        <h2>Import history</h2>
        {support.data?.history.length === 0 && <p>No confirmed imports.</p>}
        {support.data?.history.map((b) => (
          <article key={b.id}>
            <strong>{b.fileName}</strong>
            <p>
              {b.accepted} imported / {b.rowCount} reviewed · {b.currency} ·{' '}
              {b.status}
            </p>
          </article>
        ))}
      </section>
    </>
  );
}
