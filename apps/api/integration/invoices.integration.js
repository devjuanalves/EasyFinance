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
let owner, editor, viewer, outsider, wid, account, client, editorMember;
const call = (actor, method, path, body, server = app) => {
  const agent = request(server);
  let r = agent[method]('/api/v1' + path)
    .set('Origin', config.webOrigin)
    .set('X-EasyFinance-CSRF', '1');
  if (actor) r = r.set('Cookie', actor.cookie);
  return body === undefined ? r : r.send(body);
};
async function identity() {
  const email = `9b1-${randomUUID()}@example.test`,
    password = 'Fictional-invoice-password-123!';
  await call(null, 'post', '/auth/register', {
    email,
    password,
    fullName: 'Invoice Tester',
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
const clientBody = () => ({
  id: randomUUID(),
  type: 'business',
  name: 'Test Customer',
  businessName: 'Fictional Company',
  email: 'client@example.test',
  defaultCurrency: 'AUD',
  paymentTerms: '14',
});
const draft = () => ({
  id: randomUUID(),
  number: `INV-${randomUUID()}`,
  clientId: client.id,
  accountId: account.id,
  currency: 'AUD',
  issuedDate: '2026-11-19',
  dueDate: '2026-12-19',
  paymentTerms: '30',
  items: [
    {
      description: 'Consulting',
      quantity: '1.5',
      unit: 'hours',
      unitPrice: '100',
      taxRate: '10',
    },
  ],
  discount: '10',
  notes: '',
  paymentInstructions: '',
});
async function create(input = draft()) {
  return (await call(owner, 'post', base() + '/invoices', input).expect(200))
    .body.data;
}
async function issue(row) {
  return (
    await call(owner, 'post', base() + `/invoices/${row.id}/issue`, {
      version: row.version,
    }).expect(200)
  ).body.data;
}
const pay = (amount = '5000') => ({
  idempotencyKey: randomUUID(),
  amountMinor: amount,
  date: '2026-11-19',
  method: 'bank transfer',
  reference: 'Fictional receipt',
});
async function payment(row, input = pay(), actor = owner, server = app) {
  return call(
    actor,
    'post',
    base() + `/invoices/${row.id}/payments`,
    input,
    server,
  );
}
before(async () => {
  await diagnoseRuntime(db);
  owner = await identity();
  editor = await identity();
  viewer = await identity();
  outsider = await identity();
  wid = (
    await call(owner, 'post', '/onboarding', {
      workspaceName: 'Invoice test workspace',
      currency: 'AUD',
    }).expect(200)
  ).body.data.id;
  account = (await call(owner, 'get', base() + '/accounts').expect(200)).body
    .data[0];
  client = (
    await call(owner, 'post', base() + '/clients', clientBody()).expect(200)
  ).body.data;
  editorMember = await admin.workspaceMember.create({
    data: { workspaceId: wid, userId: editor.id, role: 'editor' },
  });
  await admin.workspaceMember.create({
    data: { workspaceId: wid, userId: viewer.id, role: 'viewer' },
  });
});
after(async () => {
  await db.$disconnect();
  await db2.$disconnect();
  await admin.$disconnect();
});
test('draft calculates fractional quantity, proportional discount and configured tax', async () => {
  const r = await create();
  assert.equal(r.subtotalMinor, '15000');
  assert.equal(r.discountMinor, '1000');
  assert.equal(r.taxMinor, '1400');
  assert.equal(r.totalMinor, '15400');
  assert.equal(r.status, 'draft');
  assert.equal(r.paidMinor, '0');
});
test('half-up rounding and free-line residual match shared calculation and SQL checks', async () => {
  const b = draft();
  b.items = [
    {
      description: 'Fraction',
      quantity: '0.3333',
      unitPrice: '0.15',
      taxRate: '10',
    },
    { description: 'Free', quantity: '1', unitPrice: '0', taxRate: '0' },
  ];
  b.discount = '0.01';
  const r = await create(b);
  assert.equal(r.totalMinor, '4');
  assert.equal(r.subtotalMinor, '5');
});
test('draft edit replaces items atomically and rejects stale version', async () => {
  const b = draft(),
    r = await create(b);
  delete b.id;
  b.version = r.version;
  b.items[0].quantity = '2';
  const changed = await call(
    owner,
    'patch',
    base() + `/invoices/${r.id}`,
    b,
  ).expect(200);
  assert.equal(changed.body.data.totalMinor, '20900');
  await call(owner, 'patch', base() + `/invoices/${r.id}`, b).expect(409);
});
test('creation retries are idempotent, changed request conflicts', async () => {
  const b = draft(),
    r = await create(b),
    again = await create(b);
  assert.equal(r.id, again.id);
  b.number += 'x';
  await call(owner, 'post', base() + '/invoices', b).expect(409);
});
test('issue does not create income; issued invoice cannot be edited or reissued', async () => {
  const before = (
      await call(owner, 'get', base() + '/expenses/summary?currency=AUD')
    ).body.data.incomeMinor,
    b = draft(),
    r = await issue(await create(b));
  assert.equal(r.status, 'issued');
  assert.equal(
    (await call(owner, 'get', base() + '/expenses/summary?currency=AUD')).body
      .data.incomeMinor,
    before,
  );
  delete b.id;
  b.version = r.version;
  await call(owner, 'patch', base() + `/invoices/${r.id}`, b).expect(409);
  await call(owner, 'post', base() + `/invoices/${r.id}/issue`, {
    version: r.version,
  }).expect(409);
});
test('partial and final payments reconcile history, ledger, summary and account balance', async () => {
  const r = await issue(await create()),
    before = (await call(owner, 'get', base() + `/accounts/${account.id}`)).body
      .data.balanceMinor;
  let p = await payment(r);
  assert.equal(p.status, 200);
  assert.equal(p.body.data.invoice.outstandingMinor, '10400');
  assert.equal(p.body.data.invoice.status, 'partial');
  p = await payment(r, pay('10400'));
  assert.equal(p.status, 200);
  assert.equal(p.body.data.invoice.status, 'paid');
  assert.equal(p.body.data.invoice.payments.length, 2);
  const balance = (await call(owner, 'get', base() + `/accounts/${account.id}`))
    .body.data.balanceMinor;
  assert.equal(BigInt(balance) - BigInt(before), 15400n);
  await call(
    owner,
    'post',
    base() + `/transactions/${p.body.data.transactionId}/exclusion`,
    { version: 1, excluded: true },
  ).expect(409);
});
test('duplicate payment key returns original outcome, changed amount conflicts', async () => {
  const r = await issue(await create()),
    b = pay(),
    p = await payment(r, b),
    again = await payment(r, b);
  assert.equal(p.status, 200);
  assert.deepEqual(again.body.data, p.body.data);
  assert.equal((await payment(r, { ...b, amountMinor: '5001' })).status, 409);
});
test('overpayment and invalid amounts roll back without orphan receipts', async () => {
  const r = await issue(await create()),
    before = await admin.transaction.count({ where: { workspaceId: wid } });
  assert.equal((await payment(r, pay('15401'))).status, 409);
  for (const amount of ['0', '-1', '1.2', '1e3'])
    assert.equal((await payment(r, pay(amount))).status, 400);
  assert.equal(
    await admin.transaction.count({ where: { workspaceId: wid } }),
    before,
  );
});
test('draft and cancelled invoices cannot accept payments; allocated invoices cannot cancel', async () => {
  let r = await create();
  assert.equal((await payment(r)).status, 409);
  r = (
    await call(owner, 'post', base() + `/invoices/${r.id}/cancel`, {
      version: r.version,
    }).expect(200)
  ).body.data;
  assert.equal((await payment(r)).status, 409);
  const issued = await issue(await create()),
    p = await payment(issued);
  await call(owner, 'post', base() + `/invoices/${issued.id}/cancel`, {
    version: p.body.data.invoice.version,
  }).expect(409);
});
test('existing income receipt reused across invoices without duplicate income', async () => {
  const r = await issue(await create()),
    r2 = await issue(await create()),
    receipt = (
      await call(owner, 'post', base() + '/transactions', {
        id: randomUUID(),
        accountId: account.id,
        currency: 'AUD',
        date: '2026-11-19',
        description: 'Advance',
        type: 'income',
        amountMinor: '10000',
      }).expect(200)
    ).body.data;
  const before = (
    await call(owner, 'get', base() + '/income/summary?currency=AUD')
  ).body.data.receivedMinor;
  const p = await payment(r, { ...pay('4000'), transactionId: receipt.id }),
    p2 = await payment(r2, { ...pay('6000'), transactionId: receipt.id });
  assert.equal(p.status, 200);
  assert.equal(p2.status, 200);
  assert.equal(p.body.data.paymentId, p2.body.data.paymentId);
  assert.equal(
    (await payment(r2, { ...pay('1'), transactionId: receipt.id })).status,
    409,
  );
  assert.equal(
    (await call(owner, 'get', base() + '/income/summary?currency=AUD')).body
      .data.receivedMinor,
    before,
  );
});
test('independent runtime connections serialize competing allocations, one winner', async () => {
  const [x, y] = await Promise.all([
    db.$queryRaw`SELECT pg_backend_pid() AS pid`,
    db2.$queryRaw`SELECT pg_backend_pid() AS pid`,
  ]);
  assert.notEqual(x[0].pid, y[0].pid);
  const r = await issue(await create());
  const results = await Promise.all([
    payment(r, pay('10000'), owner, app),
    payment(r, pay('10000'), editor, app2),
  ]);
  assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
  const row = (await call(owner, 'get', base() + `/invoices/${r.id}`)).body
    .data;
  assert.equal(row.paidMinor, '10000');
});
test('concurrent identical keys create one receipt', async () => {
  const r = await issue(await create()),
    b = pay();
  const results = await Promise.all([
    payment(r, b, owner, app),
    payment(r, b, owner, app2),
  ]);
  assert.ok(results.every((r) => r.status === 200));
  assert.equal(results[0].body.data.paymentId, results[1].body.data.paymentId);
});
test('viewer read allowed but invoice/client/payment mutations forbidden', async () => {
  const r = await issue(await create());
  await call(viewer, 'get', base() + `/invoices/${r.id}`).expect(200);
  await call(viewer, 'post', base() + '/invoices', draft()).expect(403);
  await call(viewer, 'post', base() + '/clients', clientBody()).expect(403);
  assert.equal((await payment(r, pay(), viewer)).status, 403);
});
test('cross-workspace and unauthenticated invoice/payment access rejected', async () => {
  const r = await issue(await create()),
    p = await payment(r);
  await call(outsider, 'get', base() + `/invoices/${r.id}`).expect(404);
  await call(
    outsider,
    'get',
    base() + `/payments/${p.body.data.paymentId}`,
  ).expect(404);
  await call(null, 'get', base() + '/invoices?currency=AUD').expect(401);
  const other = (
    await call(outsider, 'post', '/onboarding', {
      workspaceName: 'Other',
      currency: 'AUD',
    })
  ).body.data.id;
  await call(outsider, 'get', `/workspaces/${other}/invoices/${r.id}`).expect(
    404,
  );
  await call(
    outsider,
    'get',
    `/workspaces/${other}/payments/${p.body.data.paymentId}`,
  ).expect(404);
});
test('currency mismatch and mass-assigned totals/role rejected', async () => {
  const b = draft();
  b.currency = 'EUR';
  await call(owner, 'post', base() + '/invoices', b).expect(400);
  for (const extra of [
    { totalMinor: '1' },
    { role: 'owner' },
    { workspaceId: randomUUID() },
  ])
    await call(owner, 'post', base() + '/invoices', {
      ...draft(),
      ...extra,
    }).expect(400);
});
test('invalid dates, discount, quantities and tax rejected', async () => {
  for (const patch of [
    { dueDate: '2020-01-01' },
    { discount: '1000' },
    {
      items: [
        { description: 'x', quantity: '0', unitPrice: '1', taxRate: '0' },
      ],
    },
    {
      items: [
        { description: 'x', quantity: '1', unitPrice: '1', taxRate: '101' },
      ],
    },
  ])
    await call(owner, 'post', base() + '/invoices', {
      ...draft(),
      ...patch,
    }).expect(400);
});
test('failed duplicate number leaves no header/item/audit changes', async () => {
  const b = draft();
  await create(b);
  const before = await admin.invoiceItem.count({ where: { workspaceId: wid } });
  await call(owner, 'post', base() + '/invoices', {
    ...b,
    id: randomUUID(),
  }).expect(409);
  assert.equal(
    await admin.invoiceItem.count({ where: { workspaceId: wid } }),
    before,
  );
});
test('duplicate copies draft values without payment history; archive preserves snapshots', async () => {
  const r = await issue(await create());
  await payment(r);
  const copy = (
    await call(owner, 'post', base() + `/invoices/${r.id}/duplicate`, {
      id: randomUUID(),
      number: 'COPY-' + randomUUID(),
    }).expect(200)
  ).body.data;
  assert.equal(copy.lifecycle, 'draft');
  assert.equal(copy.paidMinor, '0');
  await call(owner, 'post', base() + `/clients/${client.id}/archive`, {
    archived: true,
  }).expect(200);
  assert.equal(
    (await call(owner, 'get', base() + `/invoices/${r.id}`)).body.data.client
      .name,
    'Test Customer',
  );
  await call(owner, 'post', base() + `/clients/${client.id}/archive`, {
    archived: false,
  }).expect(200);
});
test('search/status/client filters and pagination combine', async () => {
  const r = await create();
  const result = (
    await call(
      owner,
      'get',
      base() +
        `/invoices?currency=AUD&search=${r.number}&clientId=${client.id}&status=draft&limit=1`,
    )
  ).body.data;
  assert.equal(result.count, 1);
  assert.equal(result.rows[0].id, r.id);
});
test('revoked memberships cannot read or pay', async () => {
  await admin.workspaceMember.update({
    where: { id: editorMember.id },
    data: { status: 'revoked', revokedAt: new Date() },
  });
  await call(editor, 'get', base() + '/clients').expect(404);
  await call(editor, 'post', base() + '/invoices', draft()).expect(404);
});

test('pending invitations grant no invoice, client or payment access', async () => {
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
  await call(outsider, 'get', base() + '/clients').expect(404);
  await call(outsider, 'get', base() + '/invoices?currency=AUD').expect(404);
});
test('foreign clients and mismatched existing receipts are rejected', async () => {
  const b = draft();
  b.clientId = randomUUID();
  await call(owner, 'post', base() + '/invoices', b).expect(400);
  const row = await issue(await create());
  const receipt = (
    await call(owner, 'post', base() + '/transactions', {
      id: randomUUID(),
      accountId: account.id,
      currency: 'AUD',
      date: '2026-11-19',
      description: 'Excluded receipt',
      type: 'income',
      amountMinor: '1000',
    }).expect(200)
  ).body.data;
  await call(owner, 'post', base() + `/transactions/${receipt.id}/exclusion`, {
    version: receipt.version,
    excluded: true,
  }).expect(200);
  assert.equal(
    (await payment(row, { ...pay('100'), transactionId: receipt.id })).status,
    400,
  );
  assert.equal(
    (await payment(row, { ...pay('100'), transactionId: randomUUID() })).status,
    404,
  );
});
test('database conflict after receipt insertion rolls back the entire command', async () => {
  const row = await issue(await create()),
    key = randomUUID();
  const receipt = (
    await call(owner, 'post', base() + '/transactions', {
      id: randomUUID(),
      accountId: account.id,
      currency: 'AUD',
      date: '2026-11-19',
      description: 'Legacy unallocated receipt',
      type: 'income',
      amountMinor: '1000',
    }).expect(200)
  ).body.data;
  await admin.payment.create({
    data: {
      workspaceId: wid,
      currency: 'AUD',
      paidAt: new Date('2026-11-19'),
      amountMinor: 1000n,
      method: 'bank',
      transactionId: receipt.id,
      createdById: owner.id,
      idempotencyKey: key,
    },
  });
  const before = await admin.transaction.count({ where: { workspaceId: wid } });
  assert.equal(
    (await payment(row, { ...pay('100'), idempotencyKey: key })).status,
    409,
  );
  assert.equal(
    await admin.transaction.count({ where: { workspaceId: wid } }),
    before,
  );
  assert.equal(
    (await call(owner, 'get', base() + `/invoices/${row.id}`)).body.data
      .paidMinor,
    '0',
  );
});
