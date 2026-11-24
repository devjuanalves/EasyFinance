import 'dotenv/config';
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { createRuntimeClient, diagnoseRuntime } from '../src/db/runtime.js';
import { disposableClient } from '../../../database/scripts/client.js';
const db = createRuntimeClient(),
  db2 = createRuntimeClient(),
  admin = disposableClient();
const config = { webOrigin: 'http://localhost:5173', nodeEnv: 'test' },
  app = createApp({ db, config }),
  app2 = createApp({ db: db2, config });
let owner, editor, viewer, outsider, wid;
const call = (a, method, path, body, server = app) => {
  const agent = request(server);
  let r = agent[method]('/api/v1' + path)
    .set('Origin', config.webOrigin)
    .set('X-EasyFinance-CSRF', '1');
  if (a) r = r.set('Cookie', a.cookie);
  return body === undefined ? r : r.send(body);
};
const root = () => `/workspaces/${wid}`;
async function identity() {
  const email = `collaboration-${randomUUID()}@example.test`,
    password = 'Fictional-collaboration-password!';
  await call(null, 'post', '/auth/register', {
    email,
    password,
    fullName: 'Collaboration tester',
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
const invite = async (a, role = 'viewer') =>
  (
    await call(owner, 'post', root() + '/invitations', {
      email: a.email,
      role,
    }).expect(200)
  ).body.data;
const form = (extra = {}) => ({
  id: randomUUID(),
  name: 'Review finances',
  type: 'alert',
  frequency: 'monthly',
  nextDate: '2026-12-01',
  timeZone: 'Australia/Sydney',
  status: 'active',
  ...extra,
});
before(async () => {
  await diagnoseRuntime(db);
  owner = await identity();
  editor = await identity();
  viewer = await identity();
  outsider = await identity();
  wid = (
    await call(owner, 'post', '/onboarding', {
      workspaceName: 'Collaboration test',
      currency: 'AUD',
    }).expect(200)
  ).body.data.id;
  await admin.workspaceMember.createMany({
    data: [
      { workspaceId: wid, userId: editor.id, role: 'editor' },
      { workspaceId: wid, userId: viewer.id, role: 'viewer' },
    ],
  });
});
after(async () => {
  await Promise.all([db.$disconnect(), db2.$disconnect(), admin.$disconnect()]);
});
test('settings require real authentication, active scope and CSRF', async () => {
  await call(null, 'get', root() + '/settings').expect(401);
  await call(outsider, 'get', root() + '/settings').expect(404);
  await request(app)
    .post('/api/v1' + root() + '/invitations')
    .set('Cookie', owner.cookie)
    .send({})
    .expect(403);
});
test('Owner settings are readable by members without leaking personal credentials', async () => {
  for (const a of [owner, editor, viewer]) {
    const r = (await call(a, 'get', root() + '/settings').expect(200)).body
      .data;
    assert.equal(r.members.length, 3);
    assert(!JSON.stringify(r).includes('passwordHash'));
    assert(!JSON.stringify(r).includes('tokenHash'));
    assert.equal(r.executionEnabled, false);
  }
});
test('Editor and Viewer cannot manage workspace, invitations or automations', async () => {
  for (const a of [editor, viewer]) {
    await call(a, 'post', root() + '/invitations', {
      email: outsider.email,
      role: 'viewer',
    }).expect(403);
    await call(a, 'post', root() + '/automations', form()).expect(403);
    await call(a, 'patch', root() + '/settings/workspace', {
      name: 'Denied',
      type: 'personal',
      baseCurrency: 'AUD',
      timeZone: 'UTC',
    }).expect(403);
  }
});
test('personal preferences are self-scoped and reject mass assignment', async () => {
  const body = {
    fullName: 'Own name',
    preferences: {
      language: 'en',
      currency: 'USD',
      dateFormat: 'YYYY-MM-DD',
      numberFormat: '1,234.56',
      timeZone: 'UTC',
      monthStart: 2,
    },
  };
  await call(viewer, 'patch', root() + '/settings/profile', body).expect(200);
  assert.equal(
    (await admin.user.findUnique({ where: { id: viewer.id } })).fullName,
    'Own name',
  );
  await call(viewer, 'patch', root() + '/settings/profile', {
    ...body,
    userId: owner.id,
  }).expect(400);
});
test('workspace metadata persists while base currency changes are rejected', async () => {
  const body = {
    name: 'Renamed workspace',
    type: 'shared',
    baseCurrency: 'AUD',
    timeZone: 'UTC',
  };
  await call(owner, 'patch', root() + '/settings/workspace', body).expect(200);
  await call(owner, 'patch', root() + '/settings/workspace', {
    ...body,
    baseCurrency: 'USD',
  }).expect(409);
  assert.equal(
    (await admin.workspace.findUnique({ where: { id: wid } })).baseCurrency,
    'AUD',
  );
});
test('invitation secret is random, hashed, expiring and absent from list and audit', async () => {
  const i = await invite(outsider);
  assert.match(i.token, /^[a-f0-9]{64}$/);
  const row = await admin.workspaceInvitation.findUnique({
    where: { id: i.id },
  });
  assert.equal(
    row.tokenHash,
    createHash('sha256').update(i.token).digest('hex'),
  );
  assert(row.expiresAt > new Date());
  const list = (await call(owner, 'get', root() + '/settings')).body;
  assert(!JSON.stringify(list).includes(i.token));
  await call(outsider, 'get', root() + '/settings').expect(404);
  await call(owner, 'post', root() + '/invitations', {
    email: outsider.email,
    role: 'viewer',
  }).expect(409);
  await call(owner, 'post', root() + `/invitations/${i.id}/revoke`, {}).expect(
    200,
  );
});
test('revoked and wrong-email invitations cannot be accepted', async () => {
  const u = await identity(),
    i = await invite(u);
  await call(outsider, 'post', '/invitations/accept', {
    token: i.token,
  }).expect(404);
  await call(owner, 'post', root() + `/invitations/${i.id}/revoke`, {}).expect(
    200,
  );
  await call(u, 'post', '/invitations/accept', { token: i.token }).expect(409);
});
test('expired tokens reject acceptance and a fresh invitation is possible', async () => {
  const u = await identity(),
    i = await invite(u);
  await admin.workspaceInvitation.update({
    where: { id: i.id },
    data: {
      createdAt: new Date(Date.now() - 20000),
      expiresAt: new Date(Date.now() - 10000),
    },
  });
  await call(u, 'post', '/invitations/accept', { token: i.token }).expect(409);
  await invite(u);
});
test('concurrent acceptance on independent connections creates one membership and one audit', async () => {
  const u = await identity(),
    i = await invite(u);
  const [a, b] = await Promise.all([
    db.$queryRaw`SELECT pg_backend_pid() AS pid`,
    db2.$queryRaw`SELECT pg_backend_pid() AS pid`,
  ]);
  assert.notEqual(a[0].pid, b[0].pid);
  const results = await Promise.all([
    call(u, 'post', '/invitations/accept', { token: i.token }),
    call(u, 'post', '/invitations/accept', { token: i.token }, app2),
  ]);
  assert.deepEqual(
    results.map((r) => r.status),
    [200, 200],
  );
  assert.equal(
    await admin.workspaceMember.count({
      where: { workspaceId: wid, userId: u.id },
    }),
    1,
  );
  assert.equal(
    await admin.activityLog.count({
      where: { entityId: i.id, action: 'Invitation accepted' },
    }),
    1,
  );
});
test('concurrent duplicate invites serialize and only one remains pending', async () => {
  const u = await identity();
  const rs = await Promise.all([
    call(owner, 'post', root() + '/invitations', {
      email: u.email,
      role: 'viewer',
    }),
    call(
      owner,
      'post',
      root() + '/invitations',
      { email: u.email, role: 'viewer' },
      app2,
    ),
  ]);
  assert.deepEqual(rs.map((r) => r.status).sort(), [200, 409]);
});
test('owner role is protected and role escalation rejected', async () => {
  const m = await admin.workspaceMember.findFirst({
    where: { workspaceId: wid, userId: owner.id },
  });
  await call(owner, 'patch', root() + `/members/${m.id}`, {
    role: 'viewer',
    status: 'revoked',
  }).expect(409);
  await call(owner, 'post', root() + '/invitations', {
    email: outsider.email,
    role: 'owner',
  }).expect(400);
  await call(viewer, 'patch', root() + `/members/${m.id}`, {
    role: 'editor',
    status: 'active',
  }).expect(403);
});
test('removal revokes access and repeated acceptance cannot restore it', async () => {
  const u = await identity(),
    i = await invite(u);
  await call(u, 'post', '/invitations/accept', { token: i.token }).expect(200);
  const m = await admin.workspaceMember.findFirst({
    where: { workspaceId: wid, userId: u.id },
  });
  await call(owner, 'patch', root() + `/members/${m.id}`, {
    role: 'viewer',
    status: 'revoked',
  }).expect(200);
  await call(u, 'get', root() + '/settings').expect(404);
  await call(u, 'post', '/invitations/accept', { token: i.token }).expect(409);
});
test('automation configuration retry is idempotent and creates no execution or financial entry', async () => {
  const b = form();
  const a = (await call(owner, 'post', root() + '/automations', b).expect(200))
    .body.data;
  await call(owner, 'post', root() + '/automations', b).expect(200);
  assert.equal(await admin.automationRule.count({ where: { id: a.id } }), 1);
  assert.equal(
    await admin.automationRun.count({ where: { workspaceId: wid } }),
    0,
  );
  assert.equal(
    await admin.transaction.count({ where: { workspaceId: wid } }),
    0,
  );
  await call(owner, 'post', root() + '/automations', {
    ...b,
    name: 'Different',
  }).expect(409);
});
test('invalid automation types, zones, dates, targets and injected permissions reject', async () => {
  for (const patch of [
    { type: 'send_money' },
    { timeZone: 'Not/AZone' },
    { nextDate: '2026-02-30' },
    { role: 'owner' },
    { type: 'reminder', invoiceId: randomUUID(), timing: 'on' },
  ])
    await call(owner, 'post', root() + '/automations', form(patch)).expect(400);
});
test('automation edits detect stale versions and archive preserves records', async () => {
  const b = form(),
    a = (await call(owner, 'post', root() + '/automations', b)).body.data;
  const { id, ...f } = b;
  await call(owner, 'patch', root() + `/automations/${id}`, {
    ...f,
    status: 'paused',
    updatedAt: a.updatedAt,
  }).expect(200);
  await call(owner, 'patch', root() + `/automations/${id}`, {
    ...f,
    updatedAt: a.updatedAt,
  }).expect(409);
  const latest = await admin.automationRule.findUnique({ where: { id } });
  await call(owner, 'patch', root() + `/automations/${id}`, {
    ...f,
    status: 'archived',
    updatedAt: latest.updatedAt.toISOString(),
  }).expect(200);
  assert.equal(
    (await admin.automationRule.findUnique({ where: { id } })).status,
    'archived',
  );
  await call(owner, 'post', root() + `/automations/${id}/run`, {}).expect(404);
});
test('runtime role cannot delete collaboration records or write execution history', async () => {
  const [p] =
    await db.$queryRaw`SELECT has_table_privilege(current_user,'workspace_invitations','DELETE') AS deletion, has_table_privilege(current_user,'automation_runs','INSERT') AS execution`;
  assert.equal(p.deletion, false);
  assert.equal(p.execution, false);
});
test('failed audit rolls back invitation and token creation', async () => {
  const { collaboration } = await import('../src/services/collaboration.js');
  const session = await admin.authSession.findFirst({
    where: { userId: owner.id },
    orderBy: { createdAt: 'desc' },
  });
  const u = await identity();
  const failing = {
    $transaction: (fn, opts) =>
      db.$transaction(
        (tx) =>
          fn(
            new Proxy(tx, {
              get(t, k) {
                if (k === 'activityLog')
                  return {
                    ...t.activityLog,
                    create: () => {
                      throw new Error('Injected audit failure');
                    },
                  };
                return t[k];
              },
            }),
          ),
        opts,
      ),
  };
  await assert.rejects(
    collaboration(failing).invite(
      { userId: owner.id, hash: session.tokenHash },
      wid,
      { email: u.email, role: 'viewer' },
    ),
    /Injected audit failure/,
  );
  assert.equal(
    await admin.workspaceInvitation.count({
      where: { workspaceId: wid, invitedEmail: u.email },
    }),
    0,
  );
});
test('notification preferences persist for the recipient only and reject arbitrary events', async () => {
  const { EVENTS } =
    await import('../../../packages/shared/src/notificationEvents.js');
  const body = {
    enabled: Object.fromEntries(
      Object.values(EVENTS)
        .flat()
        .map((e) => [e, false]),
    ),
    frequency: 'weekly',
    time: '10:30',
    timeZone: 'UTC',
  };
  await call(viewer, 'patch', root() + '/settings/notifications', body).expect(
    200,
  );
  const read = (await call(viewer, 'get', root() + '/settings')).body.data
    .notificationPreferences;
  assert.deepEqual(read, body);
  const other = (await call(owner, 'get', root() + '/settings')).body.data
    .notificationPreferences;
  assert.equal(other.frequency, 'immediate');
  await call(viewer, 'patch', root() + '/settings/notifications', {
    ...body,
    userId: owner.id,
  }).expect(400);
  await call(viewer, 'patch', root() + '/settings/notifications', {
    ...body,
    enabled: { ...body.enabled, forged: true },
  }).expect(400);
});
test('cross-workspace invitation, automation and member IDs are inaccessible', async () => {
  const other = (
    await call(outsider, 'post', '/onboarding', {
      workspaceName: 'Other workspace',
      currency: 'USD',
    }).expect(200)
  ).body.data.id;
  const u = await identity(),
    i = await invite(u),
    b = form();
  await call(owner, 'post', root() + '/automations', b).expect(200);
  await call(
    outsider,
    'post',
    `/workspaces/${other}/invitations/${i.id}/revoke`,
    {},
  ).expect(404);
  const a = await admin.automationRule.findUnique({ where: { id: b.id } }),
    { id, ...f } = b;
  await call(outsider, 'patch', `/workspaces/${other}/automations/${id}`, {
    ...f,
    updatedAt: a.updatedAt.toISOString(),
  }).expect(404);
  const m = await admin.workspaceMember.findFirst({
    where: { workspaceId: wid, userId: viewer.id },
  });
  await call(outsider, 'patch', `/workspaces/${other}/members/${m.id}`, {
    role: 'editor',
    status: 'active',
  }).expect(404);
});
test('concurrent automation edits commit exactly one version and audit', async () => {
  const b = form(),
    a = (await call(owner, 'post', root() + '/automations', b)).body.data,
    { id, ...f } = b;
  const replies = await Promise.all([
    call(owner, 'patch', root() + `/automations/${id}`, {
      ...f,
      name: 'Version A',
      updatedAt: a.updatedAt,
    }),
    call(
      owner,
      'patch',
      root() + `/automations/${id}`,
      { ...f, name: 'Version B', updatedAt: a.updatedAt },
      app2,
    ),
  ]);
  assert.deepEqual(replies.map((r) => r.status).sort(), [200, 409]);
  assert.equal(
    await admin.activityLog.count({
      where: { entityId: id, action: 'Automation configuration updated' },
    }),
    1,
  );
});
test('settings and automation writes preserve an existing cash transaction exactly', async () => {
  const account = (await call(owner, 'get', root() + '/accounts')).body.data[0];
  await call(owner, 'post', root() + '/transactions', {
    id: randomUUID(),
    accountId: account.id,
    currency: 'AUD',
    date: '2026-11-24',
    description: 'Fictional expense',
    type: 'expense',
    amountMinor: '-1234',
  }).expect(200);
  const before = await admin.transaction.findMany({
    where: { workspaceId: wid },
  });
  await call(owner, 'post', root() + '/automations', form()).expect(200);
  await call(owner, 'patch', root() + '/settings/workspace', {
    name: 'Preserved ledger',
    type: 'shared',
    baseCurrency: 'AUD',
    timeZone: 'Europe/London',
  }).expect(200);
  assert.deepEqual(
    await admin.transaction.findMany({ where: { workspaceId: wid } }),
    before,
  );
});
