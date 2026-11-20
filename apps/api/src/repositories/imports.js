import { missing } from './access.js';
export const batchResult = (b) => ({
  id: b.id,
  createdAt: b.createdAt,
  fileName: b.mapping.fileName,
  currency: b.currency,
  accountId: b.financialAccountId,
  rowCount: b.rowCount,
  accepted: b.reviewDecisions.filter((d) =>
    ['keep', 'keep_both'].includes(d.decision),
  ).length,
  decisions: b.reviewDecisions,
  status: b.status,
});
export async function batchById(tx, w, id) {
  const b = await tx.importBatch.findFirst({ where: { id, workspaceId: w } });
  if (!b) throw missing();
  return batchResult(b);
}
