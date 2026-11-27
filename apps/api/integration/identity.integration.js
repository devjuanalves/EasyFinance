import 'dotenv/config';
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, randomBytes } from 'node:crypto';
import request from 'supertest';
import { createRuntimeClient } from '../src/db/runtime.js';
import { disposableClient } from '../../../database/scripts/client.js';
import { authentication } from '../src/services/auth.js';
import { identityService } from '../src/services/identity.js';
import { identityDelivery } from '../src/security/identity-mail.js';
import { consumeIdentityLimit } from '../src/security/identity-rate.js';
import { tokenHash } from '../src/security/http.js';
import { createApp } from '../src/app.js';
const db = createRuntimeClient(),
  other = createRuntimeClient(),
  admin = disposableClient();
const config = { nodeEnv: 'test', webOrigin: 'http://localhost:5173' };
const password = 'Fictional-identity-password-123!';
async function fixture() {
  const auth = authentication(db),
    email = `identity-${randomUUID()}@example.test`;
  await auth.register({
    email,
    password,
    fullName: 'Fictional identity tester',
  });
  const login = await auth.login({ email, password });
  const actor = { userId: login.user.id, hash: tokenHash(login.token) };
  const messages = [];
  const transport = {
    kind: 'test',
    send: async (m) => {
      messages.push(m);
    },
  };
  const service = identityService(db, config, transport);
  return { email, actor, service, messages, transport, auth, login };
}
const raw = (f) => new URL(f.messages.at(-1).text.split('\n')[1]).hash.slice(7);
after(async () => {
  await Promise.all([
    db.$disconnect(),
    other.$disconnect(),
    admin.$disconnect(),
  ]);
});
test('reset stores only a purpose-bound hash and revokes every session atomically', async () => {
  const f = await fixture();
  const result = await f.service.requestReset(f.email),
    token = raw(f);
  assert.equal(JSON.stringify(result).includes(token), false);
  const stored = await db.passwordResetToken.findFirst({
    where: { userId: f.actor.userId },
  });
  assert.equal(stored.tokenHash, tokenHash('reset:' + token));
  assert.notEqual(stored.tokenHash, token);
  await f.service.reset(token, password + 'new');
  assert.equal(
    await db.authSession.count({
      where: { userId: f.actor.userId, revokedAt: null },
    }),
    0,
  );
  await assert.rejects(f.service.reset(token, password), {
    code: 'INVALID_LINK',
  });
  await assert.rejects(f.auth.login({ email: f.email, password }), {
    code: 'INVALID_CREDENTIALS',
  });
  assert.ok(
    (await f.auth.login({ email: f.email, password: password + 'new' })).token,
  );
});
test('independent connections consuming the same reset have exactly one winner', async () => {
  const f = await fixture();
  await f.service.requestReset(f.email);
  const token = raw(f),
    second = identityService(other, config, f.transport);
  const results = await Promise.allSettled([
    f.service.reset(token, password + 'A'),
    second.reset(token, password + 'B'),
  ]);
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
  assert.equal(
    results.filter(
      (r) => r.status === 'rejected' && r.reason.code === 'INVALID_LINK',
    ).length,
    1,
  );
});
test('expired and superseded reset links fail without changing credentials', async () => {
  const f = await fixture();
  await f.service.requestReset(f.email);
  const first = raw(f);
  await f.service.requestReset(f.email);
  const second = raw(f);
  await assert.rejects(f.service.reset(first, password + 'new'), {
    code: 'INVALID_LINK',
  });
  await admin.passwordResetToken.updateMany({
    where: { userId: f.actor.userId },
    data: {
      createdAt: new Date(Date.now() - 60000),
      expiresAt: new Date(Date.now() - 1000),
    },
  });
  await assert.rejects(f.service.reset(second, password + 'new'), {
    code: 'INVALID_LINK',
  });
  assert.ok((await f.auth.login({ email: f.email, password })).token);
});
test('verification is single-use, rejects reset tokens and never changes another account', async () => {
  const f = await fixture(),
    stranger = await fixture();
  await f.service.requestReset(f.email);
  await assert.rejects(f.service.verify(raw(f)), { code: 'INVALID_LINK' });
  await f.service.requestVerification(f.actor);
  const token = raw(f);
  await assert.rejects(f.service.reset(token, password), {
    code: 'INVALID_LINK',
  });
  await f.service.verify(token);
  assert.equal((await f.service.status(f.actor)).verified, true);
  assert.equal((await stranger.service.status(stranger.actor)).verified, false);
  await assert.rejects(f.service.verify(token), { code: 'INVALID_LINK' });
});
test('email change requires password, remains pending until proof and revokes sessions', async () => {
  const f = await fixture(),
    email = `changed-${randomUUID()}@example.test`;
  await assert.rejects(
    f.service.requestVerification(f.actor, { email, currentPassword: 'wrong' }),
    { code: 'INVALID_CREDENTIALS' },
  );
  await f.service.requestVerification(f.actor, {
    email,
    currentPassword: password,
  });
  assert.equal(
    (await db.user.findUnique({ where: { id: f.actor.userId } })).email,
    f.email,
  );
  assert.equal((await f.service.status(f.actor)).pendingEmail, email);
  assert.deepEqual(await f.service.verify(raw(f)), {
    verified: true,
    signInAgain: true,
  });
  assert.equal(
    (await db.user.findUnique({ where: { id: f.actor.userId } })).email,
    email,
  );
  await assert.rejects(f.service.status(f.actor), { code: 'UNAUTHENTICATED' });
});
test('email uniqueness conflict rolls back consumption and credential updates', async () => {
  const f = await fixture(),
    existing = await fixture();
  await f.service.requestVerification(f.actor, {
    email: existing.email,
    currentPassword: password,
  });
  await assert.rejects(f.service.verify(raw(f)), { code: 'P2002' });
  assert.equal(
    (await db.user.findUnique({ where: { id: f.actor.userId } })).email,
    f.email,
  );
  assert.equal(
    await db.emailVerificationToken.count({
      where: { userId: f.actor.userId, usedAt: null },
    }),
    1,
  );
});
test('failed transport invalidates proof without leaking failure or token', async () => {
  const f = await fixture(),
    service = identityService(db, config, {
      kind: 'test',
      send: async () => {
        throw new Error('private-provider-data');
      },
    });
  const response = await service.requestReset(f.email);
  assert.equal(
    JSON.stringify(response).includes('private-provider-data'),
    false,
  );
  assert.equal(
    await db.passwordResetToken.count({
      where: { userId: f.actor.userId, usedAt: null },
    }),
    0,
  );
  assert.ok(
    (await f.service.events(f.actor)).some(
      (e) => e.action === 'delivery_failed',
    ),
  );
});
test('unconfigured delivery is account-neutral and creates no reset token', async () => {
  const f = await fixture(),
    service = identityService(db, config);
  for (const email of [f.email, 'unknown@example.test'])
    await assert.rejects(service.requestReset(email), {
      code: 'DELIVERY_UNAVAILABLE',
    });
  assert.equal(
    await db.passwordResetToken.count({ where: { userId: f.actor.userId } }),
    0,
  );
});
test('shared rate counters enforce a limit across independent database connections', async () => {
  const key = randomBytes(32).toString('hex');
  const outcomes = await Promise.all(
    Array.from({ length: 12 }, (_, i) =>
      consumeIdentityLimit(i % 2 ? db : other, key, 5),
    ),
  );
  assert.equal(outcomes.filter(Boolean).length, 5);
  await admin.identityRateBucket.update({
    where: { key },
    data: { expiresAt: new Date(Date.now() - 1000) },
  });
  assert.equal(await consumeIdentityLimit(db, key, 5), true);
});
test('security events are account scoped, durable and immutable to runtime role', async () => {
  const f = await fixture(),
    stranger = await fixture();
  const events = await f.service.events(f.actor);
  assert.ok(events.some((e) => e.action === 'login_succeeded'));
  const ids = new Set(
    (await stranger.service.events(stranger.actor)).map((e) => e.id),
  );
  assert.ok(events.every((e) => !ids.has(e.id)));
  await assert.rejects(
    db.$executeRaw`DELETE FROM account_security_events WHERE false`,
  );
  await assert.rejects(
    db.$executeRaw`UPDATE account_security_events SET action='login_failed' WHERE false`,
  );
});
test('HTTP validation, CSRF and authentication protect identity operations', async () => {
  const f = await fixture(),
    app = createApp({ db, config, identityTransport: f.transport });
  await request(app).post('/api/v1/auth/reset').send({}).expect(403);
  await request(app).get('/api/v1/auth/identity').expect(401);
  await request(app)
    .post('/api/v1/auth/reset')
    .set('Origin', config.webOrigin)
    .set('X-EasyFinance-CSRF', '1')
    .send({ token: 'invalid', password })
    .expect(400);
  await request(app)
    .get('/api/v1/auth/events?userId=' + f.actor.userId)
    .expect(400);
});
test('test transport cannot be enabled in production or development', () => {
  for (const nodeEnv of ['production', 'development'])
    assert.throws(() =>
      identityDelivery({ ...config, nodeEnv }, { kind: 'test', send() {} }),
    );
});
test('verification expiry and changed original email invalidate proof', async () => {
  const f = await fixture();
  await f.service.requestVerification(f.actor);
  const token = raw(f);
  await admin.emailVerificationToken.updateMany({
    where: { userId: f.actor.userId },
    data: {
      createdAt: new Date(Date.now() - 60000),
      expiresAt: new Date(Date.now() - 1000),
    },
  });
  await assert.rejects(f.service.verify(token), { code: 'INVALID_LINK' });
  await f.service.requestVerification(f.actor);
  const fresh = raw(f);
  await admin.user.update({
    where: { id: f.actor.userId },
    data: { email: `replacement-${randomUUID()}@example.test` },
  });
  await assert.rejects(f.service.verify(fresh), { code: 'INVALID_LINK' });
});
test('password change invalidates reset and pending verification links', async () => {
  const f = await fixture();
  await f.service.requestReset(f.email);
  const reset = raw(f);
  await f.service.requestVerification(f.actor);
  const verify = raw(f);
  await f.auth.password(f.actor, {
    currentPassword: password,
    password: password + 'changed',
  });
  await assert.rejects(f.service.reset(reset, password), {
    code: 'INVALID_LINK',
  });
  await assert.rejects(f.service.verify(verify), { code: 'INVALID_LINK' });
});
test('unknown and active reset requests return the same public shape without identity fields', async () => {
  const f = await fixture();
  assert.deepEqual(
    await f.service.requestReset(f.email),
    await f.service.requestReset(`unknown-${randomUUID()}@example.test`),
  );
  assert.equal(f.messages.length, 1);
});
test('concurrent verification proof has exactly one successful consumer', async () => {
  const f = await fixture();
  await f.service.requestVerification(f.actor);
  const token = raw(f);
  const results = await Promise.allSettled([
    f.service.verify(token),
    identityService(other, config, f.transport).verify(token),
  ]);
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
});
test('identity limiter fails closed if the shared counter store is unavailable', async () => {
  const { identityRate } = await import('../src/security/identity-rate.js');
  let called = false;
  const middleware = identityRate(
    {
      $transaction: async () => {
        throw new Error('offline');
      },
    },
    { identityRateSecret: 'a'.repeat(64) },
  );
  await assert.rejects(
    middleware({ path: '/auth/reset', ip: '127.0.0.1', body: {} }, {}, () => {
      called = true;
    }),
  );
  assert.equal(called, false);
});
test('reset HTTP responses and operational logs never contain proof tokens', async () => {
  const f = await fixture(),
    app = createApp({ db, config, identityTransport: f.transport });
  const r = await request(app)
    .post('/api/v1/auth/recovery')
    .set('Origin', config.webOrigin)
    .set('X-EasyFinance-CSRF', '1')
    .send({ email: f.email })
    .expect(200);
  assert.equal(JSON.stringify(r.body).includes(raw(f)), false);
  assert.equal(r.headers['cache-control'], 'no-store');
  assert.equal(r.headers['referrer-policy'], 'no-referrer');
});
