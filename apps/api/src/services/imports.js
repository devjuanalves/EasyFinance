import { createHash } from 'node:crypto';
import { withActor, workspaceAccess } from '../repositories/access.js';
import { batchResult, batchById } from '../repositories/imports.js';
import { ApiError, fail } from '../validation/contracts.js';
const hash = (v) =>
  createHash('sha256').update(JSON.stringify(v)).digest('hex');
const normalized = (s) => s.trim().toLowerCase().replace(/\s+/g, ' ');
const conflict = (m) => {
  throw new ApiError(409, 'CONFLICT', m);
};
const source = (b) => ({
  csv: b.csv,
  fileName: b.fileName,
  accountId: b.accountId,
  currency: b.currency,
  mapping: b.mapping,
  options: b.options,
});
async function preview(tx, w, b) {
  const account = await tx.financialAccount.findFirst({
    where: {
      id: b.accountId,
      workspaceId: w,
      currency: b.currency,
      archivedAt: null,
    },
  });
  if (!account)
    fail('Choose an active account in this workspace and currency.');
  const existing = await tx.transaction.findMany({
    where: { workspaceId: w, accountId: b.accountId, currency: b.currency },
    take: 10001,
    orderBy: { id: 'asc' },
  });
  if (existing.length > 10000)
    fail('This account exceeds the V1 review limit.');
  const rows = b.rows.map((r) => {
    if (r.error) return r;
    const candidates = existing
      .filter(
        (t) =>
          (t.bookingDate.toISOString().slice(0, 10) === r.date &&
            t.amountMinor === BigInt(r.amount)) ||
          (r.reference && t.sourceReference === r.reference),
      )
      .map((t) => ({
        id: t.id,
        version: t.version,
        description: t.description,
        amountMinor: t.amountMinor.toString(),
        date: t.bookingDate.toISOString().slice(0, 10),
        source: t.source,
        type: t.type,
        excluded: !!t.excludedAt,
        compatible:
          !t.excludedAt &&
          t.bookingDate.toISOString().slice(0, 10) === r.date &&
          t.amountMinor === BigInt(r.amount),
        reason:
          normalized(t.originalDescription) ===
          normalized(r.originalDescription)
            ? 'Matching original description and financial values'
            : 'Possible matching activity; review required',
      }));
    if (candidates.length > 100)
      fail(
        'Too many possible matches for one row; narrow the source statement or review the ledger first.',
      );
    const within = b.rows
      .filter(
        (x) =>
          x.rowNumber !== r.rowNumber &&
          !x.error &&
          ((x.date === r.date &&
            x.amount === r.amount &&
            normalized(x.description) === normalized(r.description)) ||
            (r.reference && r.reference === x.reference)),
      )
      .map((x) => x.rowNumber);
    return { ...r, candidates, within };
  });
  return { rows, previewHash: hash({ source: source(b), rows }) };
}
export function imports(db) {
  const run = (a, w, write, fn) =>
    withActor(db, a, async (tx) => {
      await workspaceAccess(tx, a.userId, w, write);
      return fn(tx);
    });
  return {
    preview: (a, w, b) => run(a, w, true, (tx) => preview(tx, w, b)),
    list: (a, w) =>
      run(a, w, false, async (tx) =>
        (
          await tx.importBatch.findMany({
            where: { workspaceId: w },
            orderBy: { createdAt: 'desc' },
            take: 50,
          })
        ).map(batchResult),
      ),
    read: (a, w, id) => run(a, w, false, (tx) => batchById(tx, w, id)),
    confirm: (a, w, b) =>
      run(a, w, true, async (tx) => {
        const signature = hash({
          source: source(b),
          decisions: b.decisions,
          actor: a.userId,
        });
        const prior = await tx.importBatch.findUnique({
          where: {
            workspaceId_idempotencyKey: {
              workspaceId: w,
              idempotencyKey: b.key,
            },
          },
        });
        if (prior) {
          if (prior.mapping.signature !== signature)
            conflict('Import key already used for different input.');
          return batchResult(prior);
        }
        const p = await preview(tx, w, b);
        if (p.previewHash !== b.previewHash)
          conflict(
            'Ledger or review changed. Preview again before confirming.',
          );
        for (const [i, r] of p.rows.entries()) {
          const d = b.decisions[i];
          if (d.decision === 'exclude') continue;
          if (r.error) fail(`Row ${r.rowNumber}: ${r.error}`);
          if (d.decision === 'match') {
            if (!r.candidates.some((c) => c.id === d.matchId && c.compatible))
              fail('Choose a compatible existing transaction.');
            continue;
          }
          if (
            (r.candidates.length || r.within.length) &&
            d.decision !== 'keep_both'
          )
            conflict(
              'Review possible duplicates: exclude, match existing, or explicitly Keep Both.',
            );
          if (
            d.categoryId &&
            !(await tx.category.findFirst({
              where: {
                id: d.categoryId,
                workspaceId: w,
                kind: r.type,
                archivedAt: null,
              },
            }))
          )
            fail('Choose a matching active category.');
        }
        const batch = await tx.importBatch.create({
          data: {
            workspaceId: w,
            currency: b.currency,
            financialAccountId: b.accountId,
            createdById: a.userId,
            idempotencyKey: b.key,
            status: 'confirmed',
            confirmedAt: new Date(),
            periodStart: new Date(b.options.start),
            periodEnd: new Date(b.options.end),
            rowCount: b.rows.length,
            parserVersion: 'csv-v1',
            mapping: {
              ...b.mapping,
              options: b.options,
              fileName: b.fileName,
              checksum: createHash('sha256').update(b.csv).digest('hex'),
              signature,
            },
            sourceRows: b.rows.map((r) => r.raw),
            reviewDecisions: b.decisions,
          },
        });
        for (const [i, r] of p.rows.entries()) {
          const d = b.decisions[i];
          if (!['keep', 'keep_both'].includes(d.decision)) continue;
          await tx.transaction.create({
            data: {
              workspaceId: w,
              accountId: b.accountId,
              currency: b.currency,
              createdById: a.userId,
              bookingDate: new Date(r.date),
              originalDate: new Date(r.originalDate),
              description: r.description,
              originalDescription: r.originalDescription,
              amountMinor: BigInt(r.amount),
              originalAmountMinor: BigInt(r.originalAmount),
              type: r.type,
              source: 'import',
              importBatchId: batch.id,
              sourceRow: r.rowNumber,
              sourceReference: r.reference || null,
              sourceSystem: d.decision === 'keep_both' ? null : 'csv-v1',
              sourceData: {
                raw: r.raw,
                fileName: b.fileName,
                duplicateCandidates: r.candidates.map((c) => c.id),
                within: r.within,
              },
              categoryId: d.categoryId,
              manualCategoryOverride: !!d.categoryId,
              reviewStatus: 'reviewed',
              duplicateDecision:
                d.decision === 'keep_both' ? 'keep_both' : 'use_original',
              duplicateOfId:
                d.decision === 'keep_both' ? r.candidates[0]?.id : null,
            },
          });
        }
        await tx.activityLog.create({
          data: {
            workspaceId: w,
            actorUserId: a.userId,
            entityType: 'import',
            entityId: batch.id,
            action: 'confirmed',
            metadataJson: { accepted: batchResult(batch).accepted },
          },
        });
        return batchResult(batch);
      }),
  };
}
