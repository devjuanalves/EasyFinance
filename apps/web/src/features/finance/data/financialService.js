import { financialData } from './financialData.js';
export async function getFinancialData({ scenario = 'normal', signal } = {}) {
  await new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, 350);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(new DOMException('Aborted', 'AbortError'));
      },
      { once: true },
    );
  });
  if (scenario === 'error')
    throw new Error('The simulated ledger could not be loaded.');
  return scenarioData(financialData, scenario);
}
export function scenarioData(source, scenario) {
  if (scenario === 'empty')
    return {
      ...source,
      investments: [],
      investmentMovements: [],
      investmentValuations: [],
      investmentEvents: [],
      transactions: [],
      invoices: [],
      invoiceItems: [],
      payments: [],
      allocations: [],
      clients: [],
      bankMatches: [],
      deliveries: [],
      events: [],
      recurringRules: [],
    };
  if (scenario === 'partial')
    return {
      ...source,
      coverageEnd: '2026-10-18',
      transactions: source.transactions.filter((t) => t.date <= '2026-10-18'),
      invoices: source.invoices.filter((i) => i.issuedDate <= '2026-10-18'),
    };
  return source;
}
