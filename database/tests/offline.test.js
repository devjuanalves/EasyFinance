import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { disposableDatabaseUrl } from '../scripts/safety.js';
import { Prisma } from '../generated/client/index.js';
const expected = [
  'users',
  'auth_sessions',
  'password_reset_tokens',
  'workspaces',
  'workspace_members',
  'workspace_invitations',
  'financial_accounts',
  'import_batches',
  'attachments',
  'transactions',
  'transaction_splits',
  'transaction_transfers',
  'categories',
  'category_rules',
  'clients',
  'invoice_templates',
  'invoices',
  'invoice_items',
  'invoice_deliveries',
  'payments',
  'payment_allocations',
  'recurring_invoice_rules',
  'investment_accounts',
  'investments',
  'investment_movements',
  'investment_valuations',
  'conversations',
  'conversation_messages',
  'ai_suggestions',
  'automation_rules',
  'automation_runs',
  'notifications',
  'notification_preferences',
  'activity_logs',
];
const sql = readFileSync(
  new URL(
    '../prisma/migrations/202611170001_initial/migration.sql',
    import.meta.url,
  ),
  'utf8',
);
test('generated client covers all 34 verified dictionary tables', () => {
  assert.deepEqual(
    Prisma.dmmf.datamodel.models.map((m) => m.dbName).sort(),
    [
      ...expected,
      'email_verification_tokens',
      'account_security_events',
      'identity_rate_buckets',
    ].sort(),
  );
  assert.equal((sql.match(/CREATE TABLE /g) || []).length, 34);
});
test('authoritative money never uses floating point', () => {
  for (const model of Prisma.dmmf.datamodel.models)
    for (const field of model.fields) {
      assert.notEqual(field.type, 'Float');
      if (field.name.endsWith('Minor')) assert.equal(field.type, 'BigInt');
    }
  assert.doesNotMatch(sql, /DOUBLE PRECISION|\bREAL\b/);
});
test('all scoped child models have composite ownership identities', () => {
  for (const model of Prisma.dmmf.datamodel.models.filter((m) =>
    m.fields.some((f) => f.name === 'workspaceId' && f.isRequired),
  )) {
    assert.ok(
      model.uniqueFields.some(
        (fields) => fields.join(',') === 'id,workspaceId',
      ),
      model.name,
    );
  }
});
test('migration preserves history and includes SQL-only safeguards', () => {
  assert.doesNotMatch(sql, /DROP TABLE|TRUNCATE|ON DELETE CASCADE/);
  for (const phrase of [
    'notification_preferences_global_unique',
    'workspace_invitations_pending_unique',
    'ef_financial_fence',
    'DEFERRABLE INITIALLY DEFERRED',
    'Invoice items must reconcile',
    'Invalid or excessive allocation',
    'Expense splits must reconcile exactly',
    'Workspace requires its active owner membership',
  ])
    assert.ok(sql.includes(phrase), phrase);
});
const safe = {
  DATABASE_URL:
    'postgresql://tester:placeholder@localhost:5432/easyfinance_test_disposable?schema=public',
  EASYFINANCE_DISPOSABLE_DB: 'yes',
};
test('safe guard accepts explicit disposable loopback database', () =>
  assert.equal(disposableDatabaseUrl(safe), safe.DATABASE_URL));
for (const [label, override] of [
  ['missing acknowledgement', { EASYFINANCE_DISPOSABLE_DB: '' }],
  ['production', { NODE_ENV: 'production' }],
  [
    'remote',
    {
      DATABASE_URL:
        'postgresql://tester:placeholder@example.test/easyfinance_test_disposable',
    },
  ],
  [
    'shared local',
    { DATABASE_URL: 'postgresql://tester:placeholder@localhost/easyfinance' },
  ],
  ['host override', { DATABASE_URL: safe.DATABASE_URL + '&host=remote' }],
  [
    'alternate schema',
    { DATABASE_URL: safe.DATABASE_URL.replace('public', 'other') },
  ],
  ['absent URL', { DATABASE_URL: undefined }],
])
  test(`safe guard rejects ${label}`, () =>
    assert.throws(() => disposableDatabaseUrl({ ...safe, ...override })));
test('decimal and bigint serialize without Number coercion', () => {
  const amount = 9007199254740993n;
  const quantity = new Prisma.Decimal('1.12345678');
  const payload = {
    amountMinor: amount.toString(),
    quantity: quantity.toFixed(8),
  };
  assert.equal(
    JSON.stringify(payload),
    '{"amountMinor":"9007199254740993","quantity":"1.12345678"}',
  );
});

test('explicit Block 8 target still requires acknowledgement and exact name', () => {
  const configured = {
    ...safe,
    DATABASE_URL: safe.DATABASE_URL.replace(
      'easyfinance_test_disposable',
      'easyfinance_block8_test',
    ),
  };
  assert.equal(disposableDatabaseUrl(configured), configured.DATABASE_URL);
  assert.throws(() =>
    disposableDatabaseUrl({
      ...configured,
      EASYFINANCE_DISPOSABLE_DB: undefined,
    }),
  );
  assert.throws(() =>
    disposableDatabaseUrl({
      ...configured,
      DATABASE_URL: configured.DATABASE_URL.replace(
        'block8_test',
        'block8_test_other',
      ),
    }),
  );
});
