import 'dotenv/config';
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { createRuntimeClient, diagnoseRuntime } from '../src/db/runtime.js';
import { disposableClient } from '../../../database/scripts/client.js';
const db = createRuntimeClient(),
  admin = disposableClient();
const origin = 'http://localhost:5173',
  config = { webOrigin: origin, nodeEnv: 'test' };
const password = 'Fictional-test-password-123!';
let app, owner, editor, viewer, outsider, wid, account, category, member;
const call = (actor, method, path, body) => {
  const agent = request(app);
  let r = agent[method]('/api/v1' + path)
    .set('Origin', origin)
    .set('X-EasyFinance-CSRF', '1');
  if (actor) r = r.set('Cookie', actor.cookie);
  return body === undefined ? r : r.send(body);
};
async function identity() {
  const email = `9a-${randomUUID()}@example.test`;
  await call(null, 'post', '/auth/register', {
    fullName: 'Fictional API Tester',
    email,
    password,
  }).expect(200);
  const r = await call(null, 'post', '/auth/login', { email, password }).expect(
    200,
  );
  return {
    email,
    id: r.body.data.id,
    cookie: r.headers['set-cookie'][0].split(';')[0],
  };
}
const base = () => `/workspaces/${wid}`;
const input = () => ({
  id: randomUUID(),
  accountId: account.id,
  currency: 'AUD',
  date: '2026-11-17',
  description: 'Fictional expense',
  type: 'expense',
  amountMinor: '-1234',
  categoryId: category.id,
});
before(async () => {
  await diagnoseRuntime(db);
  app = createApp({ db, config });
  owner = await identity();
  editor = await identity();
  viewer = await identity();
  outsider = await identity();
  wid = (
    await call(owner, 'post', '/onboarding', {
      workspaceName: 'API integration workspace',
      currency: 'AUD',
    }).expect(200)
  ).body.data.id;
  account = (await call(owner, 'get', base() + '/accounts').expect(200)).body
    .data[0];
  category = (
    await call(owner, 'get', base() + '/categories').expect(200)
  ).body.data.find((c) => c.kind === 'expense');
  member = await admin.workspaceMember.create({
    data: { workspaceId: wid, userId: editor.id, role: 'editor' },
  });
  await admin.workspaceMember.create({
    data: { workspaceId: wid, userId: viewer.id, role: 'viewer' },
  });
});
after(async () => {
  await db.$disconnect();
  await admin.$disconnect();
});
test('runtime privileges are separate from migration privileges', async () => {
  const d = await diagnoseRuntime(db);
  assert.equal(d.role, 'easyfinance_9a_app');
  await assert.rejects(
    db.$executeRaw`CREATE TABLE public.forbidden_9a (id int)`,
  );
  await assert.rejects(db.$executeRaw`DELETE FROM users WHERE false`);
});
test('passwords hashed and tokens only stored hashed; HttpOnly strict cookie', async () => {
  const u = await admin.user.findUnique({ where: { id: owner.id } });
  assert.match(u.passwordHash, /^\$argon2id\$/);
  assert.ok(!u.passwordHash.includes(password));
  const token = owner.cookie.split('=')[1];
  const s = await admin.authSession.findUnique({
    where: { tokenHash: createHash('sha256').update(token).digest('hex') },
  });
  assert.ok(s);
  const r = await call(null, 'post', '/auth/login', {
    email: owner.email,
    password,
  });
  assert.match(r.headers['set-cookie'][0], /HttpOnly/);
  assert.match(r.headers['set-cookie'][0], /SameSite=Strict/);
  assert.ok(!JSON.stringify(r.body).includes('passwordHash'));
});
test('duplicate registration has the same neutral result and no session', async () => {
  const r = await call(null, 'post', '/auth/register', {
    email: owner.email,
    fullName: 'Another name',
    password,
  }).expect(200);
  assert.ok(!r.headers['set-cookie']);
  assert.equal(
    r.body.data.message,
    'Registration request processed. Sign in to continue; recovery email is not available.',
  );
});
test('unknown and invalid credentials fail generically', async () => {
  const a = await call(null, 'post', '/auth/login', {
    email: owner.email,
    password: 'Incorrect-password!',
  }).expect(401);
  const b = await call(null, 'post', '/auth/login', {
    email: 'unknown@example.test',
    password: 'Incorrect-password!',
  }).expect(401);
  assert.deepEqual(a.body.error, b.body.error);
});
test('session and onboarding persist; onboarding repeat is idempotent', async () => {
  assert.equal(
    (await call(owner, 'get', '/auth/session').expect(200)).body.data
      .onboardingComplete,
    true,
  );
  assert.equal(
    (
      await call(owner, 'post', '/onboarding', {
        workspaceName: 'Ignored repeat',
        currency: 'AUD',
      })
    ).body.data.id,
    wid,
  );
});
test('unauthenticated and forged cookies cannot read', async () => {
  await call(null, 'get', base() + '/accounts').expect(401);
  await call(
    { cookie: 'ef_session=' + 'a'.repeat(64) },
    'get',
    base() + '/accounts',
  ).expect(401);
});
test('CSRF rejects missing, foreign origins and missing custom header', async () => {
  await request(app)
    .post('/api/v1/auth/login')
    .send({ email: owner.email, password })
    .expect(403);
  await request(app)
    .post('/api/v1/auth/login')
    .set('Origin', 'https://evil.example')
    .set('X-EasyFinance-CSRF', '1')
    .send({ email: owner.email, password })
    .expect(403);
  await request(app)
    .post('/api/v1/auth/login')
    .set('Origin', origin)
    .send({ email: owner.email, password })
    .expect(403);
});
test('viewer reads, cannot mutate; editor cannot manage or self-promote', async () => {
  await call(viewer, 'get', base() + '/accounts').expect(200);
  await call(viewer, 'post', base() + '/transactions', input()).expect(403);
  await call(editor, 'patch', base() + '/members/' + member.id, {
    role: 'owner',
    status: 'active',
  }).expect(400);
  await call(editor, 'patch', base() + '/members/' + member.id, {
    role: 'viewer',
    status: 'active',
  }).expect(403);
  await call(editor, 'get', base() + '/members').expect(403);
});
test('owner can manage members; revoked member immediately loses access', async () => {
  await call(owner, 'patch', base() + '/members/' + member.id, {
    role: 'editor',
    status: 'revoked',
  }).expect(200);
  await call(editor, 'get', base() + '/accounts').expect(404);
  await call(owner, 'patch', base() + '/members/' + member.id, {
    role: 'editor',
    status: 'active',
  }).expect(200);
});
test('pending invitation and guessed workspace/account IDs grant no access', async () => {
  await admin.workspaceInvitation.create({
    data: {
      workspaceId: wid,
      invitedEmail: outsider.email,
      role: 'editor',
      tokenHash: createHash('sha256').update(randomUUID()).digest('hex'),
      expiresAt: new Date(Date.now() + 86400000),
      invitedById: owner.id,
    },
  });
  await call(outsider, 'get', base() + '/accounts/' + account.id).expect(404);
  assert.deepEqual((await call(outsider, 'get', '/workspaces')).body.data, []);
});
test('validated manual expense, original values and read endpoints', async () => {
  const value = input();
  const r = (
    await call(editor, 'post', base() + '/transactions', value).expect(200)
  ).body.data;
  assert.equal(r.amountMinor, '-1234');
  assert.equal(r.originalAmountMinor, '-1234');
  assert.equal(
    (await call(editor, 'get', base() + '/transactions/' + r.id)).body.data.id,
    r.id,
  );
  await call(owner, 'get', base() + '/accounts/' + account.id).expect(200);
});
test('idempotent retry returns one row; conflicting operation reuse rejected', async () => {
  const value = input();
  await call(owner, 'post', base() + '/transactions', value).expect(200);
  await call(owner, 'post', base() + '/transactions', value).expect(200);
  await call(owner, 'post', base() + '/transactions', {
    ...value,
    amountMinor: '-99',
  }).expect(409);
  assert.equal(await admin.transaction.count({ where: { id: value.id } }), 1);
});
test('edit, exclusion/restoration, version conflict and summary reconciliation', async () => {
  const row = (await call(owner, 'post', base() + '/transactions', input()))
    .body.data;
  const value = {
    version: row.version,
    date: row.date,
    description: 'Revised',
    type: 'expense',
    amountMinor: '-2000',
    categoryId: category.id,
  };
  const revised = (
    await call(
      owner,
      'patch',
      base() + '/transactions/' + row.id,
      value,
    ).expect(200)
  ).body.data;
  assert.equal(revised.originalAmountMinor, '-1234');
  await call(owner, 'patch', base() + '/transactions/' + row.id, value).expect(
    409,
  );
  const before = (
    await call(owner, 'get', base() + '/expenses/summary?currency=AUD')
  ).body.data;
  const excluded = (
    await call(
      owner,
      'post',
      base() + '/transactions/' + row.id + '/exclusion',
      { version: revised.version, excluded: true },
    ).expect(200)
  ).body.data;
  const after = (
    await call(owner, 'get', base() + '/expenses/summary?currency=AUD')
  ).body.data;
  assert.equal(BigInt(before.expenseMinor) - BigInt(after.expenseMinor), 2000n);
  await call(owner, 'post', base() + '/transactions/' + row.id + '/exclusion', {
    version: excluded.version,
    excluded: false,
  }).expect(200);
});
test('currency and account/workspace references cannot be forged', async () => {
  await call(owner, 'post', base() + '/transactions', {
    ...input(),
    currency: 'EUR',
  }).expect(400);
  await call(owner, 'post', base() + '/transactions', {
    ...input(),
    workspaceId: randomUUID(),
  }).expect(400);
  assert.equal(
    (await call(owner, 'get', base() + '/expenses/summary?currency=EUR')).body
      .data.expenseMinor,
    '0',
  );
  await call(owner, 'get', base() + '/transactions?currency=ALL').expect(400);
});
test('invalid monetary values, dates, IDs, sorting and unknown fields rejected', async () => {
  for (const amountMinor of [1, '1.01', '1e3', '0', '-9007199254740992'])
    await call(owner, 'post', base() + '/transactions', {
      ...input(),
      amountMinor,
    }).expect(400);
  await call(owner, 'post', base() + '/transactions', {
    ...input(),
    date: '2026-02-30',
  }).expect(400);
  await call(owner, 'get', base() + '/transactions/not-a-uuid').expect(400);
  await call(
    owner,
    'get',
    base() + '/transactions?currency=AUD&sort=sql',
  ).expect(400);
  await call(owner, 'post', base() + '/transactions', {
    ...input(),
    role: 'owner',
  }).expect(400);
});
test('pagination/search are scoped and bounded', async () => {
  const r = await call(
    owner,
    'get',
    base() + '/transactions?currency=AUD&search=Fictional&limit=1&page=1',
  ).expect(200);
  assert.equal(r.body.data.rows.length, 1);
  assert.ok(r.body.data.count >= 2);
  await call(
    owner,
    'get',
    base() + '/transactions?currency=AUD&limit=101',
  ).expect(400);
});
test('concurrent creates are idempotent; concurrent edits reject one stale version', async () => {
  const v = input();
  const creates = await Promise.all([
    call(owner, 'post', base() + '/transactions', v),
    call(editor, 'post', base() + '/transactions', v),
  ]);
  assert.equal(creates.filter((r) => r.status === 200).length, 1);
  assert.equal(creates.filter((r) => r.status === 409).length, 1);
  const row = await admin.transaction.findUnique({ where: { id: v.id } });
  const patch = {
    version: row.version,
    date: v.date,
    description: 'Concurrent edit',
    type: v.type,
    amountMinor: v.amountMinor,
    categoryId: v.categoryId,
  };
  const results = await Promise.all([
    call(owner, 'patch', base() + '/transactions/' + v.id, patch),
    call(editor, 'patch', base() + '/transactions/' + v.id, patch),
  ]);
  assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
});
test('expired and revoked sessions are rejected', async () => {
  const u = await identity();
  await admin.authSession.updateMany({
    where: { userId: u.id },
    data: {
      expiresAt: new Date(Date.now() - 1000),
      createdAt: new Date(Date.now() - 2000),
    },
  });
  await call(u, 'get', '/auth/session').expect(401);
  const r = await call(null, 'post', '/auth/login', {
    email: u.email,
    password,
  });
  u.cookie = r.headers['set-cookie'][0].split(';')[0];
  await admin.authSession.updateMany({
    where: { userId: u.id },
    data: { revokedAt: new Date() },
  });
  await call(u, 'get', '/auth/session').expect(401);
});
test('password change revokes all sessions; old credential fails; logout revokes', async () => {
  const u = await identity();
  await call(u, 'post', '/auth/password', {
    currentPassword: password,
    password: 'Changed-password-123!',
  }).expect(200);
  await call(u, 'get', '/auth/session').expect(401);
  await call(null, 'post', '/auth/login', { email: u.email, password }).expect(
    401,
  );
  const r = await call(null, 'post', '/auth/login', {
    email: u.email,
    password: 'Changed-password-123!',
  }).expect(200);
  u.cookie = r.headers['set-cookie'][0].split(';')[0];
  await call(u, 'post', '/auth/logout', {}).expect(200);
  await call(u, 'get', '/auth/session').expect(401);
});
test('recovery is honestly unavailable and never returns a token', async () => {
  const r = await call(null, 'post', '/auth/recovery', {
    email: owner.email,
  }).expect(503);
  assert.equal(r.body.error.code, 'RECOVERY_UNAVAILABLE');
  assert.ok(!r.body.token);
});
test('auth rate limit applies to repeated unknown account attempts', async () => {
  for (let n = 0; n < 10; n++)
    await call(null, 'post', '/auth/login', {
      email: 'limited@example.test',
      password,
    }).expect(401);
  await call(null, 'post', '/auth/login', {
    email: 'limited@example.test',
    password,
  }).expect(429);
});

test('existing splits are retained and never counted as extra cash', async () => {
  const v = input();
  const row = (await call(owner, 'post', base() + '/transactions', v)).body
    .data;
  await admin.$transaction(async (tx) => {
    await tx.transactionSplit.createMany({
      data: [
        {
          workspaceId: wid,
          transactionId: row.id,
          categoryId: category.id,
          amountMinor: 600n,
        },
        {
          workspaceId: wid,
          transactionId: row.id,
          categoryId: category.id,
          amountMinor: 634n,
        },
      ],
    });
  });
  const read = (
    await call(owner, 'get', base() + '/transactions/' + row.id).expect(200)
  ).body.data;
  assert.equal(read.splits.length, 2);
  await call(owner, 'patch', base() + '/transactions/' + row.id, {
    version: row.version,
    date: row.date,
    description: 'Cannot erase split',
    type: 'expense',
    amountMinor: '-999',
    categoryId: category.id,
  }).expect(409);
  await call(owner, 'post', base() + '/transactions/' + row.id + '/exclusion', {
    version: row.version,
    excluded: true,
  }).expect(200);
  assert.equal(
    await admin.transactionSplit.count({ where: { transactionId: row.id } }),
    2,
  );
});
test('linked confirmed payment receipts cannot be edited or excluded', async () => {
  const v = {
    ...input(),
    type: 'income',
    amountMinor: '500',
    categoryId: null,
  };
  const row = (await call(owner, 'post', base() + '/transactions', v)).body
    .data;
  await admin.payment.create({
    data: {
      workspaceId: wid,
      currency: 'AUD',
      amountMinor: 500n,
      paidAt: new Date(v.date),
      idempotencyKey: randomUUID(),
      status: 'confirmed',
      transactionId: row.id,
      createdById: owner.id,
      method: 'manual',
    },
  });
  await call(owner, 'post', base() + '/transactions/' + row.id + '/exclusion', {
    version: row.version,
    excluded: true,
  }).expect(409);
  await call(owner, 'patch', base() + '/transactions/' + row.id, {
    version: row.version,
    date: v.date,
    description: 'Protected receipt',
    type: 'income',
    amountMinor: '600',
    categoryId: null,
  }).expect(409);
});
test('paired internal transfers remain neutral and cannot be independently excluded', async () => {
  const ids = [randomUUID(), randomUUID()];
  await admin.$transaction(async (tx) => {
    const second = await tx.financialAccount.create({
      data: {
        workspaceId: wid,
        currency: 'AUD',
        name: 'Transfer target',
        openingDate: new Date('2026-11-01'),
      },
    });
    await tx.transaction.createMany({
      data: ids.map((id, i) => ({
        id,
        workspaceId: wid,
        currency: 'AUD',
        accountId: i ? second.id : account.id,
        createdById: owner.id,
        bookingDate: new Date('2026-11-17'),
        originalDate: new Date('2026-11-17'),
        description: 'Neutral internal transfer',
        originalDescription: 'Neutral internal transfer',
        type: 'transfer',
        amountMinor: i ? 500n : -500n,
        originalAmountMinor: i ? 500n : -500n,
      })),
    });
    await tx.transactionTransfer.create({
      data: {
        workspaceId: wid,
        currency: 'AUD',
        outgoingTransactionId: ids[0],
        incomingTransactionId: ids[1],
      },
    });
  });
  const summary = (
    await call(
      owner,
      'get',
      base() + '/expenses/summary?currency=AUD&search=Neutral',
    ).expect(200)
  ).body.data;
  assert.equal(summary.incomeMinor, '0');
  assert.equal(summary.expenseMinor, '0');
  await call(owner, 'post', base() + '/transactions/' + ids[0] + '/exclusion', {
    version: 1,
    excluded: true,
  }).expect(409);
});
test('another workspace resource stays hidden even under an authorized path', async () => {
  const second = (
    await call(outsider, 'post', '/onboarding', {
      workspaceName: 'Isolated workspace',
      currency: 'EUR',
    }).expect(200)
  ).body.data.id;
  await call(
    outsider,
    'get',
    `/workspaces/${second}/accounts/${account.id}`,
  ).expect(404);
  await call(
    outsider,
    'post',
    `/workspaces/${second}/transactions`,
    input(),
  ).expect(400);
});
test('identical concurrent retries commit exactly one transaction and one audit event', async () => {
  const v = input();
  const results = await Promise.all([
    call(owner, 'post', base() + '/transactions', v),
    call(owner, 'post', base() + '/transactions', v),
  ]);
  assert.deepEqual(
    results.map((r) => r.status),
    [200, 200],
  );
  assert.equal(await admin.transaction.count({ where: { id: v.id } }), 1);
  assert.equal(
    await admin.activityLog.count({
      where: { entityId: v.id, action: 'created' },
    }),
    1,
  );
});

test('10C runtime has no broad DELETE, TRUNCATE or recovery-token grants', async () => {
  const rows =
    await db.$queryRaw`SELECT tablename, has_table_privilege(current_user, quote_ident(schemaname)||'.'||quote_ident(tablename),'DELETE') AS can_delete, has_table_privilege(current_user, quote_ident(schemaname)||'.'||quote_ident(tablename),'TRUNCATE') AS can_truncate FROM pg_tables WHERE schemaname='public'`;
  assert.deepEqual(
    rows.filter((r) => r.can_delete).map((r) => r.tablename),
    ['invoice_items'],
  );
  assert.ok(rows.every((r) => !r.can_truncate));
  await assert.rejects(
    db.$queryRaw`SELECT token_hash FROM password_reset_tokens LIMIT 0`,
  );
});
test('10C recovery remains equally unavailable for existing and unknown identities without generating tokens', async () => {
  const responses = await Promise.all(
    [owner.email, `unknown-${randomUUID()}@example.test`].map((email) =>
      call(null, 'post', '/auth/recovery', { email }),
    ),
  );
  assert.deepEqual(
    responses.map((r) => r.status),
    [503, 503],
  );
  assert.deepEqual(responses[0].body.error, responses[1].body.error);
  assert.equal(
    await admin.passwordResetToken.count({ where: { userId: owner.id } }),
    0,
  );
});
test('10C live database readiness exposes only availability', async () => {
  await request(app).get('/api/ready').expect(200, { status: 'ready' });
  await request(app)
    .get('/api/health')
    .expect(200, { status: 'ok', service: 'easyfinance-api' });
});
