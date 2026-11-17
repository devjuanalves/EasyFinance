import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useWorkspace } from '../finance/WorkspaceContext.js';
import { ExpensePage, Field, CategorySelect } from './components/ExpenseUI.jsx';
import {
  validateStatementFile,
  parseCSV,
  suggestMapping,
  mapStatement,
  parseAmount,
} from './csv.js';
import { duplicateCandidates, matchRules } from './expenseService.js';
import { money } from '../finance/data/calculations.js';
export default function StatementImport() {
  const { ledger, filters } = useWorkspace();
  return (
    <ExpensePage
      title="Import Bank Statement"
      subtitle="Upload → Parse → Review → Confirm. Nothing enters the ledger before your review."
    >
      {ledger.data && (
        <ImportFlow
          key={`${filters.workspaceId}-${filters.currency}`}
          data={ledger.data}
        />
      )}
    </ExpensePage>
  );
}
function ImportFlow({ data }) {
  const { filters, command, canEdit, setFilter } = useWorkspace(),
    [file, setFile] = useState(null),
    [parsed, setParsed] = useState(null),
    [mapping, setMapping] = useState(null),
    [rows, setRows] = useState([]),
    [step, setStep] = useState(0),
    [error, setError] = useState(''),
    [selected, setSelected] = useState([]),
    [batchId, setBatchId] = useState(null),
    [checksum, setChecksum] = useState(''),
    [token, setToken] = useState(() => crypto.randomUUID());
  const [options, setOptions] = useState({
    accountId:
      data.accounts.find(
        (a) =>
          a.workspaceId === filters.workspaceId &&
          a.currency === filters.currency,
      )?.id || '',
    currency: filters.currency,
    start: '2026-10-01',
    end: data.asOf,
    delimiter: 'auto',
    dateFormat: 'iso',
    decimal: 'dot',
  });
  const selectFile = (f) => {
    setError('');
    setParsed(null);
    setMapping(null);
    setRows([]);
    try {
      validateStatementFile(f);
      setFile(f);
    } catch (e) {
      setFile(null);
      setError(e.message);
    }
  };
  async function analyze() {
    setError('');
    setStep(1);
    try {
      if (!file) throw new Error('Choose a statement first.');
      const extension = validateStatementFile(file),
        buffer = await file.arrayBuffer();
      if (extension === 'pdf') {
        const signature = new TextDecoder().decode(buffer.slice(0, 5));
        throw new Error(
          signature === '%PDF-'
            ? 'PDF selected and validated. PDF text extraction/OCR is unavailable in this demo. Choose a supported CSV instead.'
            : 'This file does not have a valid PDF signature.',
        );
      }
      const text = new TextDecoder('utf-8', { fatal: true }).decode(buffer),
        table = parseCSV(text, options.delimiter);
      setParsed(table);
      setMapping(suggestMapping(table.headers));
      setChecksum(
        Array.from(
          new Uint8Array(await crypto.subtle.digest('SHA-256', buffer)),
        )
          .map((n) => n.toString(16).padStart(2, '0'))
          .join(''),
      );
      setStep(0);
    } catch (e) {
      setError(e.message);
      setStep(0);
    }
  }
  function review() {
    try {
      const mapped = mapStatement(parsed, mapping, options).map((r, i) => {
        const row = {
          ...r,
          id: `preview-${i}`,
          workspaceId: filters.workspaceId,
        };
        const rules = matchRules(data, row);
        return {
          ...row,
          categoryId: rules[0]?.categoryId || '',
          suggestion: rules.length
            ? `Rule: ${rules[0].name}${new Set(rules.map((r) => r.categoryId)).size > 1 ? ' · conflicting matches; priority chooses first' : ''}`
            : 'Unclassified · manual review required',
        };
      });
      setRows(mapped);
      setSelected(mapped.map((r) => r.id));
      setStep(2);
      setError('');
    } catch (e) {
      setError(e.message);
    }
  }
  const update = (id, values) =>
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...values } : r)));
  const candidates = (r) =>
    duplicateCandidates(
      data,
      r,
      rows.filter((x) => x.id !== r.id),
    );
  function confirm() {
    try {
      const id = command('expense:confirmImport', {
        ...options,
        token,
        rows,
        fileName: file.name,
        mime: file.type,
        size: file.size,
        checksum,
      });
      setBatchId(id);
      setStep(3);
      setError('');
    } catch (e) {
      setError(e.message);
    }
  }
  const batch = data.importBatches.find((b) => b.id === batchId);
  return (
    <>
      <ol className="import-stepper" aria-label="Import steps">
        {['Upload', 'Processing', 'Review', 'Complete'].map((name, i) => (
          <li key={name} aria-current={step === i ? 'step' : undefined}>
            <span>{i < step ? '✓' : i + 1}</span>
            {name}
          </li>
        ))}
      </ol>
      {error && (
        <p role="alert" className="form-error finance-card">
          {error}
        </p>
      )}
      {step === 1 ? (
        <section className="finance-card" role="status">
          Reading and validating {file?.name}… No invented progress percentage
          or AI extraction.
        </section>
      ) : step === 0 ? (
        <section className="finance-card">
          <h2>Upload your statement</h2>
          <p>
            CSV: UTF-8, up to 2 MB and 500 rows. PDF selection is supported;
            extraction is unavailable.
          </p>
          <div
            className="statement-dropzone"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (e.dataTransfer.files.length === 1)
                selectFile(e.dataTransfer.files[0]);
              else setError('Choose one statement at a time.');
            }}
          >
            <label className="income-field">
              Browse Files
              <input
                aria-label="Browse Files"
                type="file"
                accept=".csv,.pdf"
                onChange={(e) => {
                  if (e.target.files[0]) selectFile(e.target.files[0]);
                  e.target.value = '';
                }}
              />
            </label>
            <span>or drop one CSV/PDF here</span>
          </div>
          {file && (
            <div className="source-row">
              <strong>
                {file.name} · {file.size} bytes
              </strong>
              <button
                className="text-button"
                onClick={() => {
                  setFile(null);
                  setParsed(null);
                  setMapping(null);
                }}
              >
                Remove File
              </button>
            </div>
          )}
          <div className="form-grid">
            <Field label="Statement account">
              <select
                aria-label="Statement account"
                value={options.accountId}
                onChange={(e) => {
                  setOptions((o) => ({ ...o, accountId: e.target.value }));
                  setParsed(null);
                }}
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
            <Field label="Statement currency">
              <select
                aria-label="Statement currency"
                value={options.currency}
                onChange={(e) =>
                  (!file ||
                    window.confirm(
                      'Change currency and discard this selected file?',
                    )) &&
                  setFilter('currency', e.target.value)
                }
              >
                <option>AUD</option>
                <option>EUR</option>
              </select>
            </Field>
            <Field
              label="Statement start"
              type="date"
              value={options.start}
              onChange={(e) =>
                setOptions((o) => ({ ...o, start: e.target.value }))
              }
            />
            <Field
              label="Statement end"
              type="date"
              value={options.end}
              onChange={(e) =>
                setOptions((o) => ({ ...o, end: e.target.value }))
              }
            />
            <Field label="Delimiter">
              <select
                aria-label="Delimiter"
                value={options.delimiter}
                onChange={(e) => {
                  setOptions((o) => ({ ...o, delimiter: e.target.value }));
                  setParsed(null);
                }}
              >
                {[
                  ['auto', 'Detect reliably'],
                  [',', 'Comma'],
                  [';', 'Semicolon'],
                  ['\t', 'Tab'],
                ].map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Date format">
              <select
                aria-label="Date format"
                value={options.dateFormat}
                onChange={(e) =>
                  setOptions((o) => ({ ...o, dateFormat: e.target.value }))
                }
              >
                <option value="iso">YYYY-MM-DD</option>
                <option value="dmy">DD/MM/YYYY or DD-MM-YYYY</option>
                <option value="mdy">MM/DD/YYYY or MM-DD-YYYY</option>
              </select>
            </Field>
            <Field label="Decimal format">
              <select
                aria-label="Decimal format"
                value={options.decimal}
                onChange={(e) =>
                  setOptions((o) => ({ ...o, decimal: e.target.value }))
                }
              >
                <option value="dot">1,234.56 · dot decimal</option>
                <option value="comma">1.234,56 · comma decimal</option>
              </select>
            </Field>
          </div>
          <p className="scope-note">
            The account fixes the currency. Change the workspace currency before
            selecting a different native-currency account. Sample dates: 1
            August–31 October 2026.
          </p>
          <button
            className="compact-button brand-button"
            disabled={!file || !canEdit}
            onClick={analyze}
          >
            Analyze Statement
          </button>
          {parsed && mapping && (
            <section className="mapping-panel">
              <h3>Confirm column mapping · {parsed.rows.length} records</h3>
              <p>
                Verify the proposed headers. Choose signed Amount OR Debit and
                Credit; never both.
              </p>
              <div className="form-grid">
                {Object.keys(mapping).map((key) => (
                  <Field label={`Map ${key}`} key={key}>
                    <select
                      aria-label={`Map ${key}`}
                      value={mapping[key]}
                      onChange={(e) =>
                        setMapping((m) => ({ ...m, [key]: e.target.value }))
                      }
                    >
                      <option value="">Not mapped</option>
                      {parsed.headers.map((h, i) => (
                        <option key={i} value={i}>
                          {h}
                        </option>
                      ))}
                    </select>
                  </Field>
                ))}
              </div>
              <button className="compact-button brand-button" onClick={review}>
                Build Review
              </button>
            </section>
          )}
        </section>
      ) : step === 2 ? (
        <>
          <section className="finance-card">
            <h2>Review {rows.length} parsed transactions</h2>
            <p>
              {file.name} · {options.currency} · {options.start}–{options.end}
            </p>
            <p>
              Suggestions are deterministic rules, not live AI. Keep means you
              reviewed the row; unclassified kept rows remain pending category
              review.
            </p>
            <div className="bulk-toolbar">
              <label>
                <input
                  type="checkbox"
                  aria-label="Select all review rows"
                  checked={selected.length === rows.length}
                  onChange={(e) =>
                    setSelected(e.target.checked ? rows.map((r) => r.id) : [])
                  }
                />{' '}
                Select all review rows
              </label>
              <button
                className="compact-button"
                onClick={() =>
                  setRows((rs) =>
                    rs.map((r) =>
                      selected.includes(r.id) ? { ...r, decision: 'keep' } : r,
                    ),
                  )
                }
              >
                Confirm Selected
              </button>
              <button
                className="compact-button"
                onClick={() =>
                  setRows((rs) =>
                    rs.map((r) =>
                      selected.includes(r.id)
                        ? { ...r, decision: 'exclude' }
                        : r,
                    ),
                  )
                }
              >
                Exclude Selected Rows
              </button>
              <button
                className="compact-button"
                onClick={() => {
                  if (
                    window.confirm(
                      'Discard this unconfirmed review and change the file?',
                    )
                  ) {
                    setRows([]);
                    setStep(0);
                  }
                }}
              >
                Change File
              </button>
            </div>
            <p role="status">
              {rows.filter((r) => r.decision === 'keep').length} kept ·{' '}
              {rows.filter((r) => r.decision === 'exclude').length} excluded ·{' '}
              {rows.filter((r) => r.decision === 'review').length} need a
              decision
            </p>
          </section>
          <div className="statement-review">
            {rows.map((r, i) => (
              <article className="finance-card review-row" key={r.id}>
                <div className="section-heading">
                  <label>
                    <input
                      type="checkbox"
                      aria-label={`Select row ${i + 1}`}
                      checked={selected.includes(r.id)}
                      onChange={() =>
                        setSelected((s) =>
                          s.includes(r.id)
                            ? s.filter((x) => x !== r.id)
                            : [...s, r.id],
                        )
                      }
                    />{' '}
                    Row {i + 1}
                  </label>
                  <strong>
                    {Number.isFinite(r.amount)
                      ? money(r.amount, r.currency)
                      : 'Invalid amount'}
                  </strong>
                  <span className="invoice-status">{r.decision}</span>
                </div>
                <p className="scope-note">
                  Original: {r.originalDescription} ·{' '}
                  {money(r.originalAmount, r.currency)}
                </p>
                <div className="form-grid">
                  <Field
                    label={`Row ${i + 1} date`}
                    type="date"
                    value={r.date}
                    onChange={(e) =>
                      update(r.id, {
                        date: e.target.value,
                        decision: 'review',
                        duplicateDecision: null,
                      })
                    }
                  />
                  <Field
                    label={`Row ${i + 1} description`}
                    value={r.description}
                    onChange={(e) =>
                      update(r.id, {
                        description: e.target.value,
                        decision: 'review',
                      })
                    }
                  />
                  <Field
                    label={`Row ${i + 1} amount`}
                    value={r.amountText ?? (r.amount / 100).toFixed(2)}
                    onChange={(e) => {
                      let amount = null;
                      try {
                        amount = parseAmount(e.target.value);
                      } catch {
                        /* Invalid input remains visible and cannot be confirmed. */
                      }
                      update(r.id, {
                        amountText: e.target.value,
                        amount,
                        decision: 'review',
                        duplicateDecision: null,
                      });
                    }}
                  />
                  <Field label={`Row ${i + 1} type`}>
                    <select
                      aria-label={`Row ${i + 1} type`}
                      value={r.type}
                      onChange={(e) =>
                        update(r.id, {
                          type: e.target.value,
                          categoryId: '',
                          decision: 'review',
                        })
                      }
                    >
                      {['expense', 'income', 'transfer'].map((v) => (
                        <option key={v}>{v}</option>
                      ))}
                    </select>
                  </Field>
                  {r.type !== 'transfer' && (
                    <CategorySelect
                      label={`Row ${i + 1} category`}
                      type={r.type}
                      value={r.categoryId}
                      onChange={(v) =>
                        update(r.id, {
                          categoryId: v,
                          manualCategory: true,
                          suggestion: 'Manually confirmed category',
                          decision: 'review',
                        })
                      }
                    />
                  )}
                </div>
                <p>{r.suggestion}</p>
                {candidates(r).length > 0 && (
                  <div className="partial-banner">
                    <strong>
                      Potential Duplicate · {candidates(r).length} candidate(s)
                    </strong>
                    <p>
                      Same account/currency and fingerprint or reference. Review
                      before keeping both.
                    </p>
                    {candidates(r).map((c) => (
                      <p key={c.id}>
                        {c.description} · {c.date} ·{' '}
                        {money(c.amount, c.currency)}{' '}
                        {c.excluded ? '(previously excluded)' : ''}
                      </p>
                    ))}
                    <button
                      className="compact-button"
                      onClick={() =>
                        update(r.id, {
                          decision: 'keep',
                          duplicateDecision: 'both',
                        })
                      }
                    >
                      Keep Both · Row {i + 1}
                    </button>
                  </div>
                )}
                <div className="income-actions">
                  <button
                    className="compact-button"
                    onClick={() => update(r.id, { decision: 'keep' })}
                  >
                    Keep Row {i + 1}
                  </button>
                  <button
                    className="compact-button"
                    onClick={() => update(r.id, { decision: 'exclude' })}
                  >
                    Exclude Row {i + 1}
                  </button>
                  <button
                    className="text-button"
                    onClick={() =>
                      update(r.id, {
                        type: 'transfer',
                        categoryId: '',
                        decision: 'review',
                      })
                    }
                  >
                    Mark Row {i + 1} Internal Transfer
                  </button>
                </div>
              </article>
            ))}
          </div>
          <button
            className="primary-button"
            disabled={!canEdit}
            onClick={confirm}
          >
            Confirm Import
          </button>
        </>
      ) : (
        <section className="finance-card" role="status">
          <h2>Import Complete</h2>
          <p>
            {batch?.imported} imported · {batch?.excluded} excluded ·{' '}
            {batch?.duplicates} duplicate candidates · {batch?.unclassified}{' '}
            unclassified
          </p>
          <p>
            Batch {batchId} · {batch?.status}. Saved only in this demonstration
            session.
          </p>
          <div className="income-actions">
            <Link
              className="compact-button brand-button"
              to="/expenses/transactions"
            >
              View Transactions
            </Link>
            <button
              className="compact-button"
              onClick={() => {
                setFile(null);
                setParsed(null);
                setRows([]);
                setBatchId(null);
                setStep(0);
                setToken(crypto.randomUUID());
              }}
            >
              Import Another Statement
            </button>
            <button
              className="compact-button"
              disabled={!canEdit || batch?.status !== 'complete'}
              onClick={() => {
                if (
                  window.confirm(
                    'Exclude all transactions in this batch? Audit records remain.',
                  )
                )
                  try {
                    command('expense:undoBatch', { id: batchId });
                  } catch (e) {
                    setError(e.message);
                  }
              }}
            >
              Exclude Imported Batch
            </button>
          </div>
        </section>
      )}
    </>
  );
}
