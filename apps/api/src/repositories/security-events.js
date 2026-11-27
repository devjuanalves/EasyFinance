export const securityEvent = (db, action, userId = null) =>
  db.accountSecurityEvent.create({ data: { action, userId } });
