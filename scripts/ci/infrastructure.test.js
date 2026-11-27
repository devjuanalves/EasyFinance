import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { disposableDatabaseUrl } from '../../database/scripts/safety.js';
import { rehearsalTarget } from '../operations/backup-safety.js';
test('backup rehearsal requires separate isolated cluster and explicit acknowledgement', () => {
  const base = {
    DATABASE_URL:
      'postgresql://postgres:fake@127.0.0.1/easyfinance_test_disposable_ci',
    EASYFINANCE_DISPOSABLE_DB: 'yes',
    EASYFINANCE_BACKUP_REHEARSAL: 'yes',
  };
  assert.equal(
    rehearsalTarget(base).pathname,
    '/easyfinance_test_disposable_ci',
  );
  assert.throws(() =>
    rehearsalTarget({ ...base, EASYFINANCE_BACKUP_REHEARSAL: '' }),
  );
  assert.throws(() =>
    rehearsalTarget({
      ...base,
      DATABASE_URL: base.DATABASE_URL.replace(
        'easyfinance_test_disposable_ci',
        'easyfinance_block8_test',
      ),
    }),
  );
  assert.throws(() => rehearsalTarget({ ...base, NODE_ENV: 'production' }));
});
for (const [name, DATABASE_URL] of [
  [
    'shared host',
    'postgresql://postgres:fake@remote.example/easyfinance_test_disposable_ci',
  ],
  [
    'developer database',
    'postgresql://postgres:fake@127.0.0.1/easyfinance_block8_test',
  ],
  [
    'wrong role',
    'postgresql://app:fake@127.0.0.1/easyfinance_test_disposable_ci',
  ],
])
  test(`CI provisioning refuses ${name} before connecting`, () => {
    const result = spawnSync(process.execPath, ['scripts/ci/bootstrap-db.js'], {
      env: {
        ...process.env,
        DATABASE_URL,
        EASYFINANCE_DISPOSABLE_DB: 'yes',
        EASYFINANCE_CI_BOOTSTRAP: 'yes',
      },
      encoding: 'utf8',
    });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Fresh isolated CI target|Only a loopback/);
  });
test('CI target still requires explicit acknowledgement and non-production mode', () => {
  const env = {
    DATABASE_URL:
      'postgresql://postgres:fake@127.0.0.1/easyfinance_test_disposable_ci',
  };
  assert.throws(() => disposableDatabaseUrl(env));
  assert.throws(() =>
    disposableDatabaseUrl({
      ...env,
      EASYFINANCE_DISPOSABLE_DB: 'yes',
      NODE_ENV: 'production',
    }),
  );
  assert.equal(
    disposableDatabaseUrl({ ...env, EASYFINANCE_DISPOSABLE_DB: 'yes' }),
    env.DATABASE_URL,
  );
});

test(
  'bounded CSV fixture accepts exactly 500 rows and rejects 501',
  { timeout: 10000 },
  async () => {
    const { parseCSV } =
      await import('../../packages/shared/src/statementCsv.js');
    const header = 'date,description,amount\n';
    const rows = Array.from(
      { length: 500 },
      (_, i) => `2026-11-19,Fictional row ${i},-12.34`,
    ).join('\n');
    for (let i = 0; i < 20; i++) {
      const parsed = parseCSV(header + rows, ',');
      assert.equal(parsed.rows.length, 500);
      assert.equal(parsed.rows[499][2], '-12.34');
    }
    assert.throws(
      () => parseCSV(header + rows + '\n2026-11-19,Overflow,-1.00', ','),
      /Maximum 500/,
    );
  },
);
test('report limit rejects incomplete aggregates rather than truncating them', async () => {
  const { bounded } =
    await import('../../apps/api/src/repositories/dashboard.js');
  assert.equal(bounded(Array(10000).fill(null)).length, 10000);
  assert.throws(
    () => bounded(Array(10001).fill(null)),
    (e) => e.code === 'REPORT_LIMIT',
  );
});
test('CI reporter never serializes errors, attachments, stdout or credentials', async () => {
  const { default: Reporter } = await import('./reporter.js');
  const reporter = new Reporter();
  reporter.onTestEnd(
    {
      title: 'Fictional financial workflow',
      parent: { project: () => ({ name: 'desktop' }) },
    },
    {
      status: 'failed',
      duration: 1,
      retry: 0,
      error: { message: 'sensitive-token' },
      stdout: ['sensitive-token'],
      attachments: [{ body: 'sensitive-token' }],
    },
  );
  assert.equal(reporter.results.length, 1);
  assert.ok(!JSON.stringify(reporter.results).includes('sensitive-token'));
  assert.deepEqual(Object.keys(reporter.results[0]), [
    'title',
    'project',
    'status',
    'durationMs',
    'retry',
  ]);
});
