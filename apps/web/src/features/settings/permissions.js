export function roleFor(data, context) {
  if (!data.memberships) return context.role || 'owner';
  return (
    data.memberships.find(
      (m) =>
        m.userId === context.userId &&
        m.workspaceId === context.workspaceId &&
        m.status === 'active',
    )?.role || null
  );
}
export function requirePermission(data, context, permission = 'edit') {
  const role = roleFor(data, context);
  if (!role)
    throw new Error('Permission denied: workspace access is unavailable.');
  if (permission === 'owner' && role !== 'owner')
    throw new Error('Permission denied: Owner access is required.');
  if (permission === 'edit' && !['owner', 'editor'].includes(role))
    throw new Error('Permission denied: this workspace is read-only.');
  return role;
}
export function authorizedWorkspaces(data, userId) {
  return data.workspaces.filter((w) =>
    data.memberships.some(
      (m) =>
        m.workspaceId === w.id && m.userId === userId && m.status === 'active',
    ),
  );
}
export function scopedFinancialData(data, userId, workspaceId) {
  const allowed = authorizedWorkspaces(data, userId).some(
    (w) => w.id === workspaceId,
  );
  const ids = (name) =>
    new Set(
      (data[name] || [])
        .filter((x) => allowed && x.workspaceId === workspaceId)
        .map((x) => x.id),
    );
  const invoices = ids('invoices'),
    payments = ids('payments'),
    investments = ids('investments'),
    transactions = ids('transactions');
  const result = { ...data, workspaces: authorizedWorkspaces(data, userId) };
  for (const [key, values] of Object.entries(data))
    if (Array.isArray(values) && key !== 'workspaces') {
      result[key] = values.filter((v) => {
        if ('workspaceId' in v) return allowed && v.workspaceId === workspaceId;
        if ('invoiceId' in v) return invoices.has(v.invoiceId);
        if ('investmentId' in v) return investments.has(v.investmentId);
        if ('paymentId' in v) return payments.has(v.paymentId);
        if ('transactionId' in v) return transactions.has(v.transactionId);
        return allowed;
      });
    }
  delete result.users;
  delete result.memberships;
  delete result.invitations;
  delete result.notifications;
  delete result.notificationPreferences;
  return result;
}
