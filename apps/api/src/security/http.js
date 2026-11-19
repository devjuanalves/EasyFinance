import { createHash, randomUUID } from 'node:crypto';
import { ApiError } from '../validation/contracts.js';
export function headers(req, res, next) {
  req.requestId = randomUUID();
  res.set({
    'X-Request-ID': req.requestId,
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'no-store',
    'Referrer-Policy': 'no-referrer',
  });
  next();
}
export function csrf(origin) {
  return (req, _res, next) => {
    if (
      !['GET', 'HEAD', 'OPTIONS'].includes(req.method) &&
      (req.get('origin') !== origin ||
        req.get('X-EasyFinance-CSRF') !== '1' ||
        !req.is('application/json'))
    )
      return next(
        new ApiError(403, 'CSRF', 'Request origin could not be verified.'),
      );
    next();
  };
}
export function rateLimit({
  limit = 60,
  windowMs = 900000,
  key = (req) => req.ip,
  now = Date.now,
} = {}) {
  const entries = new Map();
  return (req, res, next) => {
    const time = now();
    for (const [k, v] of entries) if (v.until <= time) entries.delete(k);
    const k = createHash('sha256')
      .update(String(key(req)))
      .digest('hex');
    let entry = entries.get(k);
    if (!entry) {
      if (entries.size >= 10000)
        return next(
          new ApiError(429, 'RATE_LIMITED', 'Please try again later.'),
        );
      entry = { count: 0, until: time + windowMs };
      entries.set(k, entry);
    }
    if (++entry.count > limit) {
      res.set('Retry-After', String(Math.ceil((entry.until - time) / 1000)));
      return next(new ApiError(429, 'RATE_LIMITED', 'Please try again later.'));
    }
    next();
  };
}
export const tokenHash = (token) =>
  createHash('sha256').update(token).digest('hex');
export function cookieToken(req) {
  const parts = (req.get('cookie') || '')
    .split(';')
    .map((v) => v.trim())
    .filter((v) => v.startsWith('ef_session='));
  if (parts.length !== 1) return null;
  const token = parts[0].slice(11);
  return /^[a-f0-9]{64}$/.test(token) ? token : null;
}
export function sessionCookie(res, token, secure, remember = false) {
  res.cookie('ef_session', token, {
    httpOnly: true,
    secure,
    sameSite: 'strict',
    path: '/api/v1',
    ...(remember ? { maxAge: 7 * 86400000 } : {}),
  });
}
export function clearSessionCookie(res, secure) {
  res.clearCookie('ef_session', {
    httpOnly: true,
    secure,
    sameSite: 'strict',
    path: '/api/v1',
  });
}
