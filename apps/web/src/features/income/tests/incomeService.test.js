import { describe, it, expect } from 'vitest';
import {
  financialData,
  DEFAULT_FILTERS,
} from '../../finance/data/financialData.js';
import { summarize } from '../../finance/data/calculations.js';
import { answerQuestion } from '../../assistant/assistantService.js';
import {
  invoiceTotals,
  invoiceStatus,
} from '../../finance/data/invoiceMath.js';
import {
  applyIncomeCommand,
  blankInvoice,
  incomeSummary,
  createFinancialStore,
} from '../incomeService.js';
const context = { ...DEFAULT_FILTERS, role: 'owner' };
const command = (data, action, payload, ctx = context) =>
  applyIncomeCommand(data, ctx, action, payload);
const validDraft = () => ({
  ...blankInvoice(financialData, context, 'acme'),
  items: [
    {
      description: 'Consulting',
      quantity: '2.5',
      unit: 'hours',
      unitPrice: '120',
      taxRate: '10',
    },
  ],
  discount: '10',
});
describe('invoice decimal arithmetic', () => {
  it('supports fractional quantities and prices with half-up cent rounding', () => {
    expect(
      invoiceTotals([{ quantity: '1.25', unitPrice: '80.0050', taxRate: '0' }])
        .total,
    ).toBe(10001);
  });
  it('discounts before configurable tax and reconciles line allocations', () => {
    const s = invoiceTotals(validDraft().items, '10');
    expect(s).toMatchObject({
      subtotal: 30000,
      discount: 1000,
      tax: 2900,
      total: 31900,
    });
    const split = invoiceTotals(
      [
        { quantity: '1', unitPrice: '0.01', taxRate: '10' },
        { quantity: '1', unitPrice: '0.02', taxRate: '10' },
      ],
      '0.02',
    );
    expect(split.lines.reduce((n, l) => n + l.discount, 0)).toBe(2);
    expect(split.total).toBe(1);
  });
  it.each([
    { quantity: '0', unitPrice: '10' },
    { quantity: '1', unitPrice: '-1' },
    { quantity: '1.12345', unitPrice: '10' },
    { quantity: '1', unitPrice: '10', taxRate: '101' },
  ])('rejects invalid numeric item %j', (item) =>
    expect(() => invoiceTotals([item])).toThrow(),
  );
  it('rejects discount over subtotal and empty items', () => {
    expect(() => invoiceTotals(validDraft().items, '301')).toThrow(/Discount/);
    expect(() => invoiceTotals([])).toThrow(/at least/);
  });
});
describe('central income lifecycle', () => {
  it('distinguishes received, billed, allocated, outstanding and overdue without changing Block 2 values', () => {
    expect(incomeSummary(financialData, context)).toMatchObject({
      received: 725000,
      invoiced: 700000,
      paid: 235000,
      outstanding: 465000,
      overdue: 465000,
    });
    expect(summarize(financialData, context).income).toBe(725000);
  });
  it('saves and edits a draft without adding income or receivables', () => {
    const saved = command(financialData, 'saveInvoice', {
      draft: validDraft(),
    });
    expect(
      saved.data.invoices.find((i) => i.id === saved.result),
    ).toMatchObject({ total: 31900, status: 'draft', paid: 0 });
    expect(incomeSummary(saved.data, context).invoiced).toBe(700000);
    expect(summarize(saved.data, context).income).toBe(725000);
    const next = command(saved.data, 'saveInvoice', {
      id: saved.result,
      draft: { ...validDraft(), notes: 'Updated' },
    });
    expect(next.data.events.at(-1).text).toBe('Draft updated');
  });
  it('validates required fields, unique numbering, dates and client currency', () => {
    for (const patch of [
      { clientId: '' },
      { number: 'INV-2026-001' },
      { dueDate: '2026-02-30' },
      { currency: 'EUR', accountId: 'euro' },
      { items: [{ description: '', quantity: '1', unitPrice: '1' }] },
    ])
      expect(() =>
        command(financialData, 'saveInvoice', {
          draft: { ...validDraft(), ...patch },
        }),
      ).toThrow();
  });
  it('prepares a recipient-confirmed invoice without claiming delivery and locks editing', () => {
    const saved = command(financialData, 'saveInvoice', {
      draft: validDraft(),
    });
    expect(() =>
      command(saved.data, 'prepareSend', {
        id: saved.result,
        recipient: 'bad',
      }),
    ).toThrow(/email/);
    const prepared = command(saved.data, 'prepareSend', {
      id: saved.result,
      recipient: 'review@example.com',
    });
    expect(
      prepared.data.invoices.find((i) => i.id === saved.result).status,
    ).toBe('prepared');
    expect(prepared.data.deliveries.at(-1).status).toBe('prepared-not-sent');
    expect(() =>
      command(prepared.data, 'saveInvoice', {
        id: saved.result,
        draft: validDraft(),
      }),
    ).toThrow(/Only draft/);
  });
  it('records partial and full payments and updates Home and Dashboard once', () => {
    let result = command(financialData, 'recordPayment', {
      id: 'inv2',
      amount: '100',
      date: '2026-10-31',
      method: 'bank',
      reference: 'test',
    });
    expect(result.data.invoices.find((i) => i.id === 'inv2').paid).toBe(10000);
    expect(summarize(result.data, context).income).toBe(735000);
    expect(answerQuestion('income', result.data, context).summary.income).toBe(
      735000,
    );
    result = command(result.data, 'recordPayment', {
      id: 'inv2',
      amount: '3400',
      date: '2026-10-31',
      method: 'cash',
    });
    expect(result.data.invoices.find((i) => i.id === 'inv2')).toMatchObject({
      paid: 350000,
      status: 'paid',
    });
    expect(summarize(result.data, context).income).toBe(1075000);
  });
  it('rejects overpayments, zero amounts, invalid dates, currency mismatch and transfers', () => {
    for (const patch of [
      { amount: '3500.01' },
      { amount: '0' },
      { date: '2026-02-30' },
      { date: '2026-11-01' },
      { transactionId: 'e1' },
      { transactionId: 't2' },
    ])
      expect(() =>
        command(financialData, 'recordPayment', {
          id: 'inv2',
          amount: '1',
          date: '2026-10-31',
          method: 'bank',
          ...patch,
        }),
      ).toThrow();
  });
  it('confirms a reviewed bank match without counting the transaction again and rejects duplicates', () => {
    const linked = command(financialData, 'confirmMatch', {
      matchId: 'match-1',
    });
    expect(linked.data.invoices.find((i) => i.id === 'inv2').paid).toBe(200000);
    expect(summarize(linked.data, context).income).toBe(725000);
    expect(linked.data.transactions).toHaveLength(
      financialData.transactions.length,
    );
    expect(() =>
      command(linked.data, 'confirmMatch', { matchId: 'match-1' }),
    ).toThrow();
    expect(() =>
      command(linked.data, 'recordPayment', {
        id: 'inv2',
        amount: '1',
        transactionId: 's2',
      }),
    ).toThrow(/already allocated/);
  });
  it('supports residual allocation across invoices without exceeding a payment', () => {
    const first = command(financialData, 'recordPayment', {
      id: 'inv2',
      amount: '1000',
      transactionId: 's2',
    });
    const second = command(first.data, 'recordPayment', {
      id: 'inv3',
      amount: '1000',
      transactionId: 's2',
    });
    expect(
      second.data.allocations
        .filter((a) => a.paymentId === 'pay-s2')
        .reduce((n, a) => n + a.amount, 0),
    ).toBe(200000);
    expect(summarize(second.data, context).income).toBe(725000);
  });
  it('dismisses a suggestion without modifying payments', () => {
    const result = command(financialData, 'dismissMatch', { id: 'match-1' });
    expect(result.data.bankMatches[0].status).toBe('dismissed');
    expect(result.data.allocations).toEqual(financialData.allocations);
  });
  it('duplicates paid invoices into uniquely numbered drafts without payment history', () => {
    const result = command(financialData, 'duplicateInvoice', { id: 'inv1' }),
      invoice = result.data.invoices.find((i) => i.id === result.result);
    expect(invoice).toMatchObject({
      status: 'draft',
      paid: 0,
      historicalDelivery: false,
    });
    expect(invoice.number).not.toBe('INV-2026-001');
    expect(
      result.data.allocations.some((a) => a.invoiceId === invoice.id),
    ).toBe(false);
    expect(summarize(result.data, context).income).toBe(725000);
  });
  it('cancels unpaid invoices, excludes their receivables, and blocks paid cancellation', () => {
    expect(() =>
      command(financialData, 'cancelInvoice', { id: 'inv1' }),
    ).toThrow(/payments/);
    const result = command(financialData, 'cancelInvoice', { id: 'inv2' });
    expect(summarize(result.data, context).outstanding).toBe(115000);
    expect(() =>
      command(result.data, 'prepareSend', {
        id: 'inv2',
        recipient: 'a@b.test',
      }),
    ).toThrow(/Cancelled/);
  });
  it('keeps one status with overdue derived at a fixed sample date', () => {
    const invoice = {
      lifecycle: 'issued',
      paid: 10,
      total: 100,
      dueDate: '2026-11-01',
    };
    expect(invoiceStatus(invoice)).toBe('partial');
    expect(invoiceStatus({ ...invoice, dueDate: '2026-10-30' })).toBe(
      'overdue',
    );
    expect(invoiceStatus({ ...invoice, paid: 100 })).toBe('paid');
  });
  it('combines client/status/search/period/account/currency and workspace filters', () => {
    expect(
      incomeSummary(financialData, context, {
        clientId: 'acme',
        status: 'paid',
        search: '001',
      }).invoices.map((i) => i.id),
    ).toEqual(['inv1']);
    expect(
      incomeSummary(financialData, { ...context, currency: 'EUR' }).received,
    ).toBe(10000);
    expect(
      incomeSummary(financialData, { ...context, accountId: 'checking' })
        .received,
    ).toBe(490000);
    expect(
      incomeSummary(financialData, { ...context, periodId: 'august' }).received,
    ).toBe(0);
    expect(
      incomeSummary(financialData, { ...context, workspaceId: 'empty' })
        .invoices,
    ).toEqual([]);
  });
  it('enforces workspace, role and scenario boundaries for writes', () => {
    for (const ctx of [
      { ...context, workspaceId: 'empty' },
      { ...context, role: 'viewer' },
      { ...context, scenario: 'partial' },
    ])
      expect(() =>
        command(financialData, 'cancelInvoice', { id: 'inv2' }, ctx),
      ).toThrow();
  });
});
describe('clients and recurring drafts', () => {
  const newClient = {
    type: 'business',
    name: 'New client',
    businessName: 'New Co',
    email: 'new@example.com',
    defaultCurrency: 'AUD',
    paymentTerms: '14',
  };
  it('validates, creates and edits a client without duplicates', () => {
    expect(() =>
      command(financialData, 'saveClient', {
        client: { ...newClient, email: 'invalid' },
      }),
    ).toThrow(/email/);
    const saved = command(financialData, 'saveClient', { client: newClient });
    const edited = command(saved.data, 'saveClient', {
      id: saved.result,
      client: { ...newClient, name: 'Updated client' },
    });
    expect(edited.data.clients).toHaveLength(5);
    expect(edited.data.clients.at(-1).name).toBe('Updated client');
    expect(blankInvoice(edited.data, context, saved.result).clientId).toBe(
      saved.result,
    );
  });
  it('archives clients without deleting historical invoices or changing document snapshots', () => {
    const archived = command(financialData, 'archiveClient', { id: 'acme' });
    expect(archived.data.invoices).toEqual(financialData.invoices);
    expect(archived.data.allocations).toEqual(financialData.allocations);
    expect(blankInvoice(archived.data, context, 'acme').clientId).toBe('');
  });
  it('saves a review template and prepares only one due draft per cycle', () => {
    const saved = command(financialData, 'saveTemplate', {
      template: {
        ...validDraft(),
        name: 'Monthly retainer',
        frequency: 'monthly',
        nextDate: '2026-10-31',
      },
    });
    expect(saved.data.invoices).toHaveLength(financialData.invoices.length);
    const prepared = command(saved.data, 'prepareRecurring', {
      id: saved.result,
    });
    expect(prepared.data.invoices.at(-1).status).toBe('draft');
    expect(summarize(prepared.data, context).income).toBe(725000);
    expect(() =>
      command(prepared.data, 'prepareRecurring', { id: saved.result }),
    ).toThrow(/not due/);
  });
  it('isolates mutable session stores and notifies subscribers', () => {
    const a = createFinancialStore(financialData),
      b = createFinancialStore(financialData);
    let notifications = 0;
    const unsubscribe = a.subscribe(() => notifications++);
    a.command(context, 'archiveClient', { id: 'acme' });
    expect(notifications).toBe(1);
    expect(b.getSnapshot().clients[0].archived).toBe(false);
    unsubscribe();
  });
});
