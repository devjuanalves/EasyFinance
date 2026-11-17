import { describe, it, expect } from 'vitest';
import {
  financialData as data,
  DEFAULT_FILTERS as filters,
} from '../data/financialData.js';
import {
  summarize,
  previousPeriod,
  validDate,
  chartBuckets,
  calculateSavingsRate,
} from '../data/calculations.js';
import {
  answerQuestion,
  suggestedQuestions,
} from '../../assistant/assistantService.js';
describe('shared financial ledger', () => {
  it('reconciles signed cashflow, category cents, balance, invoices and charts', () => {
    const s = summarize(data, filters);
    expect(s).toMatchObject({
      income: 725000,
      expenses: 284000,
      net: 441000,
      balance: 1441000,
      outstanding: 465000,
    });
    expect(s.savingsRate).toBeCloseTo(60.827586);
    expect(s.categories.reduce((n, c) => n + c.amount, 0)).toBe(s.expenses);
    expect(s.previous).toMatchObject({
      income: 670000,
      expenses: 270000,
      net: 400000,
    });
    expect(chartBuckets(s).reduce((n, b) => n + b.income, 0)).toBe(s.income);
    expect(chartBuckets(s).reduce((n, b) => n + b.expenses, 0)).toBe(
      s.expenses,
    );
    expect(s.days.at(-1).balance).toBe(s.balance);
    expect(s.reviews.uncategorized).toHaveLength(1);
  });
  it('excludes transfer pairs from cashflow but includes individual account movements', () => {
    const without = {
      ...data,
      transactions: data.transactions.filter((t) => t.type !== 'transfer'),
    };
    expect(summarize(without, filters).net).toBe(summarize(data, filters).net);
    expect(summarize(without, filters).balance).toBe(
      summarize(data, filters).balance,
    );
    const account = { ...filters, accountId: 'checking' };
    expect(summarize(data, account).balance).toBe(
      summarize(without, account).balance - 100000,
    );
  });
  it('isolates currencies, participants and empty workspaces', () => {
    expect(summarize(data, { ...filters, currency: 'EUR' })).toMatchObject({
      income: 10000,
      expenses: 2000,
      net: 8000,
      balance: 38000,
    });
    expect(summarize(data, { ...filters, participantId: 'sam' })).toMatchObject(
      { income: 50000, expenses: 88360, balance: null },
    );
    expect(summarize(data, { ...filters, workspaceId: 'empty' })).toMatchObject(
      { income: 0, expenses: 0, net: 0, savingsRate: null },
    );
  });
  it('uses inclusive equal-length comparisons and validates calendar dates', () => {
    expect(previousPeriod({ start: '2026-10-01', end: '2026-10-31' })).toEqual({
      start: '2026-08-31',
      end: '2026-09-30',
    });
    expect(validDate('2026-02-30')).toBe(false);
    expect(validDate('2024-02-29')).toBe(true);
    expect(previousPeriod({ start: 'bad', end: '2026-10-31' })).toBeNull();
    const corrupt = {
      ...data,
      transactions: [
        ...data.transactions,
        {
          ...data.transactions[0],
          id: 'bad',
          date: '2026-10-32',
          amount: 999999,
        },
        {
          ...data.transactions[0],
          id: 'fraction',
          date: '2026-10-31',
          amount: 0.1,
        },
      ],
    };
    expect(summarize(corrupt, filters).income).toBe(725000);
  });
  it('handles no activity, zero denominators, negative savings and incomplete coverage', () => {
    const s = summarize(data, { ...filters, periodId: 'august' });
    expect(s).toMatchObject({
      income: 0,
      expenses: 0,
      savingsRate: null,
      previous: null,
      balance: 600000,
    });
    expect(calculateSavingsRate(100, 150)).toBe(-50);
    expect(calculateSavingsRate(0, 150)).toBeNull();
    expect(
      summarize(
        {
          ...data,
          coverageEnd: '2026-10-18',
          transactions: data.transactions.filter((t) => t.date <= '2026-10-18'),
        },
        filters,
      ),
    ).toMatchObject({ complete: false, previous: null, balance: null });
  });
  it('derives every assistant answer from exactly the dashboard summary', () => {
    for (const question of suggestedQuestions) {
      expect(answerQuestion(question, data, filters).summary).toEqual(
        summarize(data, filters),
      );
    }
    expect(answerQuestion('Tell me a joke', data, filters).text).toContain(
      'isn’t supported',
    );
    expect(
      answerQuestion('What did I spend?', data, { ...filters, currency: 'EUR' })
        .text,
    ).toContain('20.00');
  });
});
