// Fixed event vocabulary and explicit fields: never serialize request/error objects.
const events = new Set([
  'startup',
  'shutdown',
  'startup_failed',
  'listener_failed',
  'auth_result',
]);
export function operation(
  event,
  { requestId, action, status } = {},
  sink = console.log,
) {
  if (!events.has(event)) return;
  const record = { event };
  if (typeof requestId === 'string' && /^[a-f0-9-]{36}$/.test(requestId))
    record.requestId = requestId;
  if (['register', 'login', 'logout', 'password', 'recovery'].includes(action))
    record.action = action;
  if (Number.isInteger(status) && status >= 100 && status <= 599)
    record.status = status;
  sink(JSON.stringify(record));
}
export function authEvents(req, res, next) {
  const match =
    /^\/api\/v1\/auth\/(register|login|logout|password|recovery)\/?$/i.exec(
      req.path,
    );
  if (match && req.method === 'POST')
    res.once('finish', () =>
      operation('auth_result', {
        requestId: req.requestId,
        action: match[1].toLowerCase(),
        status: res.statusCode,
      }),
    );
  next();
}
