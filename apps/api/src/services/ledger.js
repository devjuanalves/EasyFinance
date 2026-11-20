import { cashTotals } from '@easyfinance/shared';
import { createHash } from 'node:crypto';
import { withActor, workspaceAccess, missing } from '../repositories/access.js';
import {
  scope,
  transactionById,
  transactionInclude,
  serialize,
  audit,
} from '../repositories/ledger.js';
import { ApiError } from '../validation/contracts.js';
const conflict = (message) => new ApiError(409, 'CONFLICT', message);
async function category(tx, wid, input) {
  if (
    input.categoryId &&
    !(await tx.category.findFirst({
      where: {
        id: input.categoryId,
        workspaceId: wid,
        kind: input.type,
        archivedAt: null,
      },
    }))
  )
    throw new ApiError(400, 'VALIDATION', 'Choose a matching active category.');
}
function fingerprint(input) {
  return createHash('sha256')
    .update(
      JSON.stringify({ ...input, amountMinor: input.amountMinor.toString() }),
    )
    .digest('hex');
}
async function withBalance(tx, row) {
  const total = await tx.transaction.aggregate({
    where: {
      workspaceId: row.workspaceId,
      accountId: row.id,
      currency: row.currency,
      excludedAt: null,
    },
    _sum: { amountMinor: true },
  });
  return {
    ...row,
    balanceMinor: (
      row.openingBalanceMinor + (total._sum.amountMinor || 0n)
    ).toString(),
  };
}
export function ledger(db) {
  const run = (auth, wid, write, fn) =>
    withActor(db, auth, async (tx) => {
      await workspaceAccess(tx, auth.userId, wid, write);
      return fn(tx);
    });
  return {
    accounts: (a, w, c) =>
      run(a, w, false, async (tx) => {
        const rows = await tx.financialAccount.findMany({
          where: scope(w, c ? { currency: c } : {}),
          orderBy: { createdAt: 'asc' },
        });
        return Promise.all(rows.map((row) => withBalance(tx, row)));
      }),
    account: (a, w, id) =>
      run(a, w, false, async (tx) => {
        const r = await tx.financialAccount.findFirst({
          where: scope(w, { id }),
        });
        if (!r) throw missing();
        return withBalance(tx, r);
      }),
    categories: (a, w) =>
      run(a, w, false, (tx) =>
        tx.category.findMany({
          where: scope(w),
          select: { id: true, name: true, kind: true, archivedAt: true },
        }),
      ),
    list: (a, w, f) =>
      run(a, w, false, async (tx) => {
        const where = scope(w, f.where);
        const rows = await tx.transaction.findMany({
          where,
          include: transactionInclude,
          orderBy: [{ bookingDate: f.sort }, { id: 'asc' }],
          skip: (f.page - 1) * f.limit,
          take: f.limit,
        });
        return {
          rows: rows.map(serialize),
          count: await tx.transaction.count({ where }),
          page: f.page,
          limit: f.limit,
        };
      }),
    read: (a, w, id) =>
      run(a, w, false, async (tx) =>
        serialize(await transactionById(tx, w, id)),
      ),
    summary: (a, w, f) =>
      run(a, w, false, async (tx) => {
        const rows = await tx.transaction.findMany({
          where: scope(w, { ...f.where, excludedAt: null }),
          select: { amountMinor: true, type: true },
        });
        const totals = cashTotals(rows, {
          amount: (r) => r.amountMinor,
          zero: 0n,
        });
        return {
          incomeMinor: totals.income.toString(),
          expenseMinor: totals.expenses.toString(),
          netMinor: totals.net.toString(),
          count: rows.length,
        };
      }),
    create: (a, w, input) =>
      run(a, w, true, async (tx) => {
        const prior = await tx.transaction.findFirst({
          where: scope(w, { id: input.id }),
          include: transactionInclude,
        });
        const signature = fingerprint(input);
        if (prior) {
          if (
            prior.sourceData?.createFingerprint !== signature ||
            prior.createdById !== a.userId
          )
            throw conflict('Operation identifier already used.');
          return serialize(prior);
        }
        const account = await tx.financialAccount.findFirst({
          where: scope(w, {
            id: input.accountId,
            currency: input.currency,
            archivedAt: null,
          }),
        });
        if (!account)
          throw new ApiError(
            400,
            'VALIDATION',
            'Choose an active account in this currency.',
          );
        await category(tx, w, input);
        const row = await tx.transaction.create({
          data: {
            ...input,
            workspaceId: w,
            createdById: a.userId,
            originalDescription: input.description,
            originalAmountMinor: input.amountMinor,
            originalDate: input.bookingDate,
            source: 'manual',
            manualCategoryOverride: !!input.categoryId,
            sourceData: { createFingerprint: signature },
          },
        });
        await audit(tx, a.userId, w, row.id, 'created');
        return serialize(row);
      }),
    update: (a, w, id, input) =>
      run(a, w, true, async (tx) => {
        const row = await transactionById(tx, w, id);
        if (row.version !== input.version)
          throw conflict('This transaction changed. Reload before editing.');
        if (
          row.type === 'transfer' ||
          row.source !== 'manual' ||
          row.TransactionSplit_transaction.length ||
          (await tx.payment.count({
            where: { transactionId: id, workspaceId: w },
          }))
        )
          throw conflict(
            'This record requires a corrective workflow; its financial history is protected.',
          );
        await category(tx, w, input);
        const result = await tx.transaction.update({
          where: { id },
          data: {
            ...input,
            version: { increment: 1 },
            manualCategoryOverride: true,
          },
        });
        await audit(tx, a.userId, w, id, 'updated');
        return serialize(result);
      }),
    categorize: (a, w, id, input) =>
      run(a, w, true, async (tx) => {
        const row = await transactionById(tx, w, id);
        if (row.version !== input.version)
          throw conflict('This transaction changed. Reload before editing.');
        if (
          row.type === 'transfer' ||
          row.TransactionSplit_transaction.length ||
          (await tx.payment.count({
            where: { transactionId: id, workspaceId: w },
          }))
        )
          throw conflict(
            'Split, transfer and invoice-linked records retain their protected classification.',
          );
        await category(tx, w, { ...input, type: row.type });
        const result = await tx.transaction.update({
          where: { id },
          data: {
            categoryId: input.categoryId,
            manualCategoryOverride: true,
            reviewStatus: 'reviewed',
            version: { increment: 1 },
          },
          include: transactionInclude,
        });
        await audit(tx, a.userId, w, id, 'categorized');
        return serialize(result);
      }),
    exclusion: (a, w, id, input) =>
      run(a, w, true, async (tx) => {
        const row = await transactionById(tx, w, id);
        if (row.version !== input.version)
          throw conflict('This transaction changed. Reload before editing.');
        if (
          row.type === 'transfer' ||
          (await tx.payment.count({
            where: { transactionId: id, workspaceId: w },
          }))
        )
          throw conflict(
            'Linked transfers and payment receipts require a corrective workflow.',
          );
        const result = await tx.transaction.update({
          where: { id },
          data: {
            excludedAt: input.excluded ? new Date() : null,
            version: { increment: 1 },
          },
          include: transactionInclude,
        });
        await audit(
          tx,
          a.userId,
          w,
          id,
          input.excluded ? 'excluded' : 'restored',
        );
        return serialize(result);
      }),
  };
}
