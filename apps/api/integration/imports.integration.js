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
  admin = disposableClient(),
  config = { webOrigin: 'http://localhost:5173', nodeEnv: 'test' },
  app = createApp({ db, config }),
  app2 = createApp({ db: db2, config });
let owner,
  viewer,
  editor,
  outsider,
  wid,
  account,
  expenseCategory,
  incomeCategory;
const call = (actor, method, path, body, server = app) => {
  const agent = request(server);
  let r = agent[method]('/api/v1' + path)
    .set('Origin', config.webOrigin)
    .set('X-EasyFinance-CSRF', '1');
  if (actor) r = r.set('Cookie', actor.cookie);
  return body === undefined ? r : r.send(body);
};
const base = () => '/workspaces/' + wid;
async function identity() {
  const email = `imports-${randomUUID()}@example.test`,
    password = 'Fictional-import-password!';
  await call(null, 'post', '/auth/register', {
    email,
    password,
    fullName: 'Import Tester',
  }).expect(200);
  const r = await call(null, 'post', '/auth/login', { email, password }).expect(
    200,
  );
  return {
    id: r.body.data.id,
    cookie: r.headers['set-cookie'][0].split(';')[0],
  };
}
const input = (description = 'Expense ' + randomUUID()) => ({
  csv: `date,description,amount,currency,reference\n2026-11-19,${description},-12.34,AUD,${randomUUID()}`,
  fileName: 'fictional.csv',
  accountId: account.id,
  currency: 'AUD',
  mapping: {
    date: '0',
    description: '1',
    amount: '2',
    currency: '3',
    reference: '4',
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
});
async function prepare(b = input(), actor = owner) {
  const p = (
    await call(actor, 'post', base() + '/imports/preview', b).expect(200)
  ).body.data;
  return {
    ...b,
    key: randomUUID(),
    previewHash: p.previewHash,
    confirmed: true,
    decisions: p.rows.map((r) => ({
      rowNumber: r.rowNumber,
      decision: r.error
        ? 'exclude'
        : r.candidates.length || r.within.length
          ? 'keep_both'
          : 'keep',
      categoryId: null,
    })),
    preview: p,
  };
}
const payload = (b) => {
  const { preview, ...body } = b;
  void preview;
  return body;
};
const commit = (b, actor = owner, server = app) =>
  call(actor, 'post', base() + '/imports', payload(b), server);
const batchRows = (id) =>
  admin.transaction.findMany({ where: { importBatchId: id } });
before(async () => {
  await diagnoseRuntime(db);
  owner = await identity();
  viewer = await identity();
  editor = await identity();
  outsider = await identity();
  wid = (
    await call(owner, 'post', '/onboarding', {
      workspaceName: 'CSV test workspace',
      currency: 'AUD',
    }).expect(200)
  ).body.data.id;
  account = (await call(owner, 'get', base() + '/accounts').expect(200)).body
    .data[0];
  const cats = (await call(owner, 'get', base() + '/categories').expect(200))
    .body.data;
  expenseCategory = cats.find((c) => c.kind === 'expense');
  incomeCategory = cats.find((c) => c.kind === 'income');
  await admin.workspaceMember.createMany({
    data: [
      { workspaceId: wid, userId: viewer.id, role: 'viewer' },
      { workspaceId: wid, userId: editor.id, role: 'editor' },
    ],
  });
});
after(async () => {
  await db.$disconnect();
  await db2.$disconnect();
  await admin.$disconnect();
});
test('preview parses real CSV without financial or batch writes', async () => {
  const before = await admin.importBatch.count({ where: { workspaceId: wid } });
  const b = await prepare();
  assert.equal(b.preview.rows[0].amount, -1234);
  assert.equal(
    await admin.importBatch.count({ where: { workspaceId: wid } }),
    before,
  );
});
test('atomic import persists originals, history, and exact balance delta', async () => {
  const before = (await call(owner, 'get', base() + '/accounts/' + account.id))
    .body.data.balanceMinor;
  const b = await prepare();
  const r = (await commit(b).expect(200)).body.data;
  const rows = await batchRows(r.id);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].originalAmountMinor, -1234n);
  assert.equal(rows[0].source, 'import');
  const after = (await call(owner, 'get', base() + '/accounts/' + account.id))
    .body.data.balanceMinor;
  assert.equal(BigInt(after) - BigInt(before), -1234n);
  assert.equal(
    (await call(owner, 'get', base() + '/imports/' + r.id).expect(200)).body
      .data.accepted,
    1,
  );
});
test('same key is idempotent and changed input conflicts', async () => {
  const b = await prepare();
  const r = await commit(b).expect(200);
  assert.equal((await commit(b).expect(200)).body.data.id, r.body.data.id);
  assert.equal((await batchRows(r.body.data.id)).length, 1);
  await commit({ ...b, fileName: 'changed.csv' }).expect(409);
});
test('same file resubmission exposes candidates and cannot silently keep', async () => {
  const original = input();
  await commit(await prepare(original)).expect(200);
  const b = await prepare(original);
  assert.ok(b.preview.rows[0].candidates.length);
  b.decisions[0].decision = 'keep';
  await commit(b).expect(409);
  b.decisions[0].decision = 'exclude';
  assert.equal((await commit(b).expect(200)).body.data.accepted, 0);
});
test('Keep Both is explicit and retains unique reference exception metadata', async () => {
  const source = input();
  await commit(await prepare(source)).expect(200);
  const b = await prepare(source);
  const r = (await commit(b).expect(200)).body.data;
  const [row] = await batchRows(r.id);
  assert.equal(row.duplicateDecision, 'keep_both');
  assert.equal(row.sourceSystem, null);
  assert.ok(row.duplicateOfId);
});
test('duplicate rows inside CSV need review', async () => {
  const b = input();
  b.csv += '\n' + b.csv.split('\n')[1];
  const p = await prepare(b);
  assert.deepEqual(p.preview.rows[0].within, [3]);
  p.decisions[0].decision = 'keep';
  await commit(p).expect(409);
  p.decisions[0].decision = 'keep_both';
  p.decisions[1].decision = 'exclude';
  assert.equal((await commit(p).expect(200)).body.data.accepted, 1);
});
test('invalid rows are reported and only explicitly excluded rows may be omitted', async () => {
  const b = input();
  b.csv += '\n2026-02-30,Invalid,NaN,AUD,bad';
  const p = await prepare(b);
  assert.ok(p.preview.rows[1].error);
  p.decisions[1].decision = 'keep';
  await commit(p).expect(400);
  p.decisions[1].decision = 'exclude';
  assert.equal((await commit(p).expect(200)).body.data.accepted, 1);
});
test('empty, oversized, malformed and invalid mappings rejected', async () => {
  for (const csv of [
    '',
    'a'.repeat(2 * 1024 * 1024 + 1),
    'date,description\n"unclosed',
  ])
    await call(owner, 'post', base() + '/imports/preview', {
      ...input(),
      csv,
    }).expect(400);
  const b = input();
  b.mapping.amount = '99';
  await call(owner, 'post', base() + '/imports/preview', b).expect(400);
});
test('decimal comma, grouping and DMY normalize exactly', async () => {
  const b = input();
  b.csv =
    'date;description;amount;currency;reference\n19/11/2026;Euro style;"-1.234,56";AUD;decimal';
  b.options = {
    ...b.options,
    delimiter: ';',
    decimal: 'comma',
    dateFormat: 'dmy',
  };
  const p = await prepare(b);
  assert.equal(p.preview.rows[0].amount, -123456);
});
test('separate debit credit mapping validates both columns', async () => {
  const b = input();
  b.csv =
    'date,description,debit,credit\n2026-11-19,Debit,2.34,\n2026-11-19,Both,2,3';
  b.mapping = {
    date: '0',
    description: '1',
    amount: '',
    debit: '2',
    credit: '3',
    currency: '',
    reference: '',
  };
  const p = await prepare(b);
  assert.equal(p.preview.rows[0].amount, -234);
  assert.ok(p.preview.rows[1].error);
});
test('currency and account mismatches rejected', async () => {
  await call(owner, 'post', base() + '/imports/preview', {
    ...input(),
    currency: 'USD',
  }).expect(400);
  await call(owner, 'post', base() + '/imports/preview', {
    ...input(),
    accountId: randomUUID(),
  }).expect(400);
  const b = input();
  b.csv = b.csv.replace(',AUD,', ',USD,');
  assert.ok((await prepare(b)).preview.rows[0].error);
});
test('authentication, viewer, and cross-workspace restrictions', async () => {
  await call(null, 'post', base() + '/imports/preview', input()).expect(401);
  await call(viewer, 'post', base() + '/imports/preview', input()).expect(403);
  await call(outsider, 'post', base() + '/imports/preview', input()).expect(
    404,
  );
  const b = await prepare();
  await commit(b, viewer).expect(403);
  await call(viewer, 'get', base() + '/imports').expect(200);
  await commit(b, editor).expect(200);
});
test('independent connections serialize conflicting confirmations', async () => {
  const [p1] = await db.$queryRaw`SELECT pg_backend_pid() AS pid`;
  const [p2] = await db2.$queryRaw`SELECT pg_backend_pid() AS pid`;
  assert.notEqual(p1.pid, p2.pid);
  const b = await prepare();
  const results = await Promise.all([
    commit(b),
    commit({ ...b, key: randomUUID() }, owner, app2),
  ]);
  assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
});
test('concurrent identical key creates only one batch', async () => {
  const b = await prepare();
  const results = await Promise.all([commit(b), commit(b, owner, app2)]);
  assert.deepEqual(
    results.map((r) => r.status),
    [200, 200],
  );
  assert.equal(results[0].body.data.id, results[1].body.data.id);
});
test('category-only updates preserve amount/source and enforce versions', async () => {
  const r = (await commit(await prepare()).expect(200)).body.data;
  const [row] = await batchRows(r.id);
  const path = base() + '/transactions/' + row.id + '/category';
  const body = { version: row.version, categoryId: expenseCategory.id };
  const updated = (await call(owner, 'patch', path, body).expect(200)).body
    .data;
  assert.equal(updated.amountMinor, '-1234');
  assert.equal(updated.source, 'import');
  assert.equal(updated.categoryId, expenseCategory.id);
  await call(owner, 'patch', path, body).expect(409);
  await call(viewer, 'patch', path, {
    ...body,
    version: updated.version,
  }).expect(403);
  await call(owner, 'patch', path, {
    version: updated.version,
    categoryId: incomeCategory.id,
  }).expect(400);
  await call(owner, 'patch', path, {
    version: updated.version,
    categoryId: randomUUID(),
  }).expect(400);
  assert.equal(
    (await admin.transaction.findUnique({ where: { id: row.id } }))
      .manualCategoryOverride,
    true,
  );
});
test('category validation rolls back whole import', async () => {
  const p = await prepare();
  p.decisions[0].categoryId = randomUUID();
  const before = await admin.importBatch.count({ where: { workspaceId: wid } });
  await commit(p).expect(400);
  assert.equal(
    await admin.importBatch.count({ where: { workspaceId: wid } }),
    before,
  );
});
test('existing receipt review does not create cash or alter allocation', async () => {
  const r = await admin.transaction.create({
    data: {
      workspaceId: wid,
      accountId: account.id,
      currency: 'AUD',
      createdById: owner.id,
      bookingDate: new Date('2026-11-19'),
      originalDate: new Date('2026-11-19'),
      description: 'Existing receipt',
      originalDescription: 'Existing receipt',
      amountMinor: 2500n,
      originalAmountMinor: 2500n,
      type: 'income',
      source: 'payment',
    },
  });
  await admin.payment.create({
    data: {
      workspaceId: wid,
      currency: 'AUD',
      paidAt: new Date('2026-11-19'),
      amountMinor: 2500n,
      method: 'bank',
      idempotencyKey: randomUUID(),
      transactionId: r.id,
      createdById: owner.id,
    },
  });
  const b = input();
  b.csv =
    'date,description,amount,currency,reference\n2026-11-19,Existing receipt,25.00,AUD,receipt';
  const p = await prepare(b);
  p.decisions[0] = { rowNumber: 2, decision: 'match', matchId: r.id };
  const before = await admin.transaction.count({ where: { workspaceId: wid } });
  assert.equal((await commit(p).expect(200)).body.data.accepted, 0);
  assert.equal(
    await admin.transaction.count({ where: { workspaceId: wid } }),
    before,
  );
  await call(owner, 'patch', base() + '/transactions/' + r.id + '/category', {
    version: r.version,
    categoryId: incomeCategory.id,
  }).expect(409);
});
test('raw financial fields cannot be mass-assigned through category endpoint', async () => {
  const r = (await commit(await prepare()).expect(200)).body.data;
  const [row] = await batchRows(r.id);
  await call(owner, 'patch', base() + '/transactions/' + row.id + '/category', {
    version: 1,
    categoryId: null,
    amountMinor: '100',
  }).expect(400);
});

test('split parent categorization is rejected without flattening splits', async () => {
  const batch = (await commit(await prepare()).expect(200)).body.data;
  const [row] = await batchRows(batch.id);
  await admin.$transaction(async (tx) => {
    await tx.transactionSplit.createMany({
      data: [
        {
          workspaceId: wid,
          transactionId: row.id,
          categoryId: expenseCategory.id,
          amountMinor: 600n,
        },
        {
          workspaceId: wid,
          transactionId: row.id,
          categoryId: expenseCategory.id,
          amountMinor: 634n,
        },
      ],
    });
  });
  await call(owner, 'patch', base() + '/transactions/' + row.id + '/category', {
    version: row.version,
    categoryId: expenseCategory.id,
  }).expect(409);
  assert.equal(
    await admin.transactionSplit.count({ where: { transactionId: row.id } }),
    2,
  );
});
test('matching existing paired transfer leaves cash-flow totals neutral', async () => {
  const account2 = await admin.financialAccount.create({
    data: {
      workspaceId: wid,
      currency: 'AUD',
      name: 'Transfer test account',
      openingDate: new Date('2026-11-01'),
    },
  });
  const common = {
    workspaceId: wid,
    currency: 'AUD',
    createdById: owner.id,
    bookingDate: new Date('2026-11-19'),
    originalDate: new Date('2026-11-19'),
    description: 'Internal transfer',
    originalDescription: 'Internal transfer',
    type: 'transfer',
  };
  const outgoing = await admin.$transaction(async (tx) => {
    const o = await tx.transaction.create({
      data: {
        ...common,
        accountId: account.id,
        amountMinor: -777n,
        originalAmountMinor: -777n,
      },
    });
    const i = await tx.transaction.create({
      data: {
        ...common,
        accountId: account2.id,
        amountMinor: 777n,
        originalAmountMinor: 777n,
      },
    });
    await tx.transactionTransfer.create({
      data: {
        workspaceId: wid,
        currency: 'AUD',
        outgoingTransactionId: o.id,
        incomingTransactionId: i.id,
      },
    });
    return o;
  });
  const b = input();
  b.csv =
    'date,description,amount,currency,reference\n2026-11-19,Internal transfer,-7.77,AUD,transfer';
  const p = await prepare(b);
  p.decisions[0] = { rowNumber: 2, decision: 'match', matchId: outgoing.id };
  const before = (
    await call(owner, 'get', base() + '/expenses/summary?currency=AUD')
  ).body.data;
  await commit(p).expect(200);
  assert.deepEqual(
    (await call(owner, 'get', base() + '/expenses/summary?currency=AUD')).body
      .data,
    before,
  );
  await call(
    owner,
    'patch',
    base() + '/transactions/' + outgoing.id + '/category',
    { version: 1, categoryId: null },
  ).expect(409);
});
test('archived categories and foreign accounts are rejected', async () => {
  const archived = await admin.category.create({
    data: {
      workspaceId: wid,
      name: 'Archived ' + randomUUID(),
      kind: 'expense',
      archivedAt: new Date(),
    },
  });
  const p = await prepare();
  p.decisions[0].categoryId = archived.id;
  await commit(p).expect(400);
  const other = (
    await call(outsider, 'post', '/onboarding', {
      workspaceName: 'Other importer',
      currency: 'AUD',
    }).expect(200)
  ).body.data.id;
  const a = (
    await call(outsider, 'get', '/workspaces/' + other + '/accounts').expect(
      200,
    )
  ).body.data[0];
  await call(owner, 'post', base() + '/imports/preview', {
    ...input(),
    accountId: a.id,
  }).expect(400);
});
test('confirmation requires explicit approval and a current preview', async () => {
  const b = await prepare();
  await commit({ ...b, confirmed: false }).expect(400);
  await commit({ ...b, previewHash: '0'.repeat(64) }).expect(409);
});

test('failure after ledger insertion rolls back batch, receipts and audit together', async () => {
  const { imports } = await import('../src/services/imports.js');
  const { importInput } = await import('../src/validation/imports.js');
  const session = await admin.authSession.findFirst({
    where: { userId: owner.id },
    orderBy: { createdAt: 'desc' },
  });
  const auth = { userId: owner.id, hash: session.tokenHash };
  const b = await prepare();
  const beforeB = await admin.importBatch.count({
      where: { workspaceId: wid },
    }),
    beforeT = await admin.transaction.count({ where: { workspaceId: wid } });
  const failing = {
    $transaction: (fn, options) =>
      db.$transaction(
        (tx) =>
          fn(
            new Proxy(tx, {
              get(target, key) {
                if (key === 'activityLog')
                  return {
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
    imports(failing).confirm(auth, wid, importInput(payload(b), true)),
    /Injected audit failure/,
  );
  assert.equal(
    await admin.importBatch.count({ where: { workspaceId: wid } }),
    beforeB,
  );
  assert.equal(
    await admin.transaction.count({ where: { workspaceId: wid } }),
    beforeT,
  );
});
