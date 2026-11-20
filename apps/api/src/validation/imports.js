import {
  shape,
  id,
  text,
  currency,
  date,
  choice,
  integer,
  fail,
} from './contracts.js';
import {
  parseCSV,
  mapStatement,
  MAX_FILE_SIZE,
} from '../../../../packages/shared/src/statementCsv.js';
const keys = [
  'date',
  'description',
  'amount',
  'debit',
  'credit',
  'currency',
  'reference',
];
export function importInput(b, commit = false) {
  shape(b, [
    'csv',
    'fileName',
    'accountId',
    'currency',
    'mapping',
    'options',
    ...(commit ? ['key', 'previewHash', 'decisions', 'confirmed'] : []),
  ]);
  if (
    typeof b.csv !== 'string' ||
    !b.csv.trim() ||
    Buffer.byteLength(b.csv) > MAX_FILE_SIZE
  )
    fail('CSV must contain data and be at most 2 MB.');
  const fileName = text(b.fileName, 200);
  if (!fileName.toLowerCase().endsWith('.csv'))
    fail('Only UTF-8 CSV is supported.');
  const accountId = id(b.accountId),
    cur = currency(b.currency);
  shape(b.options, ['delimiter', 'dateFormat', 'decimal', 'start', 'end']);
  const options = {
    delimiter: choice(b.options.delimiter, ['auto', ',', ';', '\t']),
    dateFormat: choice(b.options.dateFormat, ['iso', 'dmy', 'mdy']),
    decimal: choice(b.options.decimal, ['dot', 'comma']),
    start: b.options.start,
    end: b.options.end,
    currency: cur,
    accountId,
  };
  date(options.start);
  date(options.end);
  if (options.start > options.end) fail('Invalid statement period.');
  shape(b.mapping, keys);
  let parsed;
  try {
    parsed = parseCSV(b.csv, options.delimiter);
  } catch (e) {
    fail(e.message);
  }
  for (const v of Object.values(b.mapping))
    if (
      v !== '' &&
      (typeof v !== 'string' ||
        !/^\d+$/.test(v) ||
        Number(v) >= parsed.headers.length)
    )
      fail('Invalid column mapping.');
  const rows = parsed.rows.map((raw, i) => {
    try {
      const r = mapStatement({ ...parsed, rows: [raw] }, b.mapping, options)[0];
      text(r.description, 500);
      if (r.reference) text(r.reference, 200);
      date(r.date);
      return { ...r, rowNumber: i + 2 };
    } catch (e) {
      return {
        rowNumber: i + 2,
        raw,
        error: e.message.replace(/^Row 2: /, ''),
      };
    }
  });
  const result = {
    csv: b.csv,
    fileName,
    accountId,
    currency: cur,
    mapping: b.mapping,
    options,
    rows,
  };
  if (commit) {
    result.key = id(b.key);
    if (b.confirmed !== true) fail('Explicit confirmation required.');
    if (
      typeof b.previewHash !== 'string' ||
      !/^[a-f0-9]{64}$/.test(b.previewHash)
    )
      fail();
    result.previewHash = b.previewHash;
    if (!Array.isArray(b.decisions) || b.decisions.length !== rows.length)
      fail('Review every row.');
    result.decisions = b.decisions.map((d, i) => {
      shape(
        d,
        ['rowNumber', 'decision', 'categoryId', 'matchId'],
        ['rowNumber', 'decision'],
      );
      if (integer(d.rowNumber, 2, 501) !== i + 2) fail();
      return {
        rowNumber: d.rowNumber,
        decision: choice(d.decision, ['keep', 'exclude', 'keep_both', 'match']),
        categoryId: d.categoryId ? id(d.categoryId) : null,
        matchId: d.matchId ? id(d.matchId) : null,
      };
    });
  }
  return result;
}
