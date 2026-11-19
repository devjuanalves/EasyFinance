import { withActor, workspaceAccess, missing } from '../repositories/access.js';
import { ApiError } from '../validation/contracts.js';
export function workspaces(db) {
  return {
    list: (auth) =>
      withActor(db, auth, async (tx) =>
        (
          await tx.workspaceMember.findMany({
            where: {
              userId: auth.userId,
              status: 'active',
              workspace: { status: 'active' },
            },
            include: { workspace: true },
            orderBy: { joinedAt: 'asc' },
          })
        ).map((m) => ({
          id: m.workspaceId,
          name: m.workspace.name,
          currency: m.workspace.baseCurrency,
          role: m.role,
        })),
      ),
    onboard: (auth, input) =>
      withActor(db, auth, async (tx) => {
        const existing = await tx.workspaceMember.findFirst({
          where: {
            userId: auth.userId,
            status: 'active',
            workspace: { status: 'active' },
          },
        });
        if (existing) return { id: existing.workspaceId };
        await tx.user.update({
          where: { id: auth.userId },
          data: {
            ...(input.fullName ? { fullName: input.fullName } : {}),
            ...(input.language ? { locale: input.language } : {}),
            timezone: input.timeZone,
            preferences: {
              currency: input.currency,
              dateFormat: input.dateFormat || 'DD/MM/YYYY',
            },
          },
        });
        const w = await tx.workspace.create({
          data: {
            name: input.workspaceName,
            baseCurrency: input.currency,
            timezone: input.timeZone,
            kind: input.workspaceType,
            ownerUserId: auth.userId,
          },
        });
        await tx.workspaceMember.create({
          data: { workspaceId: w.id, userId: auth.userId, role: 'owner' },
        });
        await tx.financialAccount.create({
          data: {
            workspaceId: w.id,
            currency: input.currency,
            name: 'Manual account',
            openingDate: new Date(new Date().toISOString().slice(0, 10)),
          },
        });
        await tx.category.createMany({
          data: [
            { workspaceId: w.id, name: 'General expenses', kind: 'expense' },
            { workspaceId: w.id, name: 'General income', kind: 'income' },
          ],
        });
        return { id: w.id };
      }),
    members: (auth, wid) =>
      withActor(db, auth, async (tx) => {
        await workspaceAccess(tx, auth.userId, wid, false, true);
        return (
          await tx.workspaceMember.findMany({
            where: { workspaceId: wid },
            include: { user: { select: { fullName: true } } },
          })
        ).map((m) => ({
          id: m.id,
          userId: m.userId,
          fullName: m.user.fullName,
          role: m.role,
          status: m.status,
        }));
      }),
    changeMember: (auth, wid, id, input) =>
      withActor(db, auth, async (tx) => {
        await workspaceAccess(tx, auth.userId, wid, true, true);
        const m = await tx.workspaceMember.findFirst({
          where: { id, workspaceId: wid },
        });
        if (!m) throw missing();
        if (m.role === 'owner')
          throw new ApiError(
            409,
            'OWNER_PROTECTED',
            'Ownership transfer requires a separate workflow.',
          );
        return tx.workspaceMember.update({
          where: { id },
          data: {
            role: input.role,
            status: input.status,
            revokedAt: input.status === 'revoked' ? new Date() : null,
          },
          select: { id: true, role: true, status: true },
        });
      }),
  };
}
