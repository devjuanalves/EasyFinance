import 'dotenv/config';
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { createRuntimeClient, diagnoseRuntime } from '../src/db/runtime.js';
import { disposableClient } from '../../../database/scripts/client.js';
import {
  positionAt,
  portfolio,
} from '../../../packages/shared/src/investmentMath.js';
const db = createRuntimeClient(),
  db2 = createRuntimeClient(),
  admin = disposableClient();
const config = { webOrigin: 'http://localhost:5173', nodeEnv: 'test' },
  app = createApp({ db, config }),
  app2 = createApp({ db: db2, config });
let owner, editor, viewer, outsider, wid, account;
const call = (actor, method, path, body, server = app) => {
  const agent = request(server);
  let r = agent[method]('/api/v1' + path)
    .set('Origin', config.webOrigin)
    .set('X-EasyFinance-CSRF', '1');
  if (actor) r = r.set('Cookie', actor.cookie);
  return body === undefined ? r : r.send(body);
};
const base = () => `/workspaces/${wid}/investments`;
const cmd = (
  action,
  payload,
  version,
  actor = owner,
  key = randomUUID(),
  server = app,
) =>
  call(
    actor,
    'post',
    base() + '/commands',
    { key, action, payload, ...(version === undefined ? {} : { version }) },
    server,
  );
async function identity() {
  const email = `investment-${randomUUID()}@example.test`,
    password = 'Fictional-investment-password!';
  await call(null, 'post', '/auth/register', {
    email,
    password,
    fullName: 'Investment Tester',
  }).expect(200);
  const r = await call(null, 'post', '/auth/login', { email, password }).expect(
    200,
  );
  return {
    id: r.body.data.id,
    cookie: r.headers['set-cookie'][0].split(';')[0],
  };
}
const form = (extra = {}) => ({
  name: 'Fractional fund',
  assetType: 'ETFs',
  customType: '',
  symbol: 'TEST',
  investmentAccountId: account,
  currency: 'AUD',
  date: '2026-11-01',
  quantity: '2.5',
  unitPrice: '10.12345678',
  fee: '1.00',
  amount: '',
  estimatedValue: '30.00',
  valuedAt: '2026-11-01',
  notes: 'Fictional',
  tags: 'test',
  interestInfo: '',
  ...extra,
});
async function create(extra = {}) {
  return (await cmd('create', { form: form(extra) }).expect(200)).body.data;
}
const move = (extra = {}) => ({
  type: 'sell',
  currency: 'AUD',
  date: '2026-11-02',
  quantity: '1',
  unitPrice: '20',
  fee: '0.50',
  notes: '',
  ...extra,
});
const position = (r) =>
  positionAt(
    r.data,
    r.data.investments.find((i) => i.id === r.result) ||
      r.data.investments.at(-1),
  );
before(async () => {
  await diagnoseRuntime(db);
  owner = await identity();
  editor = await identity();
  viewer = await identity();
  outsider = await identity();
  wid = (
    await call(owner, 'post', '/onboarding', {
      workspaceName: 'Investment test',
      currency: 'AUD',
    }).expect(200)
  ).body.data.id;
  await admin.workspaceMember.createMany({
    data: [
      { workspaceId: wid, userId: editor.id, role: 'editor' },
      { workspaceId: wid, userId: viewer.id, role: 'viewer' },
    ],
  });
  account = (
    await cmd('createAccount', {
      name: 'Manual brokerage',
      institution: 'Fictional institution',
      currency: 'AUD',
    }).expect(200)
  ).body.data.result;
});
after(async () => {
  await Promise.all([db.$disconnect(), db2.$disconnect(), admin.$disconnect()]);
});
test('investment access requires real session, active membership and CSRF', async () => {
  await call(null, 'get', base()).expect(401);
  await call(outsider, 'get', base()).expect(404);
  await request(app)
    .post('/api/v1' + base() + '/commands')
    .set('Cookie', owner.cookie)
    .send({})
    .expect(403);
  await cmd(
    'createAccount',
    { name: 'Denied', institution: 'X', currency: 'AUD' },
    undefined,
    viewer,
  ).expect(403);
  await call(viewer, 'get', base()).expect(200);
});
test('fractional quantity and unit price persist exactly with server-rounded basis', async () => {
  const r = await create();
  const p = position(r);
  assert.equal(p.quantity, '2.5');
  assert.equal(p.basis, 2631);
  assert.equal(p.currentValue, 3000);
  const m = await admin.investmentMovement.findFirst({
    where: { investmentId: r.result },
  });
  assert.equal(m.unitPrice.toString(), '10.12345678');
  assert.equal(m.amountMinor, 2531n);
});
test('sale disposes proportional weighted average basis and net proceeds', async () => {
  const r = await create();
  const s = (
    await cmd('recordMovement', { id: r.result, form: move() }, 1).expect(200)
  ).body.data;
  const p = positionAt(
    s.data,
    s.data.investments.find((i) => i.id === r.result),
  );
  assert.equal(p.quantity, '1.5');
  assert.equal(p.basis, 1579);
  assert.equal(p.realized, 898);
  assert.equal(p.currentValue, null);
});
test('full sale removes residual basis exactly', async () => {
  const r = await create();
  const s = (
    await cmd(
      'recordMovement',
      { id: r.result, form: move({ quantity: '2.5' }) },
      1,
    ).expect(200)
  ).body.data;
  const p = positionAt(
    s.data,
    s.data.investments.find((i) => i.id === r.result),
  );
  assert.equal(p.basis, 0);
  assert.equal(p.quantity, '0');
  assert.equal(p.currentValue, 0);
  assert.equal(p.realized, 2319);
});
test('overselling and removal of dependent initial purchase roll back completely', async () => {
  const r = await create();
  await cmd(
    'recordMovement',
    { id: r.result, form: move({ quantity: '3' }) },
    1,
  ).expect(400);
  const before = await admin.investmentMovement.count({
    where: { investmentId: r.result },
  });
  assert.equal(before, 1);
  const s = (
    await cmd('recordMovement', { id: r.result, form: move() }, 1).expect(200)
  ).body.data;
  const initial = s.data.investmentMovements.find(
    (m) => m.investmentId === r.result && m.type === 'buy',
  );
  await cmd(
    'deleteMovement',
    { id: r.result, movementId: initial.id, confirmed: true },
    2,
  ).expect(400);
  assert.equal(
    (await admin.investment.findUnique({ where: { id: r.result } })).version,
    2,
  );
  assert.equal(
    (await admin.investmentMovement.findUnique({ where: { id: initial.id } }))
      .deletedAt,
    null,
  );
});
test('in-kind withdrawal removes cost without invented proceeds', async () => {
  const r = await create();
  const s = (
    await cmd(
      'recordMovement',
      {
        id: r.result,
        form: move({ type: 'withdrawal', quantity: '1', fee: '0.25' }),
      },
      1,
    ).expect(200)
  ).body.data;
  const p = positionAt(
    s.data,
    s.data.investments.find((i) => i.id === r.result),
  );
  assert.equal(p.basis, 1579);
  assert.equal(p.realized, 0);
  assert.equal(p.standaloneFees, 25);
});
test('distributions and standalone fees preserve position and valuation', async () => {
  const r = await create();
  await cmd(
    'recordMovement',
    {
      id: r.result,
      form: {
        type: 'dividend',
        currency: 'AUD',
        date: '2026-11-02',
        amount: '5.00',
        fee: '0.50',
        notes: '',
      },
    },
    1,
  ).expect(200);
  const s = (
    await cmd(
      'recordMovement',
      {
        id: r.result,
        form: {
          type: 'fee',
          currency: 'AUD',
          date: '2026-11-03',
          amount: '1',
          fee: '0',
          notes: '',
        },
      },
      2,
    ).expect(200)
  ).body.data;
  const p = positionAt(
    s.data,
    s.data.investments.find((i) => i.id === r.result),
  );
  assert.equal(p.currentValue, 3000);
  assert.equal(p.distributions, 450);
  assert.equal(p.totalReturn, 719);
});
test('principal contributions and withdrawals remain at cost', async () => {
  const r = await create({
    assetType: 'Fixed Income',
    amount: '100',
    fee: '0',
    estimatedValue: '105',
  });
  const s = (
    await cmd(
      'recordMovement',
      {
        id: r.result,
        form: {
          type: 'withdrawal',
          currency: 'AUD',
          date: '2026-11-02',
          amount: '40',
          fee: '0',
          notes: '',
        },
      },
      1,
    ).expect(200)
  ).body.data;
  const p = positionAt(
    s.data,
    s.data.investments.find((i) => i.id === r.result),
  );
  assert.equal(p.basis, 6000);
  assert.equal(p.realized, 0);
  await cmd('recordMovement', { id: r.result, form: move() }, 2).expect(400);
});
test('historical correction invalidates valuation and retains audit', async () => {
  const r = await create();
  const m = r.data.investmentMovements.find((m) => m.investmentId === r.result);
  const s = (
    await cmd(
      'editMovement',
      {
        id: r.result,
        movementId: m.id,
        confirmed: true,
        form: move({
          type: 'buy',
          date: '2026-11-01',
          quantity: '3',
          unitPrice: '10',
          fee: '0',
        }),
      },
      1,
    ).expect(200)
  ).body.data;
  const p = positionAt(
    s.data,
    s.data.investments.find((i) => i.id === r.result),
  );
  assert.equal(p.currentValue, null);
  assert.equal(p.basis, 3000);
  assert(
    s.data.investmentEvents.some(
      (e) => e.investmentId === r.result && e.type === 'Activity corrected',
    ),
  );
});
test('valuation snapshots survive refresh and soft deletion restores earlier value', async () => {
  const r = await create();
  const v = (
    await cmd(
      'valuation',
      {
        id: r.result,
        form: {
          currency: 'AUD',
          valuedAt: '2026-11-02',
          estimatedValue: '31.01',
          notes: 'manual',
        },
      },
      1,
    ).expect(200)
  ).body.data;
  await cmd(
    'deleteValuation',
    { id: r.result, valuationId: v.result, confirmed: true },
    2,
  ).expect(200);
  const data = (await call(owner, 'get', base()).expect(200)).body.data;
  assert.equal(
    positionAt(
      data,
      data.investments.find((i) => i.id === r.result),
    ).currentValue,
    3000,
  );
  assert(
    (await admin.investmentValuation.findUnique({ where: { id: v.result } }))
      .deletedAt,
  );
});
test('identical key retries create once; altered input conflicts', async () => {
  const key = randomUUID(),
    p = { form: form() };
  const r = (await cmd('create', p, undefined, owner, key).expect(200)).body
    .data;
  assert.equal(
    (await cmd('create', p, undefined, owner, key).expect(200)).body.data
      .result,
    r.result,
  );
  await cmd(
    'create',
    { form: form({ name: 'Changed' }) },
    undefined,
    owner,
    key,
  ).expect(409);
  assert.equal(
    await admin.investmentMovement.count({ where: { investmentId: r.result } }),
    1,
  );
});
test('independent connections reject competing oversales with one stale version', async () => {
  const [a] = await db.$queryRaw`SELECT pg_backend_pid() AS pid`;
  const [b] = await db2.$queryRaw`SELECT pg_backend_pid() AS pid`;
  assert.notEqual(a.pid, b.pid);
  const r = await create();
  const responses = await Promise.all([
    cmd(
      'recordMovement',
      { id: r.result, form: move({ quantity: '2' }) },
      1,
      owner,
      randomUUID(),
      app,
    ),
    cmd(
      'recordMovement',
      { id: r.result, form: move({ quantity: '2' }) },
      1,
      editor,
      randomUUID(),
      app2,
    ),
  ]);
  assert.deepEqual(responses.map((r) => r.status).sort(), [200, 409]);
  const data = (await call(owner, 'get', base())).body.data;
  assert.equal(
    positionAt(
      data,
      data.investments.find((i) => i.id === r.result),
    ).quantity,
    '0.5',
  );
});
test('independent identical requests produce one movement and audit', async () => {
  const r = await create(),
    key = randomUUID(),
    p = { id: r.result, form: move() };
  const results = await Promise.all([
    cmd('recordMovement', p, 1, owner, key, app),
    cmd('recordMovement', p, 1, owner, key, app2),
  ]);
  assert.deepEqual(
    results.map((r) => r.status),
    [200, 200],
  );
  assert.equal(results[0].body.data.result, results[1].body.data.result);
  assert.equal(
    await admin.investmentMovement.count({ where: { investmentId: r.result } }),
    2,
  );
});
test('currency mismatch, malformed decimals and unknown fields are rejected', async () => {
  for (const extra of [
    { currency: 'USD' },
    { quantity: '1e2' },
    { quantity: '0' },
    { unitPrice: '1.123456789' },
    { fee: '-1' },
    { date: '2026-02-30' },
    { role: 'owner' },
    { assetType: 'Invented' },
  ])
    await cmd('create', { form: form(extra) }).expect(400);
  await cmd('invented', {}).expect(400);
});
test('another workspace cannot use holdings or account identifiers', async () => {
  const r = await create();
  const other = (
    await call(outsider, 'post', '/onboarding', {
      workspaceName: 'Other investment workspace',
      currency: 'AUD',
    }).expect(200)
  ).body.data.id;
  await call(outsider, 'post', `/workspaces/${other}/investments/commands`, {
    key: randomUUID(),
    action: 'create',
    payload: { form: form() },
  }).expect(400);
  await call(outsider, 'post', `/workspaces/${other}/investments/commands`, {
    key: randomUUID(),
    action: 'recordMovement',
    payload: { id: r.result, form: move() },
    version: 1,
  }).expect(404);
});
test('revoked members lose portfolio access immediately', async () => {
  await admin.workspaceMember.update({
    where: { workspaceId_userId: { workspaceId: wid, userId: viewer.id } },
    data: { status: 'revoked', revokedAt: new Date() },
  });
  await call(viewer, 'get', base()).expect(404);
  await admin.workspaceMember.update({
    where: { workspaceId_userId: { workspaceId: wid, userId: viewer.id } },
    data: { status: 'active', revokedAt: null },
  });
});
test('investment writes leave cash, receipts, invoices and imports unchanged', async () => {
  const snapshot = async () =>
    Promise.all(
      ['transaction', 'payment', 'invoice', 'importBatch'].map((m) =>
        admin[m].findMany({
          where: { workspaceId: wid },
          orderBy: { id: 'asc' },
        }),
      ),
    );
  const before = await snapshot();
  const r = await create();
  await cmd('recordMovement', { id: r.result, form: move() }, 1).expect(200);
  assert.deepEqual(await snapshot(), before);
});
test('all-currency portfolio never exposes a combined value', async () => {
  const data = (await call(owner, 'get', base())).body.data;
  const p = portfolio(data, { workspaceId: wid, currency: 'all' });
  assert.equal(p.currentValue, null);
  assert.equal(p.basis, null);
  assert.deepEqual(p.allocation, []);
});
test('runtime investment grants prohibit deletion and schema ownership', async () => {
  const role = await diagnoseRuntime(db);
  assert.equal(role.role, 'easyfinance_9a_app');
  const [p] =
    await db.$queryRaw`SELECT has_table_privilege(current_user,'investments','DELETE') AS deletion, has_table_privilege(current_user,'investment_movements','TRUNCATE') AS truncate`;
  assert.equal(p.deletion, false);
  assert.equal(p.truncate, false);
});
test('multiple prices use weighted average and preserve fractional residuals', async () => {
  const r = await create({
    quantity: '1.25',
    unitPrice: '8',
    fee: '0',
    estimatedValue: '',
  });
  await cmd(
    'recordMovement',
    {
      id: r.result,
      form: move({ type: 'buy', quantity: '0.75', unitPrice: '20', fee: '0' }),
    },
    1,
  ).expect(200);
  const s = (
    await cmd(
      'recordMovement',
      {
        id: r.result,
        form: move({
          date: '2026-11-03',
          quantity: '0.4',
          unitPrice: '30',
          fee: '0.01',
        }),
      },
      2,
    ).expect(200)
  ).body.data;
  const p = positionAt(
    s.data,
    s.data.investments.find((i) => i.id === r.result),
  );
  assert.equal(p.quantity, '1.6');
  assert.equal(p.basis, 2000);
  assert.equal(p.realized, 699);
  assert.equal(p.averageCost, '12.5');
});
test('metadata edit retains history and rejects immutable type/currency', async () => {
  const r = await create();
  const f = form({ name: 'Renamed' });
  const allowed = [
    'name',
    'assetType',
    'customType',
    'symbol',
    'investmentAccountId',
    'currency',
    'notes',
    'tags',
    'interestInfo',
  ];
  const metadata = Object.fromEntries(allowed.map((k) => [k, f[k]]));
  const s = (
    await cmd('update', { id: r.result, form: metadata }, 1).expect(200)
  ).body.data;
  assert.equal(
    positionAt(
      s.data,
      s.data.investments.find((i) => i.id === r.result),
    ).basis,
    2631,
  );
  await cmd(
    'update',
    { id: r.result, form: { ...metadata, assetType: 'Stocks' } },
    2,
  ).expect(400);
  await cmd('update', { id: r.result, form: metadata }, 1).expect(409);
});
test('zero valuation is explicit; absent valuation is unavailable', async () => {
  const r = await create({ estimatedValue: '' });
  assert.equal(position(r).currentValue, null);
  const s = (
    await cmd(
      'valuation',
      {
        id: r.result,
        form: {
          currency: 'AUD',
          valuedAt: '2026-11-02',
          estimatedValue: '0',
          notes: '',
        },
      },
      1,
    ).expect(200)
  ).body.data;
  assert.equal(
    positionAt(
      s.data,
      s.data.investments.find((i) => i.id === r.result),
    ).currentValue,
    0,
  );
  await cmd(
    'valuation',
    {
      id: r.result,
      form: {
        currency: 'USD',
        valuedAt: '2026-11-02',
        estimatedValue: '10',
        notes: '',
      },
    },
    2,
  ).expect(400);
});
test('pending invitation does not grant investment access', async () => {
  const u = await admin.user.findUnique({ where: { id: outsider.id } });
  await admin.workspaceInvitation.create({
    data: {
      workspaceId: wid,
      invitedEmail: u.email,
      role: 'editor',
      tokenHash: createHash('sha256').update(randomUUID()).digest('hex'),
      expiresAt: new Date(Date.now() + 86400000),
      invitedById: owner.id,
    },
  });
  await call(outsider, 'get', base()).expect(404);
});
test('audit write failure rolls back investment, movement and valuation together', async () => {
  const { investments } = await import('../src/services/investments.js');
  const session = await admin.authSession.findFirst({
    where: { userId: owner.id },
    orderBy: { createdAt: 'desc' },
  });
  const count = async () =>
    Promise.all(
      [
        'investment',
        'investmentMovement',
        'investmentValuation',
        'activityLog',
      ].map((m) => admin[m].count({ where: { workspaceId: wid } })),
    );
  const before = await count();
  const failing = {
    $transaction: (fn, options) =>
      db.$transaction(
        (tx) =>
          fn(
            new Proxy(tx, {
              get(target, key) {
                if (key === 'activityLog')
                  return {
                    ...target.activityLog,
                    create: () => {
                      throw new Error('Injected audit failure');
                    },
                  };
                return target[key];
              },
            }),
          ),
        options,
      ),
  };
  await assert.rejects(
    investments(failing).command(
      { userId: owner.id, hash: session.tokenHash },
      wid,
      { key: randomUUID(), action: 'create', payload: { form: form() } },
    ),
    /Injected audit failure/,
  );
  assert.deepEqual(await count(), before);
});
test('existing receipt and imported expense remain byte-equivalent after portfolio changes', async () => {
  const root = `/workspaces/${wid}`;
  const cash = (await call(owner, 'get', root + '/accounts').expect(200)).body
    .data[0];
  const client = (
    await call(owner, 'post', root + '/clients', {
      id: randomUUID(),
      type: 'business',
      name: 'Portfolio test client',
      businessName: 'Fictional',
      email: 'portfolio@example.test',
      defaultCurrency: 'AUD',
      paymentTerms: '14',
    }).expect(200)
  ).body.data;
  let invoice = (
    await call(owner, 'post', root + '/invoices', {
      id: randomUUID(),
      number: randomUUID(),
      clientId: client.id,
      accountId: cash.id,
      currency: 'AUD',
      issuedDate: '2026-11-01',
      dueDate: '2026-12-01',
      paymentTerms: '30',
      items: [
        {
          description: 'Fictional',
          quantity: '1',
          unit: 'hours',
          unitPrice: '100',
          taxRate: '0',
        },
      ],
      discount: '0',
      notes: '',
      paymentInstructions: '',
    }).expect(200)
  ).body.data;
  invoice = (
    await call(owner, 'post', root + `/invoices/${invoice.id}/issue`, {
      version: invoice.version,
    }).expect(200)
  ).body.data;
  await call(owner, 'post', root + `/invoices/${invoice.id}/payments`, {
    idempotencyKey: randomUUID(),
    amountMinor: '2500',
    date: '2026-11-02',
    method: 'bank transfer',
    reference: 'Fictional receipt',
  }).expect(200);
  const source = {
    csv: 'date,description,amount,currency\n2026-11-03,Fictional imported expense,-12.34,AUD',
    fileName: 'fictional.csv',
    accountId: cash.id,
    currency: 'AUD',
    mapping: {
      date: '0',
      description: '1',
      amount: '2',
      currency: '3',
      reference: '',
      debit: '',
      credit: '',
    },
    options: {
      delimiter: 'auto',
      dateFormat: 'iso',
      decimal: 'dot',
      start: '2026-11-01',
      end: '2026-11-30',
    },
  };
  const preview = (
    await call(owner, 'post', root + '/imports/preview', source).expect(200)
  ).body.data;
  await call(owner, 'post', root + '/imports', {
    ...source,
    key: randomUUID(),
    previewHash: preview.previewHash,
    confirmed: true,
    decisions: preview.rows.map((r) => ({
      rowNumber: r.rowNumber,
      decision: 'keep',
      categoryId: null,
    })),
  }).expect(200);
  const snapshot = async () =>
    Promise.all(
      [
        'transaction',
        'payment',
        'paymentAllocation',
        'invoice',
        'importBatch',
      ].map((m) =>
        admin[m].findMany({
          where: { workspaceId: wid },
          orderBy: { id: 'asc' },
        }),
      ),
    );
  const before = await snapshot();
  const balance = (await call(owner, 'get', root + '/accounts').expect(200))
    .body.data;
  const r = await create();
  await cmd('recordMovement', { id: r.result, form: move() }, 1).expect(200);
  await cmd(
    'valuation',
    {
      id: r.result,
      form: {
        currency: 'AUD',
        valuedAt: '2026-11-04',
        estimatedValue: '1000',
        notes: '',
      },
    },
    2,
  ).expect(200);
  assert.deepEqual(await snapshot(), before);
  assert.deepEqual(
    (await call(owner, 'get', root + '/accounts').expect(200)).body.data,
    balance,
  );
});
test('smallest eight-decimal quantity and price serialize without exponent notation', async () => {
  const r = await create({
    quantity: '0.00000001',
    unitPrice: '9999999999.99999999',
    fee: '0',
    estimatedValue: '',
  });
  assert.equal(position(r).quantity, '0.00000001');
  assert.equal(position(r).basis, 10000);
  const tiny = await create({
    quantity: '2.5',
    unitPrice: '0.00000001',
    fee: '0',
    estimatedValue: '',
  });
  assert.equal(
    tiny.data.investmentMovements.find((m) => m.investmentId === tiny.result)
      .unitPrice,
    '0.00000001',
  );
  assert.equal(position(tiny).basis, 0);
});
