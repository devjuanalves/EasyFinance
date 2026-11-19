import { ApiError } from '../validation/contracts.js';
export const unauthorized = () =>
  new ApiError(401, 'UNAUTHENTICATED', 'Sign in to continue.');
export const missing = () =>
  new ApiError(404, 'NOT_FOUND', 'Record not found.');
export async function activeSession(db, hash) {
  const s = await db.authSession.findUnique({
    where: { tokenHash: hash },
    include: { user: true },
  });
  if (
    !s ||
    s.revokedAt ||
    s.expiresAt <= new Date() ||
    s.user.status !== 'active'
  )
    throw unauthorized();
  return s;
}
export async function withActor(db, auth, fn) {
  return db.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT id FROM users WHERE id=${auth.userId}::uuid FOR UPDATE`;
      await activeSession(tx, auth.hash);
      return fn(tx);
    },
    { timeout: 10000 },
  );
}
export async function workspaceAccess(
  tx,
  userId,
  workspaceId,
  write = false,
  owner = false,
) {
  // The same lock orders membership changes and domain writes, including revocation races.
  const found =
    await tx.$queryRaw`SELECT id FROM workspaces WHERE id=${workspaceId}::uuid AND status='active' FOR UPDATE`;
  if (!found.length) throw missing();
  const m = await tx.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
  });
  if (!m || m.status !== 'active') throw missing();
  if ((owner && m.role !== 'owner') || (write && m.role === 'viewer'))
    throw new ApiError(
      403,
      'FORBIDDEN',
      'This operation is not permitted for your workspace role.',
    );
  return m;
}
export const publicUser = (u) => ({
  id: u.id,
  fullName: u.fullName,
  email: u.email,
  preferences: u.preferences,
});
export async function sessionUser(tx, user) {
  const memberships = await tx.workspaceMember.count({
    where: {
      userId: user.id,
      status: 'active',
      workspace: { status: 'active' },
    },
  });
  return { ...publicUser(user), onboardingComplete: memberships > 0 };
}
