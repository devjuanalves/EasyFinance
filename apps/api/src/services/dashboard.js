import { withActor, workspaceAccess, missing } from '../repositories/access.js';
import { dashboardRecords } from '../repositories/dashboard.js';
import { investmentRecords } from '../repositories/investments.js';
import { portfolio } from '../../../../packages/shared/src/investmentMath.js';
const day = (d) => d.toISOString().slice(0, 10);
function ratio(n, d) {
  const scaled = (n * 10000n) / d,
    a = scaled < 0n ? -scaled : scaled;
  return `${scaled < 0n ? '-' : ''}${a / 100n}.${String(a % 100n).padStart(2, '0')}`;
}
export function summarizeCash(rows, categoryId = null) {
  let income = 0n,
    expenses = 0n;
  const categories = new Map();
  for (const t of rows) {
    if (t.excludedAt || t.type === 'transfer') continue;
    const parts = t.TransactionSplit_transaction?.length
      ? t.TransactionSplit_transaction
      : [t];
    for (const part of parts) {
      if (categoryId && part.categoryId !== categoryId) continue;
      const amount = BigInt(part.amountMinor);
      if (t.type === 'income') income += amount;
      if (t.type === 'expense') {
        expenses -= amount;
        const key = part.categoryId || 'uncategorized';
        categories.set(key, (categories.get(key) || 0n) - amount);
      }
    }
  }
  return {
    incomeMinor: String(income),
    expenseMinor: String(expenses),
    netMinor: String(income - expenses),
    savingsRate: income > 0n ? ratio(income - expenses, income) : null,
    categories: [...categories].map(([id, amount]) => ({
      id,
      amountMinor: String(amount),
    })),
  };
}
export function dashboard(db) {
  return (a, w, f) =>
    withActor(db, a, async (tx) => {
      await workspaceAccess(tx, a.userId, w);
      if (
        f.accountId &&
        !(await tx.financialAccount.findFirst({
          where: { id: f.accountId, workspaceId: w, currency: f.currency },
        }))
      )
        throw missing();
      if (
        f.categoryId &&
        !(await tx.category.findFirst({
          where: { id: f.categoryId, workspaceId: w },
        }))
      )
        throw missing();
      const days = Math.round((f.end - f.start) / 86400000) + 1;
      const previousStart = new Date(f.start.getTime() - days * 86400000);
      const records = await dashboardRecords(tx, w, f, previousStart);
      const current = records.rows.filter((r) => r.bookingDate >= f.start);
      const matches = (t) =>
        !f.categoryId ||
        (t.TransactionSplit_transaction.length
          ? t.TransactionSplit_transaction.some(
              (s) => s.categoryId === f.categoryId,
            )
          : t.categoryId === f.categoryId);
      const summary = summarizeCash(current, f.categoryId);
      const buckets = [];
      const step = Math.ceil(days / 6);
      for (let offset = 0; offset < days; offset += step) {
        const start = new Date(f.start.getTime() + offset * 86400000),
          end = new Date(
            Math.min(f.end.getTime(), start.getTime() + (step - 1) * 86400000),
          );
        const { incomeMinor, expenseMinor } = summarizeCash(
          current.filter((t) => t.bookingDate >= start && t.bookingDate <= end),
          f.categoryId,
        );
        buckets.push({
          start: day(start),
          end: day(end),
          incomeMinor,
          expenseMinor,
        });
      }
      const accountBalances = records.accounts.map((account) => ({
        id: account.id,
        name: account.name,
        balanceMinor:
          account.openingDate > f.end
            ? null
            : String(
                account.openingBalanceMinor +
                  (records.balances.find((b) => b.accountId === account.id)
                    ?._sum.amountMinor || 0n),
              ),
      }));
      const positions = await investmentRecords(tx, w);
      const p = portfolio(
        positions,
        { workspaceId: w, currency: f.currency },
        { start: day(f.start), end: day(f.end) },
      );
      return {
        ...summary,
        currency: f.currency,
        start: day(f.start),
        end: day(f.end),
        previous: summarizeCash(
          records.rows.filter((r) => r.bookingDate < f.start),
          f.categoryId,
        ),
        previousStart: day(previousStart),
        previousEnd: day(new Date(f.start.getTime() - 86400000)),
        buckets,
        categories: summary.categories
          .map((c) => ({
            ...c,
            name:
              records.categories.find((r) => r.id === c.id)?.name ||
              'Uncategorized',
          }))
          .sort((a, b) =>
            BigInt(a.amountMinor) > BigInt(b.amountMinor) ? -1 : 1,
          ),
        categoryOptions: records.categories,
        accounts: accountBalances,
        balanceMinor:
          f.categoryId || accountBalances.some((a) => a.balanceMinor === null)
            ? null
            : String(
                accountBalances.reduce(
                  (n, b) => n + BigInt(b.balanceMinor),
                  0n,
                ),
              ),
        outstandingMinor: String(
          records.invoices.reduce(
            (n, i) =>
              n +
              i.totalMinor -
              i.PaymentAllocation_invoice.reduce(
                (v, x) => v + x.amountMinor,
                0n,
              ),
            0n,
          ),
        ),
        unpaidCount: records.invoices.filter(
          (i) =>
            i.totalMinor >
            i.PaymentAllocation_invoice.reduce((n, x) => n + x.amountMinor, 0n),
        ).length,
        uncategorizedCount: current.filter(
          (t) =>
            t.type !== 'transfer' &&
            !t.categoryId &&
            !t.TransactionSplit_transaction.length &&
            matches(t),
        ).length,
        recent: current
          .filter(matches)
          .slice(-6)
          .reverse()
          .map((t) => ({
            id: t.id,
            description: t.description,
            date: day(t.bookingDate),
            amountMinor: String(t.amountMinor),
            type: t.type,
          })),
        portfolio: {
          valueMinor: p.currentValue === null ? null : String(p.currentValue),
          basisMinor: String(p.basis),
          unrealizedMinor: p.unrealized === null ? null : String(p.unrealized),
          valuationDates: p.valuationDates,
        },
      };
    });
}
