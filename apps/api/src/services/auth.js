import { randomBytes } from 'node:crypto';
import { hashPassword, verifyPassword } from '../security/passwords.js';
import { tokenHash } from '../security/http.js';
import { ApiError } from '../validation/contracts.js';
import {
  withActor,
  sessionUser,
  unauthorized,
} from '../repositories/access.js';
export function authentication(db) {
  return {
    async register(input) {
      const passwordHash = await hashPassword(input.password);
      try {
        await db.user.create({
          data: { email: input.email, fullName: input.fullName, passwordHash },
        });
      } catch (e) {
        if (e.code !== 'P2002') throw e;
      }
      return {
        message:
          'Registration request processed. Sign in to continue; recovery email is not available.',
      };
    },
    async login(input) {
      const user = await db.user.findUnique({ where: { email: input.email } });
      const ok = await verifyPassword(input.password, user?.passwordHash);
      if (!ok || user.status !== 'active')
        throw new ApiError(
          401,
          'INVALID_CREDENTIALS',
          'Email or password is incorrect.',
        );
      return db.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM users WHERE id=${user.id}::uuid FOR UPDATE`;
        const current = await tx.user.findUnique({ where: { id: user.id } });
        if (
          current.passwordHash !== user.passwordHash ||
          current.status !== 'active'
        )
          throw unauthorized();
        const token = randomBytes(32).toString('hex');
        await tx.authSession.create({
          data: {
            userId: user.id,
            tokenHash: tokenHash(token),
            expiresAt: new Date(
              Date.now() + (input.rememberMe ? 7 * 86400000 : 12 * 3600000),
            ),
          },
        });
        return { token, user: await sessionUser(tx, current) };
      });
    },
    session: (auth) =>
      withActor(db, auth, async (tx) =>
        sessionUser(
          tx,
          await tx.user.findUnique({ where: { id: auth.userId } }),
        ),
      ),
    logout: (auth) =>
      withActor(db, auth, async (tx) => {
        await tx.authSession.update({
          where: { tokenHash: auth.hash },
          data: { revokedAt: new Date() },
        });
        return { revoked: true };
      }),
    password: (auth, input) =>
      withActor(db, auth, async (tx) => {
        const u = await tx.user.findUnique({ where: { id: auth.userId } });
        if (!(await verifyPassword(input.currentPassword, u.passwordHash)))
          throw new ApiError(
            401,
            'INVALID_CREDENTIALS',
            'Current password is incorrect.',
          );
        await tx.user.update({
          where: { id: u.id },
          data: { passwordHash: await hashPassword(input.password) },
        });
        await tx.authSession.updateMany({
          where: { userId: u.id, revokedAt: null },
          data: { revokedAt: new Date() },
        });
        return { changed: true };
      }),
  };
}
