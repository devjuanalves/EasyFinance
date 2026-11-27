import { createHmac } from 'node:crypto';
import { ApiError } from '../validation/contracts.js';
export async function consumeIdentityLimit(db, key, limit, windowMs = 900000) {
  return db.$transaction(
    async (tx) => {
      // Serializes bucket creation/cap enforcement across API processes, not just JS instances.
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(102704)::text`;
      await tx.$executeRaw`DELETE FROM identity_rate_buckets WHERE key IN (SELECT key FROM identity_rate_buckets WHERE expires_at <= CURRENT_TIMESTAMP LIMIT 100)`;
      const existing = await tx.identityRateBucket.findUnique({
        where: { key },
      });
      if (!existing && (await tx.identityRateBucket.count()) >= 10000)
        return false;
      const rows =
        await tx.$queryRaw`INSERT INTO identity_rate_buckets(key,count,expires_at) VALUES (${key},1,CURRENT_TIMESTAMP + ${windowMs} * interval '1 millisecond') ON CONFLICT(key) DO UPDATE SET count=CASE WHEN identity_rate_buckets.expires_at <= CURRENT_TIMESTAMP THEN 1 ELSE LEAST(identity_rate_buckets.count+1,1000000) END, expires_at=CASE WHEN identity_rate_buckets.expires_at <= CURRENT_TIMESTAMP THEN EXCLUDED.expires_at ELSE identity_rate_buckets.expires_at END RETURNING count`;
      return rows[0].count <= limit;
    },
    { maxWait: 2000, timeout: 5000 },
  );
}
export function identityRate(db, config) {
  return async (req, res, next) => {
    const secret =
      config.identityRateSecret || process.env.IDENTITY_RATE_SECRET;
    if (!secret || !/^[a-f0-9]{64}$/.test(secret))
      throw new ApiError(
        503,
        'IDENTITY_UNAVAILABLE',
        'Identity service is temporarily unavailable.',
      );
    const action = req.path.toLowerCase().replace(/\/$/, '');
    const digest = (value) =>
      createHmac('sha256', secret).update(value).digest('hex');
    const ipAllowed = await consumeIdentityLimit(
      db,
      digest('ip:' + req.ip),
      1000,
    );
    const subject =
      req.auth?.userId ||
      String(req.body?.email || req.body?.token || '')
        .trim()
        .toLowerCase()
        .slice(0, 256);
    const subjectAllowed =
      ipAllowed &&
      (await consumeIdentityLimit(db, digest(action + ':' + subject), 20));
    if (!subjectAllowed) {
      res.set('Retry-After', '900');
      throw new ApiError(429, 'RATE_LIMITED', 'Please try again later.');
    }
    next();
  };
}
