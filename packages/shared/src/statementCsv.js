const validDate = (s) =>
  /^\d{4}-\d{2}-\d{2}$/.test(s) &&
  Number.isFinite(new Date(s + 'T00:00:00Z').getTime()) &&
  new Date(s + 'T00:00:00Z').toISOString().slice(0, 10) === s;
export const MAX_FILE_SIZE = 2 * 1024 * 1024;
export function validateStatementFile(file) {
  const extension = file.name.split('.').at(-1).toLowerCase();
  if (!['csv', 'pdf'].includes(extension))
    throw new Error('Choose a CSV or PDF file.');
  if (!file.size || file.size > MAX_FILE_SIZE)
    throw new Error('File must contain data and be no larger than 2 MB.');
  const types =
    extension === 'pdf'
      ? ['application/pdf']
      : [
          'text/csv',
          'application/csv',
          'application/vnd.ms-excel',
          'text/plain',
        ];
  if (file.type && !types.includes(file.type))
    throw new Error('File MIME type does not match a supported format.');
  return extension;
}
export function parseCSV(text, delimiter = 'auto') {
  if (text.includes('\0'))
    throw new Error('Binary content is not a CSV statement.');
  text = text.replace(/^\uFEFF/, '');
  const parse = (sep) => {
    const rows = [];
    let row = [],
      field = '',
      quoted = false,
      closed = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (quoted) {
        if (c === '"') {
          if (text[i + 1] === '"') {
            field += '"';
            i++;
          } else {
            quoted = false;
            closed = true;
          }
        } else field += c;
      } else if (c === sep) {
        row.push(field);
        field = '';
        closed = false;
      } else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        row.push(field);
        if (row.some((v) => v.trim())) rows.push(row);
        row = [];
        field = '';
        closed = false;
      } else if (c === '"') {
        if (field || closed) throw new Error('Invalid CSV quoting.');
        quoted = true;
      } else {
        if (closed) throw new Error('Unexpected text after a quoted field.');
        field += c;
      }
    }
    if (quoted) throw new Error('Unclosed quoted CSV field.');
    row.push(field);
    if (row.some((v) => v.trim())) rows.push(row);
    if (rows.length < 2 || rows[0].length < 2)
      throw new Error('CSV needs a header and at least one data row.');
    if (rows.length > 501)
      throw new Error('Maximum 500 statement rows per batch.');
    if (rows.some((r) => r.length !== rows[0].length))
      throw new Error('CSV rows have different column counts.');
    if (
      new Set(rows[0].map((s) => s.trim().toLowerCase())).size !==
      rows[0].length
    )
      throw new Error('Column headers must be unique.');
    return {
      headers: rows[0].map((s) => s.trim()),
      rows: rows.slice(1),
      delimiter: sep,
    };
  };
  if (delimiter !== 'auto') return parse(delimiter);
  const candidates = [',', ';', '\t'].flatMap((d) => {
    try {
      return [parse(d)];
    } catch {
      return [];
    }
  });
  if (candidates.length !== 1)
    throw new Error(
      'Could not reliably detect columns. Select a delimiter or repair the CSV structure.',
    );
  return candidates[0];
}
export function suggestMapping(headers) {
  const names = {
    date: ['date', 'booking date', 'transaction date'],
    description: ['description', 'narrative', 'details'],
    amount: ['amount', 'signed amount'],
    debit: ['debit', 'withdrawal'],
    credit: ['credit', 'deposit'],
    currency: ['currency'],
    reference: ['reference', 'transaction id'],
  };
  return Object.fromEntries(
    Object.entries(names).map(([key, aliases]) => {
      const matches = headers
        .map((v, i) => (aliases.includes(v.toLowerCase()) ? String(i) : null))
        .filter((v) => v !== null);
      return [key, matches.length === 1 ? matches[0] : ''];
    }),
  );
}
export function parseAmount(value, decimal = 'dot') {
  let s = String(value).trim();
  if (!s) throw new Error('Amount is required.');
  const negative = s.startsWith('-') || /^\(.*\)$/.test(s);
  if (/^\(.*\)$/.test(s)) s = s.slice(1, -1);
  else s = s.replace(/^[+-]/, '');
  const pattern =
    decimal === 'comma'
      ? /^(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d{1,2})?$/
      : /^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,2})?$/;
  if (!pattern.test(s))
    throw new Error(
      'Use the selected decimal format and at most two decimal places.',
    );
  s =
    decimal === 'comma'
      ? s.replaceAll('.', '').replace(',', '.')
      : s.replaceAll(',', '');
  const [whole, fraction = ''] = s.split('.');
  const cents = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
  if (cents > 100000000000n) throw new Error('Amount exceeds demo limit.');
  return Number(cents) * (negative ? -1 : 1);
}
export function parseStatementDate(value, format = 'iso') {
  let s = value.trim();
  if (format !== 'iso') {
    const m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
    if (!m) throw new Error('Date does not match the selected format.');
    s = `${m[3]}-${(format === 'dmy' ? m[2] : m[1]).padStart(2, '0')}-${(format === 'dmy' ? m[1] : m[2]).padStart(2, '0')}`;
  }
  if (!validDate(s))
    throw new Error('Use a valid date in the selected format.');
  return s;
}
export function mapStatement(parsed, mapping, options) {
  if (
    mapping.date === '' ||
    mapping.description === '' ||
    (mapping.amount === '' && (mapping.debit === '' || mapping.credit === ''))
  )
    throw new Error(
      'Map date, description, and either signed amount or both debit/credit columns.',
    );
  if (mapping.amount !== '' && (mapping.debit !== '' || mapping.credit !== ''))
    throw new Error('Choose signed amount OR debit/credit mapping.');
  const used = Object.values(mapping).filter((v) => v !== '');
  if (new Set(used).size !== used.length)
    throw new Error('Map each column only once.');
  return parsed.rows.map((raw, index) => {
    const get = (k) =>
      mapping[k] !== '' ? raw[Number(mapping[k])].trim() : '';
    try {
      let amount;
      if (mapping.amount !== '')
        amount = parseAmount(get('amount'), options.decimal);
      else {
        const debit = get('debit')
            ? parseAmount(get('debit'), options.decimal)
            : 0,
          credit = get('credit')
            ? parseAmount(get('credit'), options.decimal)
            : 0;
        if (debit < 0 || credit < 0 || (debit && credit))
          throw new Error(
            'Debit/credit must be positive and only one may be nonzero.',
          );
        amount = credit - debit;
      }
      if (!amount) throw new Error('Zero amounts are not supported.');
      const date = parseStatementDate(get('date'), options.dateFormat),
        description = get('description');
      if (!description) throw new Error('Description is required.');
      if (date < options.start || date > options.end)
        throw new Error('Date is outside the selected statement period.');
      if (get('currency') && get('currency').toUpperCase() !== options.currency)
        throw new Error(
          'Row currency does not match the selected account currency.',
        );
      return {
        rowNumber: index + 2,
        date,
        description,
        amount,
        type: amount < 0 ? 'expense' : 'income',
        currency: options.currency,
        accountId: options.accountId,
        reference: get('reference'),
        originalDescription: description,
        originalDate: date,
        originalAmount: amount,
        raw: [...raw],
        decision: 'review',
        categoryId: '',
        reviewStatus: 'pending',
      };
    } catch (error) {
      throw new Error(`Row ${index + 2}: ${error.message}`, { cause: error });
    }
  });
}
