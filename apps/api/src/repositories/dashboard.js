import { ApiError } from '../validation/contracts.js';
export function bounded(rows) {
  if (rows.length > 10000)
    throw new ApiError(
      409,
      'REPORT_LIMIT',
      'Reporting scope exceeds 10,000 records. Narrow the date range or account.',
    );
  return rows;
}
export async function dashboardRecords(tx, w, f, previousStart) {
  const scope = {
    workspaceId: w,
    currency: f.currency,
    ...(f.accountId ? { accountId: f.accountId } : {}),
  };
  const [rows, categories, accounts, balances, invoices] = await Promise.all([
    tx.transaction.findMany({
      where: {
        ...scope,
        excludedAt: null,
        bookingDate: { gte: previousStart, lte: f.end },
      },
      include: { TransactionSplit_transaction: true },
      orderBy: [{ bookingDate: 'asc' }, { id: 'asc' }],
      take: 10001,
    }),
    tx.category.findMany({
      where: { workspaceId: w },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      take: 10001,
    }),
    tx.financialAccount.findMany({
      where: {
        workspaceId: w,
        currency: f.currency,
        ...(f.accountId ? { id: f.accountId } : {}),
      },
      take: 10001,
    }),
    tx.transaction.groupBy({
      by: ['accountId'],
      where: { ...scope, excludedAt: null, bookingDate: { lte: f.end } },
      _sum: { amountMinor: true },
    }),
    tx.invoice.findMany({
      where: {
        ...scope,
        lifecycle: 'issued',
        issueDate: { gte: f.start, lte: f.end },
      },
      select: {
        id: true,
        totalMinor: true,
        PaymentAllocation_invoice: {
          where: { payment: { status: 'confirmed' } },
          select: { amountMinor: true },
        },
      },
      take: 10001,
    }),
  ]);
  return {
    rows: bounded(rows),
    categories: bounded(categories),
    accounts: bounded(accounts),
    balances,
    invoices: bounded(invoices),
  };
}
