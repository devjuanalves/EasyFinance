import { randomUUID, createHash } from 'node:crypto';
import { applyInvestmentCommand } from '../../../../packages/shared/src/investmentCommands.js';
import { withActor, workspaceAccess, missing } from '../repositories/access.js';
import {
  investmentRecords,
  persistInvestmentChanges,
} from '../repositories/investments.js';
import { ApiError, fail } from '../validation/contracts.js';
const conflict = () => {
  throw new ApiError(
    409,
    'CONFLICT',
    'Investment changed or request key was reused. Refresh and review before retrying.',
  );
};
const canonical = (value) =>
  Array.isArray(value)
    ? value.map(canonical)
    : value && typeof value === 'object'
      ? Object.fromEntries(
          Object.keys(value)
            .sort()
            .map((k) => [k, canonical(value[k])]),
        )
      : value;
export function investments(db) {
  return {
    list: (auth, w) =>
      withActor(db, auth, async (tx) => {
        await workspaceAccess(tx, auth.userId, w);
        return investmentRecords(tx, w);
      }),
    command: (auth, w, b) =>
      withActor(db, auth, async (tx) => {
        const member = await workspaceAccess(tx, auth.userId, w, true);
        const fingerprint = createHash('sha256')
          .update(JSON.stringify(canonical(b)))
          .digest('hex');
        const previous = await tx.activityLog.findFirst({
          where: {
            id: b.key,
            workspaceId: w,
            entityType: 'investment-command',
          },
        });
        if (previous) {
          if (
            previous.actorUserId !== auth.userId ||
            previous.metadataJson.fingerprint !== fingerprint
          )
            conflict();
          return {
            result: previous.metadataJson.result,
            data: await investmentRecords(tx, w),
          };
        }
        const before = await investmentRecords(tx, w);
        const holding = b.payload.id
          ? before.investments.find((i) => i.id === b.payload.id)
          : null;
        if (b.payload.id && !holding) throw missing();
        if (holding && holding.version !== b.version) conflict();
        let outcome;
        try {
          outcome = applyInvestmentCommand(
            before,
            {
              workspaceId: w,
              role: member.role,
              participantId: auth.userId,
              newId: randomUUID,
              revision: (m) => Math.max(Date.now(), (m?.revision || 0) + 1),
            },
            b.action,
            b.payload,
          );
        } catch (e) {
          fail(e.message);
        }
        await persistInvestmentChanges(tx, before, outcome.data, auth.userId);
        const investmentId =
          holding?.id || (b.action === 'create' ? outcome.result : null);
        if (holding)
          await tx.investment.update({
            where: { id: holding.id },
            data: { version: { increment: 1 } },
          });
        await tx.activityLog.create({
          data: {
            id: b.key,
            workspaceId: w,
            entityType: 'investment-command',
            entityId: investmentId,
            actorUserId: auth.userId,
            action: b.action,
            metadataJson: {
              fingerprint,
              result: outcome.result || null,
              interestInfo:
                outcome.data.investments.find((i) => i.id === investmentId)
                  ?.interestInfo || '',
              events: outcome.data.investmentEvents.slice(
                before.investmentEvents.length,
              ),
            },
          },
        });
        return {
          result: outcome.result || null,
          data: await investmentRecords(tx, w),
        };
      }),
  };
}
