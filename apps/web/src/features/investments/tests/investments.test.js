import { describe, it, expect } from 'vitest';
import {
  financialData,
  DEFAULT_FILTERS,
} from '../../finance/data/financialData.js';
import { summarize } from '../../finance/data/calculations.js';
import { scenarioData } from '../../finance/data/financialService.js';
import { createFinancialStore } from '../../income/incomeService.js';
import { answerQuestion } from '../../assistant/assistantService.js';
import {
  applyInvestmentCommand,
  blankInvestment,
} from '../investmentService.js';
import {
  decimal,
  cents,
  initialAmounts,
  positionAt,
  portfolio,
  portfolioHistory,
} from '../investmentMath.js';
const context = { ...DEFAULT_FILTERS, role: 'owner' };
const cmd = (data, action, payload, c = context) =>
  applyInvestmentCommand(data, c, action, payload);
const asset = (d, id = 'etf') => d.investments.find((i) => i.id === id);
const pos = (d, id = 'etf') => positionAt(d, asset(d, id));
const movement = (type, extra = {}) => ({
  date: '2026-10-20',
  type,
  currency: 'AUD',
  quantity: '10',
  unitPrice: '50',
  amount: '100',
  fee: '0',
  notes: 'Test activity',
  ...extra,
});
const record = (d, type, extra = {}, id = 'etf') =>
  cmd(d, 'recordMovement', { id, form: movement(type, extra) }).data;
const create = (extra = {}) =>
  cmd(financialData, 'create', {
    form: {
      ...blankInvestment(financialData, context),
      name: 'Test asset',
      quantity: '2.5',
      unitPrice: '10.125',
      fee: '0.10',
      estimatedValue: '30',
      ...extra,
    },
  });
describe('Investment precision and reporting', () => {
  it('rounds products half-up to cents and preserves eight decimal units', () => {
    expect(
      initialAmounts({
        assetType: 'Cryptocurrency',
        quantity: '0.000125',
        unitPrice: '80000',
        fee: '0.25',
      }),
    ).toEqual({ amount: 1000, fee: 25, costBasis: 1025 });
    expect(
      initialAmounts({
        assetType: 'ETFs',
        quantity: '2.5',
        unitPrice: '10.125',
        fee: '0.10',
      }),
    ).toEqual({ amount: 2531, fee: 10, costBasis: 2541 });
    expect(decimal('0.00000001')).toBe(1n);
    expect(cents('0')).toBe(0);
  });
  it.each(['', '-1', '1e2', 'NaN', '1.123456789'])(
    'rejects invalid decimal %s',
    (v) => expect(() => decimal(v)).toThrow(),
  );
  it('rejects excessive financial values and precision', () => {
    expect(() => cents('0.001')).toThrow();
    expect(() =>
      initialAmounts({
        assetType: 'ETFs',
        quantity: '1000000000',
        unitPrice: '1000000000',
        fee: '0',
      }),
    ).toThrow();
  });
  it('reconciles fixture costs, values, allocation and cash baseline', () => {
    const p = portfolio(financialData, context);
    expect(p.basis).toBe(2000000);
    expect(p.currentValue).toBe(2209000);
    expect(p.unrealized).toBe(209000);
    expect(p.allocation.reduce((n, a) => n + a.value, 0)).toBe(p.currentValue);
    expect(summarize(financialData, context)).toMatchObject({
      income: 725000,
      expenses: 284000,
      balance: 1441000,
    });
    expect(pos(financialData).averageCost).toBe('45');
  });
  it('filters account, asset type, reporting dates, currencies and workspaces', () => {
    expect(
      portfolio(financialData, context, { accountId: 'deposit-aud' })
        .currentValue,
    ).toBe(518000);
    expect(
      portfolio(financialData, context, { assetType: 'Cryptocurrency' })
        .holdings,
    ).toHaveLength(1);
    expect(
      portfolio(financialData, context, { end: '2026-08-31' }).currentValue,
    ).toBe(2000000);
    expect(
      portfolio(financialData, { ...context, currency: 'EUR' }).currentValue,
    ).toBe(105000);
    expect(
      portfolio(financialData, { ...context, workspaceId: 'empty' }).holdings,
    ).toHaveLength(0);
    expect(
      portfolio(financialData, { ...context, currency: 'all' }),
    ).toMatchObject({ mixed: true, currentValue: null, basis: null });
  });
  it('uses dated values only and does not fabricate daily history', () => {
    const history = portfolioHistory(financialData, context, {
      start: '2026-08-01',
      end: '2026-10-31',
    });
    expect(history.map((r) => r.date)).toEqual([
      '2026-08-10',
      '2026-08-31',
      '2026-09-30',
      '2026-10-01',
      '2026-10-18',
    ]);
    expect(history[0].value).toBeNull();
    expect(history.at(-1).value).toBe(2209000);
  });
  it('distinguishes missing and deliberate zero valuation', () => {
    let c = create({ estimatedValue: '' });
    expect(pos(c.data, c.result).currentValue).toBeNull();
    expect(portfolio(c.data, context).currentValue).toBeNull();
    c = create({ estimatedValue: '0' });
    expect(pos(c.data, c.result).currentValue).toBe(0);
    expect(pos(c.data, c.result).unrealized).toBe(-2541);
  });
  it('separates empty and partial sample portfolios', () => {
    expect(
      portfolio(scenarioData(financialData, 'empty'), context).holdings,
    ).toHaveLength(0);
    expect(scenarioData(financialData, 'partial').coverageEnd).toBe(
      '2026-10-18',
    );
  });
});
describe('Investment history and mutations', () => {
  it('creates a position, initial movement, supplied valuation and stable unique IDs', () => {
    const c = create();
    expect(pos(c.data, c.result)).toMatchObject({
      quantity: '2.5',
      basis: 2541,
      currentValue: 3000,
    });
    expect(c.data.transactions).toEqual(financialData.transactions);
    const c2 = cmd(c.data, 'create', {
      form: {
        ...blankInvestment(c.data, context),
        name: 'Second',
        quantity: '1',
        unitPrice: '1',
      },
    });
    expect(c2.result).not.toBe(c.result);
    expect(c.result).not.toContain('NaN');
  });
  it.each([
    { name: '' },
    { quantity: '0' },
    { date: '2026-11-01' },
    { date: '2026-02-30' },
    { currency: 'USD' },
    { investmentAccountId: 'foreign' },
    { fee: '-1' },
    { assetType: 'Unknown' },
    { valuedAt: '2026-08-01' },
  ])('rejects invalid create input %j', (extra) =>
    expect(() => create(extra)).toThrow(),
  );
  it('creates principal-based and custom positions without a ticker', () => {
    for (const assetType of ['Fixed Income', 'Other', 'Custom']) {
      const c = create({
        assetType,
        customType: 'Art',
        symbol: '',
        amount: '100',
        fee: '0',
        estimatedValue: '',
      });
      expect(pos(c.data, c.result)).toMatchObject({
        basis: 10000,
        quantity: '0',
        currentValue: null,
      });
    }
  });
  it('adds same-currency account metadata without bank transactions', () => {
    const c = cmd(financialData, 'createAccount', {
      name: 'New account',
      institution: 'Manual institution',
      currency: 'USD',
    });
    expect(c.data.investmentAccounts.at(-1).currency).toBe('USD');
    expect(c.data.transactions).toEqual(financialData.transactions);
    expect(() =>
      cmd(financialData, 'createAccount', {
        name: '',
        institution: 'x',
        currency: 'AUD',
      }),
    ).toThrow();
  });
  it('edits metadata without changing histories', () => {
    const i = asset(financialData);
    const c = cmd(financialData, 'update', {
      id: i.id,
      form: { ...i, name: 'Renamed' },
    });
    expect(c.data.investmentMovements).toEqual(
      financialData.investmentMovements,
    );
    expect(c.data.investmentValuations).toEqual(
      financialData.investmentValuations,
    );
    expect(asset(c.data).name).toBe('Renamed');
    expect(() =>
      cmd(financialData, 'update', {
        id: i.id,
        form: { ...i, assetType: 'Other' },
      }),
    ).toThrow();
  });
  it('adds purchases and contributions to cost, invalidating stale position values', () => {
    let d = record(financialData, 'buy', { fee: '2' });
    expect(pos(d)).toMatchObject({
      quantity: '110',
      basis: 500200,
      currentValue: null,
    });
    d = record(d, 'contribution', {
      date: '2026-10-21',
      quantity: '2.5',
      unitPrice: '40',
    });
    expect(pos(d)).toMatchObject({ quantity: '112.5', basis: 510200 });
    expect(d.transactions).toEqual(financialData.transactions);
  });
  it('calculates sales from net proceeds minus weighted-average disposed basis', () => {
    const d = record(financialData, 'sell', {
      quantity: '20',
      unitPrice: '60',
      fee: '5',
    });
    expect(pos(d)).toMatchObject({
      quantity: '80',
      basis: 360000,
      realized: 29500,
      currentValue: null,
    });
  });
  it('retains exact cost residual through a complete sale', () => {
    const c = create({
      quantity: '3',
      unitPrice: '0.33333333',
      fee: '0',
      estimatedValue: '',
    });
    let d = record(
      c.data,
      'sell',
      { date: '2026-10-31', quantity: '1', unitPrice: '1' },
      c.result,
    );
    expect(pos(d, c.result).basis).toBe(67);
    d = record(
      d,
      'sell',
      { date: '2026-10-31', quantity: '2', unitPrice: '1' },
      c.result,
    );
    expect(pos(d, c.result)).toMatchObject({
      basis: 0,
      quantity: '0',
      closed: true,
      currentValue: 0,
      realized: 200,
    });
  });
  it('rejects overselling and invalid distribution fees', () => {
    expect(() => record(financialData, 'sell', { quantity: '101' })).toThrow(
      /available quantity/,
    );
    expect(() =>
      record(financialData, 'dividend', { amount: '1', fee: '2' }),
    ).toThrow(/Fee/);
  });
  it('treats principal withdrawals as return of capital, not profit', () => {
    const d = record(
      financialData,
      'withdrawal',
      { amount: '1000', fee: '2' },
      'deposit',
    );
    expect(pos(d, 'deposit')).toMatchObject({
      basis: 400000,
      realized: 0,
      standaloneFees: 200,
      currentValue: null,
    });
    expect(() =>
      record(d, 'withdrawal', { amount: '4000.01' }, 'deposit'),
    ).toThrow(/principal/);
  });
  it('supports in-kind quantity withdrawals without realized gain', () => {
    const d = record(financialData, 'withdrawal', { quantity: '20', fee: '1' });
    expect(pos(d)).toMatchObject({
      quantity: '80',
      basis: 360000,
      realized: 0,
      standaloneFees: 100,
    });
  });
  it('separates dividend, interest and standalone fees from appreciation', () => {
    let d = record(financialData, 'dividend', { amount: '20', fee: '1' });
    d = record(d, 'interest', { amount: '10' });
    d = record(d, 'fee', { amount: '2' });
    expect(pos(d)).toMatchObject({
      distributions: 12140,
      standaloneFees: 200,
      unrealized: 62000,
      currentValue: 512000,
      totalReturn: 73940,
    });
    expect(d.transactions).toEqual(financialData.transactions);
  });
  it('adds dated valuations without changing cash and refuses incompatible currencies', () => {
    let d = record(financialData, 'buy');
    d = cmd(d, 'valuation', {
      id: 'etf',
      form: { currency: 'AUD', valuedAt: '2026-10-21', estimatedValue: '6000' },
    }).data;
    expect(pos(d).currentValue).toBe(600000);
    expect(d.investmentValuations).toHaveLength(
      financialData.investmentValuations.length + 1,
    );
    expect(d.transactions).toEqual(financialData.transactions);
    expect(() =>
      cmd(d, 'valuation', {
        id: 'etf',
        form: { currency: 'USD', valuedAt: '2026-10-21', estimatedValue: '1' },
      }),
    ).toThrow(/currency/);
  });
  it('rejects positive valuations for fully sold positions', () => {
    const d = record(financialData, 'sell', { quantity: '100' });
    expect(() =>
      cmd(d, 'valuation', {
        id: 'etf',
        form: { currency: 'AUD', valuedAt: '2026-10-21', estimatedValue: '1' },
      }),
    ).toThrow(/closed/);
  });
  it('rejects deletion or correction that makes later sales impossible, atomically', () => {
    const d = record(financialData, 'sell', { quantity: '80' }),
      before = structuredClone(d);
    expect(() =>
      cmd(d, 'deleteMovement', {
        id: 'etf',
        movementId: 'etf-initial',
        confirmed: true,
      }),
    ).toThrow(/available quantity/);
    expect(() =>
      cmd(d, 'editMovement', {
        id: 'etf',
        movementId: 'etf-initial',
        confirmed: true,
        form: movement('buy', { date: '2026-08-10', quantity: '50' }),
      }),
    ).toThrow(/available quantity/);
    expect(d).toEqual(before);
  });
  it('corrects and soft-deletes activities while preserving audit snapshots', () => {
    let d = record(financialData, 'buy');
    const m = d.investmentMovements.at(-1);
    d = cmd(d, 'editMovement', {
      id: 'etf',
      movementId: m.id,
      confirmed: true,
      form: movement('buy', { quantity: '5', unitPrice: '40' }),
    }).data;
    expect(pos(d).quantity).toBe('105');
    d = cmd(d, 'deleteMovement', {
      id: 'etf',
      movementId: m.id,
      confirmed: true,
    }).data;
    expect(pos(d).quantity).toBe('100');
    expect(d.investmentMovements.find((x) => x.id === m.id).deleted).toBe(true);
    expect(d.investmentEvents.at(-1).before.quantity).toBe('5');
    expect(() =>
      cmd(d, 'deleteMovement', { id: 'etf', movementId: 'etf-initial' }),
    ).toThrow(/Confirm/);
  });
  it('invalidates later valuations after backdated financial corrections', () => {
    const d = cmd(financialData, 'editMovement', {
      id: 'etf',
      movementId: 'etf-initial',
      confirmed: true,
      form: movement('buy', { date: '2026-08-10', quantity: '99' }),
    }).data;
    expect(pos(d).currentValue).toBeNull();
  });
  it('preserves older valuations after confirmed valuation deletion', () => {
    const d = cmd(financialData, 'deleteValuation', {
      id: 'etf',
      valuationId: 'etf-2026-10-18',
      confirmed: true,
    }).data;
    expect(pos(d).valuation.valuedAt).toBe('2026-09-30');
    expect(d.investmentEvents.at(-1).before.estimatedValue).toBe(512000);
  });
  it('enforces workspace, role, scenario and currency boundaries', () => {
    for (const c of [
      { ...context, workspaceId: 'empty' },
      { ...context, role: 'viewer' },
      { ...context, scenario: 'partial' },
    ])
      expect(() =>
        cmd(
          financialData,
          'recordMovement',
          { id: 'etf', form: movement('buy') },
          c,
        ),
      ).toThrow();
    expect(() => record(financialData, 'buy', { currency: 'EUR' })).toThrow();
  });
  it('publishes one shared snapshot and reconciles assistant/portfolio without cash duplication', () => {
    const store = createFinancialStore(financialData);
    store.command(context, 'investment:valuation', {
      id: 'etf',
      form: { currency: 'AUD', valuedAt: '2026-10-31', estimatedValue: '6000' },
    });
    const d = store.getSnapshot();
    expect(portfolio(d, context).currentValue).toBe(2297000);
    expect(
      answerQuestion('What is my current portfolio value?', d, context)
        .portfolio.currentValue,
    ).toBe(2297000);
    expect(
      answerQuestion('Which investment has the largest allocation?', d, context)
        .text,
    ).toContain('Broad Market ETF');
    expect(summarize(d, context)).toMatchObject({
      income: 725000,
      expenses: 284000,
      balance: 1441000,
    });
    expect(d.payments).toEqual(financialData.payments);
    expect(d.allocations).toEqual(financialData.allocations);
  });
});
it('keeps all-currency reporting unaggregated even when another filter leaves one denomination', () => {
  const p = portfolio(
    financialData,
    { ...context, currency: 'all' },
    { assetType: 'ETFs' },
  );
  expect(p.currentValue).toBeNull();
  expect(p.allocation).toEqual([]);
  expect(p.mixed).toBe(true);
});
