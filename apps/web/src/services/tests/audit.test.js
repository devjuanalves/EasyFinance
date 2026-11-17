import { expect, it } from 'vitest';
import { csvText } from '../csvExport.js';
import { invoiceTotals } from '../../features/finance/data/invoiceMath.js';

it.each([
  '=1+1',
  '+cmd',
  '-cmd',
  '@SUM(A1)',
  '  =1+1',
  '\n=1+1',
  '\ttext',
  '\rtext',
])(
  'neutralizes spreadsheet formula prefix %j without discarding content',
  (value) => {
    expect(csvText([[value]])).toBe('\uFEFF"\'' + value + '"');
  },
);
it('preserves CSV quotes, commas, newlines and ordinary text', () => {
  expect(csvText([['a,"b"\nc', null, ' ordinary']])).toBe(
    '\uFEFF"a,""b""\nc",""," ordinary"',
  );
});
it('does not allocate discount residual to a free invoice line', () => {
  const result = invoiceTotals(
    [
      { quantity: '1', unitPrice: '0.01', taxRate: '100' },
      { quantity: '1', unitPrice: '0.01', taxRate: '100' },
      { quantity: '1', unitPrice: '0', taxRate: '100' },
    ],
    '0.01',
  );
  expect(
    result.lines.every((line) => line.discount <= line.base && line.total >= 0),
  ).toBe(true);
  expect(result).toMatchObject({ subtotal: 2, discount: 1, tax: 1, total: 2 });
});
it('bounds discount allocations and reconciles every cent across small mixed-tax lines', () => {
  for (let discount = 0; discount <= 11; discount++) {
    const result = invoiceTotals(
      [1, 2, 3, 5, 0].map((n) => ({
        quantity: '1',
        unitPrice: (n / 100).toFixed(2),
        taxRate: '50',
      })),
      (discount / 100).toFixed(2),
    );
    expect(
      result.lines.every(
        (line) =>
          line.discount >= 0 && line.discount <= line.base && line.tax >= 0,
      ),
    ).toBe(true);
    expect(result.lines.reduce((sum, line) => sum + line.discount, 0)).toBe(
      discount,
    );
    expect(result.lines.reduce((sum, line) => sum + line.total, 0)).toBe(
      result.total,
    );
  }
});

it('preserves negative numeric amounts and Unicode without mutating input records', () => {
  const rows = [['-2840.00', -12.5, 'José 東京 €', '  @SUM(A1)', '-1+2']];
  const original = structuredClone(rows);
  expect(csvText(rows)).toBe(
    '\uFEFF"-2840.00","-12.5","José 東京 €","\'  @SUM(A1)","\'-1+2"',
  );
  expect(rows).toEqual(original);
});
it('fully discounts mixed-tax fractional invoice items with zero total and tax', () => {
  const items = [
    { quantity: '1.25', unitPrice: '80.005', taxRate: '10' },
    { quantity: '0.5', unitPrice: '0.02', taxRate: '0' },
    { quantity: '1', unitPrice: '0', taxRate: '100' },
  ];
  const result = invoiceTotals(items, '100.02');
  expect(result).toMatchObject({
    subtotal: 10002,
    discount: 10002,
    tax: 0,
    total: 0,
  });
  expect(
    result.lines.every(
      (line) => line.total === 0 && line.discount === line.base,
    ),
  ).toBe(true);
});
