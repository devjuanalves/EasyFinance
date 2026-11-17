import { describe, it, expect } from 'vitest';
import {
  financialData,
  DEFAULT_FILTERS,
} from '../../finance/data/financialData.js';
import {
  summarize,
  groupExpensesByCategory,
} from '../../finance/data/calculations.js';
import {
  createFinancialStore,
  applyIncomeCommand,
} from '../../income/incomeService.js';
import {
  applyExpenseCommand,
  expenseSummary,
  duplicateCandidates,
  rulePreview,
  transactionRows,
} from '../expenseService.js';
import {
  parseCSV,
  mapStatement,
  suggestMapping,
  parseAmount,
  parseStatementDate,
  validateStatementFile,
  csvText,
} from '../csv.js';
const context = { ...DEFAULT_FILTERS, role: 'owner' };
const cmd = (d, a, p = {}, c = context) => applyExpenseCommand(d, c, a, p);
const tx = {
  date: '2026-10-25',
  description: 'Test groceries',
  amount: '-150.00',
  accountId: 'checking',
  currency: 'AUD',
  type: 'expense',
  categoryId: 'groceries',
  notes: 'Receipt retained',
};
function parsed(
  text = 'Date,Description,Amount\n2026-10-25,"Shop, local",-150.00',
) {
  const table = parseCSV(text);
  return mapStatement(table, suggestMapping(table.headers), {
    accountId: 'checking',
    currency: 'AUD',
    start: '2026-10-01',
    end: '2026-10-31',
    dateFormat: 'iso',
    decimal: 'dot',
  });
}
const batch = (rows) => ({
  rows: rows.map((r) => ({ ...r, decision: 'keep' })),
  token: 'test-import',
  accountId: 'checking',
  currency: 'AUD',
  start: '2026-10-01',
  end: '2026-10-31',
  fileName: 'sample.csv',
  checksum: 'example',
  mime: 'text/csv',
  size: 90,
});
describe('Statement parser', () => {
  it('reads quoted commas, escaped quotes and embedded newlines', () => {
    const p = parseCSV(
      'Date,Description,Amount\r\n2026-10-25,"Shop, ""local""\nSydney",-150.00',
    );
    expect(p.rows[0][1]).toBe('Shop, "local"\nSydney');
    expect(parsed()[0].amount).toBe(-15000);
  });
  it.each([';', '\t'])('detects %s delimiters', (d) => {
    expect(
      parseCSV(`Date${d}Description${d}Amount\n2026-10-25${d}Store${d}-12.50`)
        .delimiter,
    ).toBe(d);
  });
  it('parses decimal formats deterministically', () => {
    expect(parseAmount('1.234,56', 'comma')).toBe(123456);
    expect(parseAmount('(1,234.56)')).toBe(-123456);
    expect(() => parseAmount('1.234')).toThrow();
    expect(() => parseAmount('1,23')).toThrow();
  });
  it('requires explicit date interpretation', () => {
    expect(parseStatementDate('03/10/2026', 'dmy')).toBe('2026-10-03');
    expect(parseStatementDate('03/10/2026', 'mdy')).toBe('2026-03-10');
    expect(() => parseStatementDate('03/10/2026')).toThrow();
    expect(() => parseStatementDate('2026-02-30')).toThrow();
  });
  it('supports debit/credit with empty cells and rejects conflicting values', () => {
    const p = parseCSV(
        'Date;Description;Debit;Credit\n2026-10-01;Shop;12,50;\n2026-10-02;Salary;;100,00',
      ),
      m = suggestMapping(p.headers),
      o = {
        accountId: 'checking',
        currency: 'AUD',
        start: '2026-10-01',
        end: '2026-10-31',
        decimal: 'comma',
        dateFormat: 'iso',
      };
    expect(mapStatement(p, m, o).map((r) => r.amount)).toEqual([-1250, 10000]);
    p.rows[0][3] = '2,00';
    expect(() => mapStatement(p, m, o)).toThrow(/Row 2/);
  });
  it('rejects missing columns, malformed structure and bad currency', () => {
    expect(() => parsed('Date,Who,Value\n2026-10-01,Shop,-1')).toThrow(/Map/);
    expect(() => parseCSV('A,B\n"unterminated,2')).toThrow();
    expect(() =>
      parsed('Date,Description,Amount,Currency\n2026-10-01,Shop,-1,EUR'),
    ).toThrow(/currency/);
  });
  it('validates file type MIME size and empty files', () => {
    expect(
      validateStatementFile({ name: 'x.csv', type: 'text/csv', size: 10 }),
    ).toBe('csv');
    for (const f of [
      { name: 'x.exe', type: '', size: 10 },
      { name: 'x.csv', type: 'application/pdf', size: 10 },
      { name: 'x.csv', type: '', size: 0 },
      { name: 'x.pdf', type: 'application/pdf', size: 3000000 },
    ])
      expect(() => validateStatementFile(f)).toThrow();
  });
  it('escapes CSV output including formulas and newlines', () =>
    expect(csvText([['=SUM(1)', 'a,"b"\nc']])).toBe(
      '\uFEFF"\'=SUM(1)","a,""b""\nc"',
    ));
});
describe('Shared expense ledger', () => {
  it('preserves baseline, period, account, category and currency totals', () => {
    expect(expenseSummary(financialData, context).total).toBe(284000);
    expect(expenseSummary(financialData, context, 'groceries').total).toBe(
      62000,
    );
    expect(
      expenseSummary(financialData, { ...context, accountId: 'reserve' }).total,
    ).toBe(17101);
    expect(
      expenseSummary(financialData, { ...context, currency: 'EUR' }).total,
    ).toBe(2000);
    expect(
      expenseSummary(financialData, { ...context, periodId: 'august' }).total,
    ).toBe(0);
    expect(expenseSummary(financialData, context).recurring[0].confirmed).toBe(
      false,
    );
  });
  it('adds an expense and synchronizes Dashboard with the same snapshot', () => {
    const store = createFinancialStore(financialData);
    store.command(context, 'expense:saveTransaction', { transaction: tx });
    expect(summarize(store.getSnapshot(), context).expenses).toBe(299000);
    expect(expenseSummary(store.getSnapshot(), context).total).toBe(299000);
    expect(financialData.transactions).toHaveLength(
      store.getSnapshot().transactions.length - 1,
    );
  });
  it('preserves source fields and notes when editing', () => {
    const d = cmd(financialData, 'saveTransaction', {
      id: 'o12',
      transaction: {
        ...financialData.transactions.find((t) => t.id === 'o12'),
        description: 'Corrected shop',
        notes: 'Receipt checked',
      },
    }).data;
    const t = d.transactions.find((t) => t.id === 'o12');
    expect(t.originalDescription).toBe('Woolworths Metro');
    expect(t.originalAmount).toBe(-8640);
    expect(t.notes).toBe('Receipt checked');
  });
  it('splits exact cents without counting the parent twice and projects category filters', () => {
    let { data, result } = cmd(financialData, 'saveTransaction', {
      transaction: tx,
    });
    data = cmd(data, 'split', {
      id: result,
      parts: [
        { categoryId: 'groceries', amount: '100' },
        { categoryId: 'other', amount: '50' },
      ],
    }).data;
    expect(summarize(data, context).expenses).toBe(299000);
    expect(
      groupExpensesByCategory(summarize(data, context).rows, data).reduce(
        (n, c) => n + c.amount,
        0,
      ),
    ).toBe(299000);
    expect(expenseSummary(data, context, 'groceries').total).toBe(72000);
    data = cmd(data, 'split', { id: result, parts: [] }).data;
    expect(expenseSummary(data, context, 'groceries').total).toBe(77000);
  });
  it('rejects invalid split sums and amount edits on split parents atomically', () => {
    const { data, result } = cmd(financialData, 'saveTransaction', {
      transaction: tx,
    });
    expect(() =>
      cmd(data, 'split', {
        id: result,
        parts: [
          { categoryId: 'other', amount: '1' },
          { categoryId: 'other', amount: '2' },
        ],
      }),
    ).toThrow(/sum exactly/);
    const split = cmd(data, 'split', {
      id: result,
      parts: [
        { categoryId: 'other', amount: '50' },
        { categoryId: 'groceries', amount: '100' },
      ],
    }).data;
    expect(() =>
      cmd(split, 'saveTransaction', {
        id: result,
        transaction: { ...tx, amount: '-200' },
      }),
    ).toThrow(/Remove splits/);
  });
  it('excludes and restores without duplicate records', () => {
    const before = financialData.transactions.length;
    let d = cmd(financialData, 'exclude', { ids: ['o12'] }).data;
    expect(summarize(d, context).expenses).toBe(275360);
    d = cmd(d, 'restore', { ids: ['o12'] }).data;
    expect(summarize(d, context).expenses).toBe(284000);
    expect(d.transactions).toHaveLength(before);
  });
  it('keeps single transfers neutral while retaining account balance movement', () => {
    const before = summarize(financialData, context),
      t = financialData.transactions.find((t) => t.id === 'o12'),
      d = cmd(financialData, 'saveTransaction', {
        id: t.id,
        transaction: { ...t, type: 'transfer' },
      }).data;
    expect(summarize(d, context).expenses).toBe(275360);
    expect(summarize(d, context).balance).toBe(before.balance);
  });
  it('explicitly pairs opposite accounts without creating fictional entries', () => {
    let a = cmd(financialData, 'saveTransaction', {
      transaction: { ...tx, amount: '-150', categoryId: '' },
    });
    const outgoing = a.result;
    a = cmd(a.data, 'saveTransaction', {
      transaction: {
        ...tx,
        description: 'Incoming',
        type: 'income',
        accountId: 'reserve',
        categoryId: 'income',
        amount: '150',
      },
    });
    const d = cmd(a.data, 'linkTransfer', {
      id: outgoing,
      otherId: a.result,
    }).data;
    expect(summarize(d, context).income).toBe(725000);
    expect(summarize(d, context).expenses).toBe(284000);
    expect(d.transactions).toHaveLength(financialData.transactions.length + 2);
    expect(() => cmd(d, 'exclude', { ids: [outgoing] })).toThrow(/Unlink/);
  });
  it('protects allocated invoice receipts from exclusion, amount and type changes', () => {
    const t = financialData.transactions.find((t) => t.id === 'o2');
    expect(() => cmd(financialData, 'exclude', { ids: ['o2'] })).toThrow(
      /invoice allocations/,
    );
    expect(() =>
      cmd(financialData, 'saveTransaction', {
        id: 'o2',
        transaction: { ...t, amount: 1 },
      }),
    ).toThrow(/invoice allocations/);
    const d = cmd(financialData, 'saveTransaction', {
      id: 'o2',
      transaction: { ...t, notes: 'Verified' },
    }).data;
    expect(d.allocations).toEqual(financialData.allocations);
  });
  it('prevents an excluded receipt from being allocated', () => {
    const d = cmd(financialData, 'exclude', { ids: ['s2'] }).data;
    expect(() =>
      applyIncomeCommand(d, context, 'confirmMatch', { matchId: 'match-1' }),
    ).toThrow(/Existing transaction/);
  });
  it('rejects cross-workspace/currency and viewer mutations', () => {
    expect(() =>
      cmd(
        financialData,
        'exclude',
        { ids: ['o12'] },
        { ...context, workspaceId: 'empty' },
      ),
    ).toThrow();
    expect(() => cmd(financialData, 'exclude', { ids: ['e2'] })).toThrow();
    expect(() =>
      cmd(
        financialData,
        'saveTransaction',
        { transaction: tx },
        { ...context, role: 'viewer' },
      ),
    ).toThrow(/read-only/);
    expect(() =>
      cmd(financialData, 'saveTransaction', {
        transaction: { ...tx, accountId: 'euro' },
      }),
    ).toThrow(/currency/);
  });
  it('bulk validation cannot partially exclude a protected selection', () => {
    const store = createFinancialStore(financialData);
    expect(() =>
      store.command(context, 'expense:exclude', { ids: ['o12', 'o2'] }),
    ).toThrow();
    expect(summarize(store.getSnapshot(), context).expenses).toBe(284000);
  });
  it('combines search type category date status source and workspace filters', () => {
    const rows = transactionRows(financialData, context, {
      search: 'Woolworths',
      type: 'expense',
      status: 'pending',
      source: 'fixture',
      categoryId: 'uncategorized',
      start: '2026-10-19',
      end: '2026-10-19',
    });
    expect(rows.map((t) => t.id)).toEqual(['o12']);
    expect(
      transactionRows(financialData, { ...context, workspaceId: 'empty' }),
    ).toEqual([]);
  });
});
describe('Reviewed imports and duplicates', () => {
  it('commits only reviewed rows once, preserves metadata and does not invent invoice payments', () => {
    const payload = batch(parsed());
    const { data, result } = cmd(financialData, 'confirmImport', payload);
    expect(summarize(data, context).expenses).toBe(299000);
    expect(data.importBatches.find((b) => b.id === result).imported).toBe(1);
    expect(data.payments).toEqual(financialData.payments);
    expect(data.transactions.at(-1).originalDescription).toBe('Shop, local');
    expect(() => cmd(data, 'confirmImport', payload)).toThrow(/already/);
    expect(() =>
      cmd(financialData, 'confirmImport', { ...payload, rows: parsed() }),
    ).toThrow(/Review every/);
  });
  it('flags repeat files and requires explicit duplicate keep or exclude', () => {
    const first = cmd(financialData, 'confirmImport', batch(parsed())).data,
      payload = { ...batch(parsed()), token: 'second' };
    expect(
      duplicateCandidates(first, {
        ...payload.rows[0],
        workspaceId: 'personal',
      }),
    ).toHaveLength(1);
    expect(() => cmd(first, 'confirmImport', payload)).toThrow(/duplicate/);
    payload.rows[0].decision = 'exclude';
    const d = cmd(first, 'confirmImport', payload).data;
    expect(summarize(d, context).expenses).toBe(299000);
    expect(d.importBatches.at(-1).duplicates).toBe(1);
    expect(d.importBatches.at(-1).excluded).toBe(1);
  });
  it('allows intentional Keep Both and preserves reviewed duplicate audit', () => {
    const first = cmd(financialData, 'confirmImport', batch(parsed())).data,
      payload = { ...batch(parsed()), token: 'second' };
    payload.rows[0].duplicateDecision = 'both';
    const { data } = cmd(first, 'confirmImport', payload);
    expect(summarize(data, context).expenses).toBe(314000);
    const t = data.transactions.at(-1),
      original = data.transactions.at(-2);
    const d = cmd(data, 'duplicateDecision', {
      id: t.id,
      decision: 'original',
      originalId: original.id,
    }).data;
    expect(summarize(d, context).expenses).toBe(299000);
    expect(d.transactions.at(-1).duplicateOfId).toBe(original.id);
  });
  it('supports recoverable batch exclusion and restoration', () => {
    const { data, result } = cmd(
      financialData,
      'confirmImport',
      batch(parsed()),
    );
    let d = cmd(data, 'undoBatch', { id: result }).data;
    expect(summarize(d, context).expenses).toBe(284000);
    expect(d.importBatches[0].status).toBe('excluded');
    d = cmd(d, 'restore', { ids: [data.transactions.at(-1).id] }).data;
    expect(summarize(d, context).expenses).toBe(299000);
  });
  it('keeps imported income separate and excludes transfer amounts from spending', () => {
    const rs = parsed(
      'Date,Description,Amount\n2026-10-25,Salary,150.00\n2026-10-26,Transfer,-150.00',
    );
    rs[1].type = 'transfer';
    const d = cmd(financialData, 'confirmImport', batch(rs)).data;
    expect(summarize(d, context).income).toBe(740000);
    expect(summarize(d, context).expenses).toBe(284000);
    expect(d.payments).toEqual(financialData.payments);
  });
});
describe('Category taxonomy and reviewed rules', () => {
  const category = {
    name: 'Household',
    kind: 'expense',
    icon: 'home',
    color: '#E43900',
  };
  it('creates/renames unique workspace categories and preserves IDs/history on archive', () => {
    let { data, result } = cmd(financialData, 'saveCategory', { category });
    expect(() =>
      cmd(data, 'saveCategory', {
        category: { ...category, name: ' HOUSEHOLD ' },
      }),
    ).toThrow(/unique/);
    data = cmd(data, 'saveCategory', {
      id: result,
      category: { ...category, name: 'Household supplies' },
    }).data;
    data = cmd(data, 'archiveCategory', { id: 'groceries' }).data;
    expect(data.transactions.find((t) => t.id === 'o5').categoryId).toBe(
      'groceries',
    );
    expect(() => cmd(data, 'saveTransaction', { transaction: tx })).toThrow(
      /active category/,
    );
  });
  it('separates saving rules from preview and apply; protects manual overrides', () => {
    let d = cmd(financialData, 'saveRule', {
      rule: {
        name: 'Metro match',
        field: 'description',
        operator: 'contains',
        value: 'metro',
        categoryId: 'other',
        priority: 1,
        enabled: true,
      },
    }).data;
    const id = d.categoryRules.at(-1).id;
    expect(d.transactions.find((t) => t.id === 'o12').categoryId).toBe(null);
    let p = rulePreview(d, context, id);
    expect(p[0].conflict).toBe(true);
    expect(p[0].proposed.id).toBe(id);
    d = cmd(d, 'applyRule', { id, ids: ['o12'] }).data;
    expect(d.transactions.find((t) => t.id === 'o12').categoryId).toBe('other');
    expect(() => cmd(d, 'applyRule', { id, ids: ['o12'] })).toThrow(
      /manual\/reviewed/,
    );
  });
  it('edits priority, disables/enables and deletes rules without rewriting history', () => {
    let d = cmd(financialData, 'toggleRule', { id: 'category-rule-1' }).data;
    expect(rulePreview(d, context, 'category-rule-1')).toEqual([]);
    d = cmd(d, 'toggleRule', { id: 'category-rule-1' }).data;
    expect(rulePreview(d, context, 'category-rule-1')).toHaveLength(1);
    const r = d.categoryRules[0];
    d = cmd(d, 'saveRule', { id: r.id, rule: { ...r, priority: 2 } }).data;
    expect(d.categoryRules[0].priority).toBe(2);
    d = cmd(d, 'deleteRule', { id: r.id }).data;
    expect(d.categoryRules).toEqual([]);
    expect(d.transactions).toEqual(financialData.transactions);
  });
});
