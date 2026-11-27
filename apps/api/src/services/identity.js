import { randomBytes } from 'node:crypto';
import { tokenHash } from '../security/http.js';
import { hashPassword, verifyPassword } from '../security/passwords.js';
import { ApiError } from '../validation/contracts.js';
import { withActor } from '../repositories/access.js';
import { securityEvent } from '../repositories/security-events.js';
import { identityDelivery } from '../security/identity-mail.js';
const invalid = () =>
  new ApiError(
    400,
    'INVALID_LINK',
    'This link is invalid or expired. Request a new link.',
  );
const neutral = {
  message:
    'If the account is eligible, instructions will be sent. Delivery is not confirmed by this response.',
};
export function identityService(db, config, transport) {
  const delivery = identityDelivery(config, transport);
  const resetMinutes = config.resetMinutes ?? 15;
  if (!Number.isInteger(resetMinutes) || resetMinutes < 5 || resetMinutes > 30)
    throw new Error('Reset expiry must be 5–30 minutes.');
  async function unavailable(userId = null) {
    await securityEvent(db, 'delivery_unavailable', userId);
    throw new ApiError(
      503,
      'DELIVERY_UNAVAILABLE',
      'Email delivery is unavailable. No message has been sent.',
    );
  }
  async function deliver(record, raw, type) {
    try {
      await delivery.send({ type, email: record.email, token: raw });
    } catch {
      // The generated token becomes unusable if the transport reports failure.
      await db.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM users WHERE id=${record.userId}::uuid FOR UPDATE`;
        const model =
          type === 'reset' ? tx.passwordResetToken : tx.emailVerificationToken;
        await model.update({
          where: { id: record.id },
          data: { usedAt: new Date() },
        });
        await securityEvent(tx, 'delivery_failed', record.userId);
      });
    }
    return neutral;
  }
  return {
    async requestReset(email) {
      // The unconfigured public boundary is identical for every address.
      if (!delivery.available) return unavailable();
      const user = await db.user.findUnique({ where: { email } });
      if (!user || user.status !== 'active') {
        await securityEvent(db, 'reset_requested');
        return neutral;
      }
      const raw = randomBytes(32).toString('hex');
      const record = await db.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM users WHERE id=${user.id}::uuid FOR UPDATE`;
        const current = await tx.user.findUnique({ where: { id: user.id } });
        if (current.email !== email || current.status !== 'active') return null;
        await tx.passwordResetToken.updateMany({
          where: { userId: user.id, usedAt: null },
          data: { usedAt: new Date() },
        });
        const token = await tx.passwordResetToken.create({
          data: {
            userId: user.id,
            tokenHash: tokenHash('reset:' + raw),
            expiresAt: new Date(Date.now() + resetMinutes * 60000),
          },
        });
        await securityEvent(tx, 'reset_requested', user.id);
        return { ...token, email };
      });
      return record ? deliver(record, raw, 'reset') : neutral;
    },
    async reset(raw, password) {
      const hash = tokenHash('reset:' + raw);
      const found = await db.passwordResetToken.findUnique({
        where: { tokenHash: hash },
      });
      if (!found) throw invalid();
      const passwordHash = await hashPassword(password);
      return db.$transaction(
        async (tx) => {
          await tx.$queryRaw`SELECT id FROM users WHERE id=${found.userId}::uuid FOR UPDATE`;
          const t = await tx.passwordResetToken.findUnique({
            where: { tokenHash: hash },
          });
          const user = await tx.user.findUnique({
            where: { id: found.userId },
          });
          if (
            !t ||
            t.usedAt ||
            t.expiresAt <= new Date() ||
            user.status !== 'active'
          )
            throw invalid();
          await tx.user.update({
            where: { id: user.id },
            data: { passwordHash },
          });
          await tx.passwordResetToken.updateMany({
            where: { userId: user.id, usedAt: null },
            data: { usedAt: new Date() },
          });
          await tx.emailVerificationToken.updateMany({
            where: { userId: user.id, usedAt: null },
            data: { usedAt: new Date() },
          });
          await tx.authSession.updateMany({
            where: { userId: user.id, revokedAt: null },
            data: { revokedAt: new Date() },
          });
          await securityEvent(tx, 'reset_completed', user.id);
          await securityEvent(tx, 'session_revoked', user.id);
          return { changed: true };
        },
        { timeout: 10000 },
      );
    },
    async requestVerification(auth, input = {}) {
      if (!delivery.available) {
        await withActor(db, auth, async () => {});
        return unavailable(auth.userId);
      }
      const raw = randomBytes(32).toString('hex'),
        purpose = input.email ? 'change' : 'verify';
      const record = await withActor(db, auth, async (tx) => {
        const u = await tx.user.findUnique({ where: { id: auth.userId } });
        if (
          purpose === 'change' &&
          !(await verifyPassword(input.currentPassword, u.passwordHash))
        )
          throw new ApiError(
            401,
            'INVALID_CREDENTIALS',
            'Current password is incorrect.',
          );
        if (purpose === 'verify' && u.emailVerifiedAt) return null;
        await tx.emailVerificationToken.updateMany({
          where: { userId: u.id, usedAt: null },
          data: { usedAt: new Date() },
        });
        const t = await tx.emailVerificationToken.create({
          data: {
            userId: u.id,
            email: input.email || u.email,
            originalEmail: u.email,
            purpose,
            tokenHash: tokenHash('verify:' + raw),
            expiresAt: new Date(Date.now() + 3600000),
          },
        });
        await securityEvent(
          tx,
          purpose === 'change'
            ? 'email_change_requested'
            : 'verification_requested',
          u.id,
        );
        return t;
      });
      return record ? deliver(record, raw, purpose) : neutral;
    },
    async verify(raw) {
      const hash = tokenHash('verify:' + raw),
        found = await db.emailVerificationToken.findUnique({
          where: { tokenHash: hash },
        });
      if (!found) throw invalid();
      return db.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM users WHERE id=${found.userId}::uuid FOR UPDATE`;
        const t = await tx.emailVerificationToken.findUnique({
          where: { tokenHash: hash },
        });
        const u = await tx.user.findUnique({ where: { id: found.userId } });
        if (
          !t ||
          t.usedAt ||
          t.expiresAt <= new Date() ||
          u.status !== 'active' ||
          u.email !== t.originalEmail
        )
          throw invalid();
        await tx.user.update({
          where: { id: u.id },
          data: { email: t.email, emailVerifiedAt: new Date() },
        });
        await tx.emailVerificationToken.updateMany({
          where: { userId: u.id, usedAt: null },
          data: { usedAt: new Date() },
        });
        if (t.purpose === 'change') {
          await securityEvent(tx, 'session_revoked', u.id);
          await tx.passwordResetToken.updateMany({
            where: { userId: u.id, usedAt: null },
            data: { usedAt: new Date() },
          });
          await tx.authSession.updateMany({
            where: { userId: u.id, revokedAt: null },
            data: { revokedAt: new Date() },
          });
        }
        await securityEvent(
          tx,
          t.purpose === 'change' ? 'email_changed' : 'verification_completed',
          u.id,
        );
        return { verified: true, signInAgain: t.purpose === 'change' };
      });
    },
    status: (auth) =>
      withActor(db, auth, async (tx) => {
        const user = await tx.user.findUnique({ where: { id: auth.userId } });
        const pending = await tx.emailVerificationToken.findFirst({
          where: {
            userId: user.id,
            purpose: 'change',
            usedAt: null,
            expiresAt: { gt: new Date() },
          },
          orderBy: { createdAt: 'desc' },
        });
        return {
          email: user.email,
          verified: Boolean(user.emailVerifiedAt),
          pendingEmail: pending?.email || null,
          deliveryAvailable: delivery.available,
        };
      }),
    events: (auth) =>
      withActor(db, auth, (tx) =>
        tx.accountSecurityEvent.findMany({
          where: { userId: auth.userId },
          orderBy: { createdAt: 'desc' },
          take: 50,
          select: { id: true, action: true, createdAt: true },
        }),
      ),
  };
}
