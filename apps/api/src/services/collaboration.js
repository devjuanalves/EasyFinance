import { EVENTS } from '../../../../packages/shared/src/notificationEvents.js';
import { randomBytes, createHash } from 'node:crypto';
import { withActor, workspaceAccess, missing } from '../repositories/access.js';
import { ApiError } from '../validation/contracts.js';
const conflict = (message) => {
  throw new ApiError(409, 'CONFLICT', message);
};
const hash = (token) => createHash('sha256').update(token).digest('hex');
const audit = (tx, auth, wid, action, entityId) =>
  tx.activityLog.create({
    data: {
      workspaceId: wid,
      actorUserId: auth.userId,
      entityType: 'collaboration',
      entityId,
      action,
    },
  });
const safeInvite = (i) => ({
  id: i.id,
  email: i.invitedEmail,
  role: i.role,
  status:
    i.status === 'pending' && i.expiresAt <= new Date() ? 'expired' : i.status,
  expiresAt: i.expiresAt,
});
export function collaboration(db) {
  const scoped = (auth, wid, owner, fn) =>
    withActor(db, auth, async (tx) => {
      const m = await workspaceAccess(tx, auth.userId, wid, owner, owner);
      return fn(tx, m);
    });
  return {
    read: (auth, wid) =>
      scoped(auth, wid, false, async (tx, m) => {
        const [w, u, members, invitations, automations, runs, activity] =
          await Promise.all([
            tx.workspace.findUnique({ where: { id: wid } }),
            tx.user.findUnique({ where: { id: auth.userId } }),
            tx.workspaceMember.findMany({
              where: { workspaceId: wid },
              include: { user: { select: { fullName: true, email: true } } },
              orderBy: { createdAt: 'asc' },
              take: 500,
            }),
            m.role === 'owner'
              ? tx.workspaceInvitation.findMany({
                  where: { workspaceId: wid },
                  orderBy: { createdAt: 'desc' },
                  take: 100,
                })
              : [],
            tx.automationRule.findMany({
              where: { workspaceId: wid },
              orderBy: { createdAt: 'asc' },
              take: 500,
            }),
            tx.automationRun.findMany({
              where: { workspaceId: wid },
              orderBy: { createdAt: 'desc' },
              take: 100,
              select: {
                id: true,
                automationRuleId: true,
                scheduledFor: true,
                status: true,
                startedAt: true,
                finishedAt: true,
              },
            }),
            tx.activityLog.findMany({
              where: { workspaceId: wid, entityType: 'collaboration' },
              orderBy: { createdAt: 'desc' },
              take: 100,
              select: {
                id: true,
                action: true,
                createdAt: true,
                actorUserId: true,
              },
            }),
          ]);
        return {
          role: m.role,
          workspace: {
            id: w.id,
            name: w.name,
            type: w.kind,
            baseCurrency: w.baseCurrency,
            timeZone: w.timezone,
          },
          profile: {
            fullName: u.fullName,
            email: u.email,
            preferences: {
              language: u.locale,
              currency: w.baseCurrency,
              dateFormat: 'DD/MM/YYYY',
              numberFormat: '1,234.56',
              timeZone: u.timezone,
              monthStart: 1,
              ...u.preferences,
            },
          },
          members: members.map((x) => ({
            id: x.id,
            fullName: x.user.fullName,
            email: x.user.email,
            role: x.role,
            status: x.status,
            joinedAt: x.joinedAt,
          })),
          invitations: invitations.map(safeInvite),
          automations,
          runs,
          activity,
          notificationPreferences: await (async () => {
            const rows = await tx.notificationPreference.findMany({
              where: {
                workspaceId: wid,
                userId: auth.userId,
                channel: 'in_app',
              },
            });
            return {
              enabled: Object.fromEntries(
                Object.values(EVENTS)
                  .flat()
                  .map((event) => [
                    event,
                    rows.find((r) => r.eventType === event)?.enabled ?? true,
                  ]),
              ),
              frequency: rows[0]?.digestFrequency || 'immediate',
              time: rows[0]?.preferredTime || '09:00',
              timeZone: u.preferences.notificationTimeZone || u.timezone,
            };
          })(),
          executionEnabled: false,
        };
      }),
    preferences: (auth, wid, input) =>
      scoped(auth, wid, false, async (tx) => {
        for (const [eventType, enabled] of Object.entries(input.enabled))
          await tx.notificationPreference.upsert({
            where: {
              userId_workspaceId_eventType_channel: {
                userId: auth.userId,
                workspaceId: wid,
                eventType,
                channel: 'in_app',
              },
            },
            create: {
              userId: auth.userId,
              workspaceId: wid,
              eventType,
              channel: 'in_app',
              enabled,
              digestFrequency: input.frequency,
              preferredTime: input.time,
            },
            update: {
              enabled,
              digestFrequency: input.frequency,
              preferredTime: input.time,
            },
          });
        const u = await tx.user.findUnique({ where: { id: auth.userId } });
        await tx.user.update({
          where: { id: auth.userId },
          data: {
            preferences: {
              ...u.preferences,
              notificationTimeZone: input.timeZone,
            },
          },
        });
        await audit(
          tx,
          auth,
          wid,
          'Notification preferences updated',
          auth.userId,
        );
        return { saved: true };
      }),
    profile: (auth, wid, input) =>
      scoped(auth, wid, false, async (tx) => {
        await tx.user.update({
          where: { id: auth.userId },
          data: {
            ...input,
            preferences: {
              ...(await tx.user.findUnique({ where: { id: auth.userId } }))
                .preferences,
              ...input.preferences,
            },
            locale: input.preferences.language,
            timezone: input.preferences.timeZone,
          },
        });
        await audit(tx, auth, wid, 'Personal preferences updated', auth.userId);
        return { saved: true };
      }),
    workspace: (auth, wid, input) =>
      scoped(auth, wid, true, async (tx) => {
        const w = await tx.workspace.findUnique({ where: { id: wid } });
        if (w.baseCurrency !== input.baseCurrency)
          conflict(
            'Workspace base currency is locked; existing financial history retains its native currencies.',
          );
        await tx.workspace.update({ where: { id: wid }, data: input });
        await audit(tx, auth, wid, 'Workspace updated', wid);
        return { saved: true };
      }),
    invite: (auth, wid, input) =>
      scoped(auth, wid, true, async (tx) => {
        const member = await tx.workspaceMember.findFirst({
          where: {
            workspaceId: wid,
            status: 'active',
            user: { email: input.email },
          },
        });
        if (member) conflict('An active member already uses this email.');
        await tx.workspaceInvitation.updateMany({
          where: {
            workspaceId: wid,
            invitedEmail: input.email,
            status: 'pending',
            expiresAt: { lte: new Date() },
          },
          data: { status: 'expired' },
        });
        if (
          await tx.workspaceInvitation.findFirst({
            where: {
              workspaceId: wid,
              invitedEmail: input.email,
              status: 'pending',
            },
          })
        )
          conflict('A pending invitation already exists.');
        const token = randomBytes(32).toString('hex');
        const invitation = await tx.workspaceInvitation.create({
          data: {
            workspaceId: wid,
            invitedEmail: input.email,
            role: input.role,
            tokenHash: hash(token),
            expiresAt: new Date(Date.now() + 7 * 86400000),
            invitedById: auth.userId,
          },
        });
        await audit(
          tx,
          auth,
          wid,
          'Invitation prepared for local handoff',
          invitation.id,
        );
        return { ...safeInvite(invitation), token, delivery: 'local_only' };
      }),
    revoke: (auth, wid, id) =>
      scoped(auth, wid, true, async (tx) => {
        const i = await tx.workspaceInvitation.findFirst({
          where: { id, workspaceId: wid },
        });
        if (!i) throw missing();
        if (i.status === 'revoked') return { revoked: true };
        if (i.status === 'accepted')
          conflict(
            'Accepted invitations cannot be revoked. Remove the member instead.',
          );
        await tx.workspaceInvitation.update({
          where: { id },
          data: { status: 'revoked', revokedAt: new Date() },
        });
        await audit(tx, auth, wid, 'Invitation revoked', id);
        return { revoked: true };
      }),
    accept: (auth, token) =>
      withActor(db, auth, async (tx) => {
        const initial = await tx.workspaceInvitation.findUnique({
          where: { tokenHash: hash(token) },
        });
        if (!initial) throw missing();
        const found =
          await tx.$queryRaw`SELECT id FROM workspaces WHERE id=${initial.workspaceId}::uuid AND status='active' FOR UPDATE`;
        if (!found.length) throw missing();
        const i = await tx.workspaceInvitation.findUnique({
          where: { id: initial.id },
        });
        const user = await tx.user.findUnique({ where: { id: auth.userId } });
        if (user.email !== i.invitedEmail) throw missing();
        const key = { workspaceId: i.workspaceId, userId: auth.userId };
        const member = await tx.workspaceMember.findUnique({
          where: { workspaceId_userId: key },
        });
        if (
          i.status === 'accepted' &&
          i.acceptedById === auth.userId &&
          member?.status === 'active'
        )
          return { workspaceId: i.workspaceId };
        if (i.status !== 'pending' || i.expiresAt <= new Date())
          conflict('Invitation is no longer available.');
        const inviter = await tx.workspaceMember.findUnique({
          where: {
            workspaceId_userId: {
              workspaceId: i.workspaceId,
              userId: i.invitedById,
            },
          },
        });
        if (inviter?.status !== 'active' || inviter.role !== 'owner')
          conflict('Invitation authority is no longer active.');
        if (member?.status === 'active') conflict('Membership already exists.');
        await tx.workspaceMember.upsert({
          where: { workspaceId_userId: key },
          create: { ...key, role: i.role },
          update: {
            role: i.role,
            status: 'active',
            revokedAt: null,
            joinedAt: new Date(),
          },
        });
        await tx.workspaceInvitation.update({
          where: { id: i.id },
          data: {
            status: 'accepted',
            acceptedAt: new Date(),
            acceptedById: auth.userId,
          },
        });
        await audit(tx, auth, i.workspaceId, 'Invitation accepted', i.id);
        return { workspaceId: i.workspaceId };
      }),
    automation: (auth, wid, id, input) =>
      scoped(auth, wid, true, async (tx) => {
        const { updatedAt, ...data } = input;
        if (
          data.type === 'reminder' &&
          !(await tx.invoice.findFirst({
            where: {
              id: data.configJson.invoiceId,
              workspaceId: wid,
              lifecycle: 'issued',
            },
          }))
        )
          throw new ApiError(
            400,
            'VALIDATION',
            'Choose an issued invoice in this workspace.',
          );
        const old = await tx.automationRule.findFirst({
          where: { id: id || data.id, workspaceId: wid },
        });
        if (id) {
          if (!old) throw missing();
          if (old.status === 'archived')
            conflict('Archived configurations cannot be changed.');
          if (old.updatedAt.toISOString() !== updatedAt)
            conflict('Configuration changed. Reload before editing.');
        } else if (old) {
          const fields = ['name', 'type', 'frequency', 'timezone', 'status'];
          if (
            fields.some((k) => old[k] !== data[k]) ||
            Object.keys(data.configJson).some(
              (k) => old.configJson[k] !== data.configJson[k],
            ) ||
            Object.keys(old.configJson).length !==
              Object.keys(data.configJson).length
          )
            conflict('Creation identifier already used.');
          return old;
        }
        const result = id
          ? await tx.automationRule.update({ where: { id }, data })
          : await tx.automationRule.create({
              data: {
                ...data,
                workspaceId: wid,
                createdById: auth.userId,
                mode: 'review',
              },
            });
        await audit(
          tx,
          auth,
          wid,
          id
            ? 'Automation configuration updated'
            : 'Automation configuration created',
          result.id,
        );
        return result;
      }),
  };
}
