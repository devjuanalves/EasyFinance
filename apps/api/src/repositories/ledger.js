import { missing } from './access.js';
export const scope = (workspaceId, where = {}) => ({ ...where, workspaceId });
export const transactionInclude = { TransactionSplit_transaction: true };
export async function transactionById(tx, workspaceId, id) {
  const row = await tx.transaction.findFirst({
    where: scope(workspaceId, { id }),
    include: transactionInclude,
  });
  if (!row) throw missing();
  return row;
}
export const serialize = (row) => ({
  id: row.id,
  workspaceId: row.workspaceId,
  accountId: row.accountId,
  currency: row.currency,
  date: row.bookingDate.toISOString().slice(0, 10),
  description: row.description,
  type: row.type,
  amountMinor: row.amountMinor.toString(),
  categoryId: row.categoryId,
  source: row.source,
  excluded: !!row.excludedAt,
  version: row.version,
  originalDescription: row.originalDescription,
  originalAmountMinor: row.originalAmountMinor.toString(),
  originalDate: row.originalDate.toISOString().slice(0, 10),
  splits:
    row.TransactionSplit_transaction?.map((s) => ({
      id: s.id,
      categoryId: s.categoryId,
      amountMinor: s.amountMinor.toString(),
      note: s.note,
    })) || [],
});
export async function audit(tx, actor, workspaceId, entityId, action) {
  await tx.activityLog.create({
    data: {
      workspaceId,
      actorUserId: actor,
      entityType: 'transaction',
      entityId,
      action,
    },
  });
}
