import 'dotenv/config';
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
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
let owner, editor, viewer, outsider, wid, account;
const call = (a, method, path, body, server = app) => {
  const agent = request(server);
  let r = agent[method]('/api/v1' + path)
    .set('Origin', config.webOrigin)
    .set('X-EasyFinance-CSRF', '1');
  if (a) r = r.set('Cookie', a.cookie);
  return body === undefined ? r : r.send(body);
};
async function identity() {
  const email = `10a-${randomUUID()}@example.test`,
    password = 'Fictional-dashboard-password!';
  await call(null, 'post', '/auth/register', {
    email,
    password,
    fullName: 'Dashboard Tester',
  }).expect(200);
  const r = await call(null, 'post', '/auth/login', { email, password }).expect(
    200,
  );
  return {
    id: r.body.data.id,
    cookie: r.headers['set-cookie'][0].split(';')[0],
  };
}
const root = () => `/workspaces/${wid}`;
const report = (extra = '', actor = owner) =>
  call(
    actor,
    'get',
    root() + '/dashboard?currency=AUD&start=2026-11-01&end=2026-11-25' + extra,
  );
const newCategory = () => ({
  id: randomUUID(),
  name: `Category ${randomUUID()}`,
  kind: 'expense',
  icon: 'expenses',
  color: '#E43900',
});
const transaction = (extra = {}) => ({
  id: randomUUID(),
  accountId: account.id,
  currency: 'AUD',
  date: '2026-11-19',
  description: 'Dashboard movement',
  type: 'expense',
  amountMinor: '-1234',
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
      workspaceName: 'Dashboard audit',
      currency: 'AUD',
    }).expect(200)
  ).body.data.id;
  account = (await call(owner, 'get', root() + '/accounts').expect(200)).body
    .data[0];
  await admin.financialAccount.update({
    where: { id: account.id },
    data: { openingDate: new Date('2026-11-01') },
  });
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
test('empty report is exact, currency-separated and has no invented valuation', async () => {
  const s = (await report().expect(200)).body.data;
  assert.equal(s.incomeMinor, '0');
  assert.equal(s.expenseMinor, '0');
  assert.equal(s.balanceMinor, '0');
  assert.equal(s.savingsRate, null);
  assert.equal(s.recent.length, 0);
  assert.deepEqual(s.portfolio.valuationDates, []);
  assert.equal((await report('&currency=USD')).status, 400);
});
test('dashboard validates scope, dates and unknown filters and enforces real membership', async () => {
  await report('', null).expect(401);
  await report('', outsider).expect(404);
  await report('', viewer).expect(200);
  for (const extra of [
    '&accountId=' + randomUUID(),
    '&categoryId=' + randomUUID(),
  ])
    await report(extra).expect(404);
  await report('&role=owner').expect(400);
  await call(
    owner,
    'get',
    root() + '/dashboard?currency=AUD&start=2026-12-02&end=2026-12-01',
  ).expect(400);
  await call(
    owner,
    'get',
    root() + '/dashboard?currency=AUD&start=2024-01-01&end=2026-11-01',
  ).expect(400);
  await call(
    owner,
    'get',
    root() + '/dashboard?currency=AUD&start=2099-01-01&end=2099-01-02',
  ).expect(400);
});
test('category create retry, edit, stale version, archive and history protection', async () => {
  const b = newCategory();
  let c = (await call(editor, 'post', root() + '/categories', b).expect(200))
    .body.data;
  await call(editor, 'post', root() + '/categories', b).expect(200);
  const t = (
    await call(
      owner,
      'post',
      root() + '/transactions',
      transaction({ categoryId: c.id }),
    ).expect(200)
  ).body.data;
  assert.equal(
    (await report('&categoryId=' + c.id).expect(200)).body.data.expenseMinor,
    '1234',
  );
  const update = {
    updatedAt: c.updatedAt,
    name: 'Renamed ' + c.id,
    icon: c.icon,
    color: c.color,
  };
  c = (
    await call(editor, 'patch', root() + '/categories/' + c.id, update).expect(
      200,
    )
  ).body.data;
  await call(editor, 'patch', root() + '/categories/' + c.id, update).expect(
    409,
  );
  await call(editor, 'post', root() + '/categories/' + c.id + '/archive', {
    updatedAt: c.updatedAt,
  }).expect(200);
  await call(
    owner,
    'post',
    root() + '/transactions',
    transaction({ categoryId: c.id }),
  ).expect(400);
  const history = (await report('&categoryId=' + c.id).expect(200)).body.data;
  assert.equal(history.expenseMinor, '1234');
  assert.equal(history.balanceMinor, null);
  assert.equal(history.categories[0].name, update.name);
  assert.equal(
    (await call(owner, 'get', root() + '/transactions/' + t.id).expect(200))
      .body.data.categoryId,
    c.id,
  );
});
test('category permission, foreign identifiers, immutable kind and validation', async () => {
  await call(viewer, 'post', root() + '/categories', newCategory()).expect(403);
  await call(outsider, 'post', root() + '/categories', newCategory()).expect(
    404,
  );
  const c = (
    await call(owner, 'post', root() + '/categories', newCategory()).expect(200)
  ).body.data;
  await call(outsider, 'patch', root() + '/categories/' + c.id, {
    name: 'Foreign',
    icon: c.icon,
    color: c.color,
    updatedAt: c.updatedAt,
  }).expect(404);
  await call(owner, 'patch', root() + '/categories/' + c.id, {
    name: 'Invalid',
    icon: c.icon,
    color: c.color,
    updatedAt: c.updatedAt,
    kind: 'income',
  }).expect(400);
  for (const extra of [
    { kind: 'transfer' },
    { color: 'url(secret)' },
    { name: ' ' },
    { workspaceId: randomUUID() },
  ])
    await call(owner, 'post', root() + '/categories', {
      ...newCategory(),
      ...extra,
    }).expect(400);
});
test('independent category edits commit one winner and one audit', async () => {
  const c = (
    await call(owner, 'post', root() + '/categories', newCategory()).expect(200)
  ).body.data;
  const body = {
    updatedAt: c.updatedAt,
    name: 'Edit one',
    color: c.color,
    icon: c.icon,
  };
  const results = await Promise.all([
    call(owner, 'patch', root() + '/categories/' + c.id, body),
    call(
      editor,
      'patch',
      root() + '/categories/' + c.id,
      { ...body, name: 'Edit two' },
      app2,
    ),
  ]);
  assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
  assert.equal(
    await admin.activityLog.count({
      where: { workspaceId: wid, entityId: c.id, action: 'updated' },
    }),
    1,
  );
});
test('category assignment changes classification but not total cash; exclusions and dates reconcile', async () => {
  const c = (
    await call(owner, 'post', root() + '/categories', newCategory()).expect(200)
  ).body.data;
  const t = (
    await call(
      owner,
      'post',
      root() + '/transactions',
      transaction({ amountMinor: '-700' }),
    ).expect(200)
  ).body.data;
  const before = (await report().expect(200)).body.data;
  const changed = (
    await call(owner, 'patch', root() + '/transactions/' + t.id + '/category', {
      version: t.version,
      categoryId: c.id,
    }).expect(200)
  ).body.data;
  const after = (await report().expect(200)).body.data;
  assert.equal(after.expenseMinor, before.expenseMinor);
  assert.equal(after.balanceMinor, before.balanceMinor);
  assert.equal(
    (await report('&categoryId=' + c.id).expect(200)).body.data.expenseMinor,
    '700',
  );
  await call(owner, 'post', root() + '/transactions/' + t.id + '/exclusion', {
    version: changed.version,
    excluded: true,
  }).expect(200);
  assert.equal(
    (await report('&categoryId=' + c.id).expect(200)).body.data.expenseMinor,
    '0',
  );
  const other = await call(
    owner,
    'get',
    root() + '/dashboard?currency=USD&start=2026-11-01&end=2026-11-25',
  ).expect(200);
  assert.equal(other.body.data.incomeMinor, '0');
  assert.equal(other.body.data.expenseMinor, '0');
});
test('invoice partial/final payments and duplicate import preserve dashboard cash and receivables', async () => {
  const before = (await report().expect(200)).body.data;
  const client = (
    await call(owner, 'post', root() + '/clients', {
      id: randomUUID(),
      type: 'business',
      name: 'Dashboard client',
      businessName: 'Fictional',
      email: 'dashboard@example.test',
      defaultCurrency: 'AUD',
      paymentTerms: '14',
    }).expect(200)
  ).body.data;
  let invoice = (
    await call(owner, 'post', root() + '/invoices', {
      id: randomUUID(),
      number: 'D-' + randomUUID(),
      clientId: client.id,
      accountId: account.id,
      currency: 'AUD',
      issuedDate: '2026-11-19',
      dueDate: '2026-12-19',
      paymentTerms: '14',
      items: [
        {
          description: 'Work',
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
    await call(owner, 'post', root() + '/invoices/' + invoice.id + '/issue', {
      version: invoice.version,
    }).expect(200)
  ).body.data;
  assert.equal(
    (await report().expect(200)).body.data.incomeMinor,
    before.incomeMinor,
  );
  assert.equal(
    (await report().expect(200)).body.data.outstandingMinor,
    '10000',
  );
  let receipt;
  for (const [amount, remaining] of [
    ['4000', '6000'],
    ['6000', '0'],
  ]) {
    receipt = (
      await call(
        owner,
        'post',
        root() + '/invoices/' + invoice.id + '/payments',
        {
          idempotencyKey: randomUUID(),
          amountMinor: amount,
          date: '2026-11-19',
          method: 'bank',
          reference: 'fictional',
        },
      ).expect(200)
    ).body.data;
    assert.equal(
      (await report().expect(200)).body.data.outstandingMinor,
      remaining,
    );
  }
  const final = (await report().expect(200)).body.data;
  assert.equal(BigInt(final.incomeMinor) - BigInt(before.incomeMinor), 10000n);
  assert.equal(
    BigInt(final.balanceMinor) - BigInt(before.balanceMinor),
    10000n,
  );
  const source = {
    csv: `date,description,amount,currency\n2026-11-19,Invoice ${invoice.number} receipt,60.00,AUD`,
    fileName: 'dashboard.csv',
    accountId: account.id,
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
    await call(owner, 'post', root() + '/imports/preview', source).expect(200)
  ).body.data;
  assert(preview.rows[0].candidates.length);
  await call(owner, 'post', root() + '/imports', {
    ...source,
    key: randomUUID(),
    previewHash: preview.previewHash,
    confirmed: true,
    decisions: [
      {
        rowNumber: 2,
        decision: 'match',
        matchId: receipt.transactionId,
        categoryId: null,
      },
    ],
  }).expect(200);
  assert.equal(
    (await report().expect(200)).body.data.incomeMinor,
    final.incomeMinor,
  );
  const category = (
    await call(owner, 'post', root() + '/categories', {
      ...newCategory(),
      kind: 'income',
    }).expect(200)
  ).body.data;
  await call(
    owner,
    'patch',
    root() + '/transactions/' + receipt.transactionId + '/category',
    { version: 1, categoryId: category.id },
  ).expect(409);
});
test('portfolio valuation and fractional sale stay separate from cash and missing value is null', async () => {
  const before = (await report().expect(200)).body.data;
  const command = async (action, payload, version) =>
    (
      await call(owner, 'post', root() + '/investments/commands', {
        key: randomUUID(),
        action,
        payload,
        ...(version ? { version } : {}),
      }).expect(200)
    ).body.data;
  const brokerage = await command('createAccount', {
    name: 'Dashboard broker',
    institution: 'Fictional',
    currency: 'AUD',
  });
  const holding = await command('create', {
    form: {
      name: 'Fund',
      assetType: 'ETFs',
      customType: '',
      symbol: 'TEST',
      investmentAccountId: brokerage.result,
      currency: 'AUD',
      date: '2026-11-01',
      quantity: '2.5',
      unitPrice: '10.12345678',
      fee: '1.00',
      amount: '',
      estimatedValue: '30.00',
      valuedAt: '2026-11-01',
      notes: '',
      tags: '',
      interestInfo: '',
    },
  });
  assert.equal(
    (await report().expect(200)).body.data.portfolio.valueMinor,
    '3000',
  );
  await command(
    'recordMovement',
    {
      id: holding.result,
      form: {
        type: 'sell',
        currency: 'AUD',
        date: '2026-11-02',
        quantity: '1',
        unitPrice: '20',
        fee: '0.50',
        notes: '',
      },
    },
    1,
  );
  const after = (await report().expect(200)).body.data;
  assert.equal(after.portfolio.valueMinor, null);
  assert.equal(after.portfolio.basisMinor, '1579');
  assert.equal(after.incomeMinor, before.incomeMinor);
  assert.equal(after.expenseMinor, before.expenseMinor);
  assert.equal(after.balanceMinor, before.balanceMinor);
});

test('dated category totals reconcile the previous period and do not invent pre-opening balances', async () => {
  const c = (
    await call(owner, 'post', root() + '/categories', newCategory()).expect(200)
  ).body.data;
  for (const [date, amountMinor] of [
    ['2026-10-20', '-500'],
    ['2026-11-05', '-900'],
  ]) {
    await call(
      owner,
      'post',
      root() + '/transactions',
      transaction({ date, amountMinor, categoryId: c.id }),
    ).expect(200);
  }
  const s = (await report('&categoryId=' + c.id).expect(200)).body.data;
  assert.equal(s.expenseMinor, '900');
  assert.equal(s.previous.expenseMinor, '500');
  assert.equal(
    s.buckets.reduce((n, b) => n + BigInt(b.expenseMinor), 0n),
    900n,
  );
  const old = (
    await call(
      owner,
      'get',
      root() + '/dashboard?currency=AUD&start=2026-10-01&end=2026-10-31',
    ).expect(200)
  ).body.data;
  assert.equal(old.balanceMinor, null);
});

test('category commands require CSRF and revoked membership loses report and category access', async () => {
  await request(app)
    .post('/api/v1' + root() + '/categories')
    .set('Cookie', owner.cookie)
    .send(newCategory())
    .expect(403);
  const member = await identity();
  await admin.workspaceMember.create({
    data: { workspaceId: wid, userId: member.id, role: 'editor' },
  });
  await report('', member).expect(200);
  await admin.workspaceMember.update({
    where: { workspaceId_userId: { workspaceId: wid, userId: member.id } },
    data: { status: 'revoked', revokedAt: new Date() },
  });
  await report('', member).expect(404);
  await call(member, 'get', root() + '/categories').expect(404);
  await call(member, 'post', root() + '/categories', newCategory()).expect(404);
});
