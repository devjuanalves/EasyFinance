import { validDate } from './dates.js';
export { validDate } from './dates.js';
import { billable } from './invoiceMath.js';
import { periods } from './financialData.js';
const DAY = 86400000;
export function money(cents, currency = 'AUD') {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency,
    currencyDisplay: 'code',
  }).format(cents / 100);
}
export function dateLabel(value) {
  return validDate(value)
    ? new Intl.DateTimeFormat('en-AU', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        timeZone: 'UTC',
      }).format(new Date(value + 'T00:00:00Z'))
    : 'Date unavailable';
}
export function previousPeriod({ start, end }) {
  if (!validDate(start) || !validDate(end) || end < start) return null;
  const startMs = Date.parse(start),
    days = (Date.parse(end) - startMs) / DAY + 1;
  return {
    start: new Date(startMs - days * DAY).toISOString().slice(0, 10),
    end: new Date(startMs - DAY).toISOString().slice(0, 10),
  };
}
export function calculateIncome(rows = []) {
  return rows
    .filter((t) => t.type === 'income' && !t.excluded)
    .reduce((sum, t) => sum + t.amount, 0);
}
export function calculateExpenses(rows = []) {
  return rows
    .filter((t) => t.type === 'expense' && !t.excluded)
    .reduce((sum, t) => sum - t.amount, 0);
}
export function calculateSavingsRate(income, expenses) {
  return income > 0 ? ((income - expenses) / income) * 100 : null;
}
export function scopeAccounts(data, filters) {
  return data.accounts.filter(
    (a) =>
      a.workspaceId === filters.workspaceId &&
      a.currency === filters.currency &&
      (filters.accountId === 'all' || a.id === filters.accountId),
  );
}
export function selectTransactions(data, filters, period) {
  const ids = new Set(scopeAccounts(data, filters).map((a) => a.id));
  return data.transactions.filter(
    (t) =>
      !t.excluded &&
      ids.has(t.accountId) &&
      t.workspaceId === filters.workspaceId &&
      t.currency === filters.currency &&
      (filters.participantId === 'all' ||
        t.participantId === filters.participantId) &&
      validDate(t.date) &&
      t.date >= period.start &&
      t.date <= period.end &&
      Number.isSafeInteger(t.amount) &&
      ((t.type === 'income' && t.amount >= 0) ||
        (t.type === 'expense' && t.amount <= 0) ||
        t.type === 'transfer'),
  );
}
export function groupExpensesByCategory(rows, data) {
  const totals = new Map();
  for (const row of rows.filter((t) => t.type === 'expense' && !t.excluded)) {
    const splits = (data.transactionSplits || []).filter(
      (s) => s.transactionId === row.id,
    );
    const parts = splits.length
      ? splits
      : [{ categoryId: row.categoryId, amount: -row.amount }];
    for (const part of parts) {
      const id = data.categories.some(
        (c) =>
          c.id === part.categoryId &&
          (!c.workspaceId || c.workspaceId === row.workspaceId),
      )
        ? part.categoryId
        : 'uncategorized';
      totals.set(id, (totals.get(id) || 0) + part.amount);
    }
  }
  return [...totals]
    .map(([id, amount]) => ({
      id,
      amount,
      name: data.categories.find((c) => c.id === id)?.name || 'Uncategorized',
    }))
    .sort((a, b) => b.amount - a.amount);
}
function totals(rows) {
  const income = calculateIncome(rows),
    expenses = calculateExpenses(rows);
  return {
    income,
    expenses,
    net: income - expenses,
    savingsRate: calculateSavingsRate(income, expenses),
  };
}
export function summarize(data, filters) {
  const period = periods.find((p) => p.id === filters.periodId) || periods[0];
  const rows = selectTransactions(data, filters, period).sort(
    (a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id),
  );
  const prev = previousPeriod(period);
  const complete =
    period.start >= data.coverageStart && period.end <= data.coverageEnd;
  const previousComplete =
    complete &&
    prev.start >= data.coverageStart &&
    prev.end <= data.coverageEnd;
  const previous = previousComplete
    ? totals(selectTransactions(data, filters, prev))
    : null;
  const current = totals(rows);
  const accounts = scopeAccounts(data, filters);
  const balanceAvailable =
    filters.participantId === 'all' &&
    accounts.every(
      (a) => validDate(a.openingDate) && a.openingDate <= period.start,
    ) &&
    complete;
  const history = selectTransactions(
    data,
    { ...filters, participantId: 'all' },
    { start: data.coverageStart, end: period.end },
  );
  const initial = accounts.reduce((sum, a) => sum + a.openingBalance, 0);
  const balance = balanceAvailable
    ? initial + history.reduce((sum, t) => sum + t.amount, 0)
    : null;
  const before = history
    .filter((t) => t.date < period.start)
    .reduce((sum, t) => sum + t.amount, initial);
  const days = [];
  let running = before;
  for (
    let ms = Date.parse(period.start);
    ms <= Date.parse(period.end);
    ms += DAY
  ) {
    const date = new Date(ms).toISOString().slice(0, 10);
    const dayRows = rows.filter((t) => t.date === date);
    running += dayRows.reduce((sum, t) => sum + t.amount, 0);
    days.push({
      date,
      ...totals(dayRows),
      balance: balanceAvailable ? running : null,
    });
  }
  const invoices = data.invoices.filter(
    (t) =>
      t.workspaceId === filters.workspaceId &&
      t.currency === filters.currency &&
      (filters.accountId === 'all' || t.accountId === filters.accountId) &&
      (filters.participantId === 'all' ||
        t.participantId === filters.participantId) &&
      validDate(t.issuedDate) &&
      t.issuedDate >= period.start &&
      t.issuedDate <= period.end &&
      billable(t) &&
      t.total > t.paid,
  );
  return {
    ...current,
    period,
    rows,
    categories: groupExpensesByCategory(rows, data),
    previous,
    previousPeriod: prev,
    complete,
    balance,
    openingBalance: balanceAvailable ? before : null,
    days,
    invoices,
    outstanding: invoices.reduce((sum, i) => sum + i.total - i.paid, 0),
    reviews: {
      uncategorized: rows.filter(
        (t) =>
          t.type === 'expense' &&
          !(data.transactionSplits || []).some(
            (s) => s.transactionId === t.id,
          ) &&
          (!t.categoryId ||
            t.categoryId === 'uncategorized' ||
            !data.categories.some((c) => c.id === t.categoryId)),
      ),
      duplicates: rows.filter((t) => t.possibleDuplicate),
      reconciliation: invoices.filter((i) => i.needsReconciliation),
    },
    source: data.source,
  };
}
export function percentageChange(current, previous) {
  return previous > 0 ? ((current - previous) / previous) * 100 : null;
}
export function chartBuckets(summary) {
  const result = [];
  for (let i = 0; i < summary.days.length; i += 7) {
    const days = summary.days.slice(i, i + 7);
    result.push({
      label: `${days[0].date.slice(8)}–${days.at(-1).date.slice(8)}`,
      income: days.reduce((n, d) => n + d.income, 0),
      expenses: days.reduce((n, d) => n + d.expenses, 0),
      balance: days.at(-1).balance,
    });
  }
  return result;
}
