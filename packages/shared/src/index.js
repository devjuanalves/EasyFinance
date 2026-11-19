export const API_HEALTH_PATH = '/api/health';

// One ledger definition for browser Number cents and server BigInt minor units.
// Split children are classifications, never additional cash entries.
export function cashTotals(
  rows,
  {
    amount = (row) => row.amount,
    excluded = (row) => row.excluded,
    zero = 0,
  } = {},
) {
  let income = zero,
    expenses = zero;
  for (const row of rows) {
    if (excluded(row)) continue;
    if (row.type === 'income') income += amount(row);
    if (row.type === 'expense') expenses -= amount(row);
  }
  return { income, expenses, net: income - expenses };
}
