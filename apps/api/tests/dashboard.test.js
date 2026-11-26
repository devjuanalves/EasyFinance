import { describe, it, expect } from 'vitest';
import { summarizeCash } from '../src/services/dashboard.js';
import { dashboardFilters } from '../src/validation/dashboard.js';
describe('exact reporting calculations', () => {
  it('keeps large cents exact', () => {
    expect(
      summarizeCash([{ type: 'income', amountMinor: '90071992547409910' }])
        .incomeMinor,
    ).toBe('90071992547409910');
  });
  it('classifies splits without duplicating their parent', () => {
    const rows = [
      {
        type: 'expense',
        amountMinor: '-1000',
        categoryId: 'parent',
        TransactionSplit_transaction: [
          { categoryId: 'a', amountMinor: '-400' },
          { categoryId: 'b', amountMinor: '-600' },
        ],
      },
    ];
    expect(summarizeCash(rows).expenseMinor).toBe('1000');
    expect(summarizeCash(rows, 'a').expenseMinor).toBe('400');
  });
  it('omits transfers and excluded rows', () => {
    expect(
      summarizeCash([
        { type: 'transfer', amountMinor: '-500' },
        { type: 'expense', amountMinor: '-100', excludedAt: new Date() },
      ]).netMinor,
    ).toBe('0');
  });
  it('handles negative fractional savings and no income', () => {
    expect(
      summarizeCash([
        { type: 'income', amountMinor: '1000' },
        { type: 'expense', amountMinor: '-1005' },
      ]).savingsRate,
    ).toBe('-0.50');
    expect(summarizeCash([]).savingsRate).toBe(null);
  });
  it('rejects invalid and excessive date ranges', () => {
    expect(() =>
      dashboardFilters({
        currency: 'AUD',
        start: '2026-02-30',
        end: '2026-03-01',
      }),
    ).toThrow();
    expect(() =>
      dashboardFilters({
        currency: 'AUD',
        start: '2020-01-01',
        end: '2026-01-01',
      }),
    ).toThrow();
  });
});
