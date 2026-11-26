import { withActor, workspaceAccess, missing } from '../repositories/access.js';
import { ApiError } from '../validation/contracts.js';
const conflict = () => {
  throw new ApiError(
    409,
    'CONFLICT',
    'Category changed or identifier reused. Reload before continuing.',
  );
};
export function categories(db) {
  return (a, w, input, id = null, archive = false) =>
    withActor(db, a, async (tx) => {
      await workspaceAccess(tx, a.userId, w, true);
      const { updatedAt, ...fields } = input;
      let row;
      if (!id) {
        const existing = await tx.category.findFirst({
          where: { id: fields.id, workspaceId: w },
        });
        if (existing) {
          if (
            existing.archivedAt ||
            ['name', 'kind', 'icon', 'color'].some(
              (k) => existing[k] !== fields[k],
            )
          )
            conflict();
          return existing;
        }
        row = await tx.category.create({ data: { ...fields, workspaceId: w } });
      } else {
        const old = await tx.category.findFirst({
          where: { id, workspaceId: w },
        });
        if (!old) throw missing();
        if (old.archivedAt || old.updatedAt.toISOString() !== updatedAt)
          conflict();
        row = await tx.category.update({
          where: { id },
          data: {
            ...(archive ? { archivedAt: new Date() } : fields),
            updatedAt: new Date(
              Math.max(Date.now(), old.updatedAt.getTime() + 1),
            ),
          },
        });
      }
      await tx.activityLog.create({
        data: {
          workspaceId: w,
          actorUserId: a.userId,
          entityType: 'category',
          entityId: row.id,
          action: archive ? 'archived' : id ? 'updated' : 'created',
          metadataJson: { name: row.name, kind: row.kind },
        },
      });
      return row;
    });
}
