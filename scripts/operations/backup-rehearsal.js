// Creates two NEW databases; never dumps, resets or restores the configured database.
import 'dotenv/config';
import pg from 'pg';
import { randomBytes, createHash } from 'node:crypto';
import { mkdirSync, writeFileSync, readFileSync, chmodSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { rehearsalTarget } from './backup-safety.js';
const url = rehearsalTarget(process.env);
const suffix = randomBytes(6).toString('hex');
const sourceName = `easyfinance_test_disposable_backup${suffix}`;
const restoreName = `easyfinance_test_disposable_restore${suffix}`;
const directory = resolve('.tmp', `backup-rehearsal-${suffix}`);
mkdirSync(directory, { mode: 0o700 });
const admin = new pg.Client({ connectionString: url.toString() });
const run = (command, args, env) => {
  const result = spawnSync(command, args, { env, encoding: 'utf8' });
  if (result.status !== 0)
    throw new Error(
      'Backup rehearsal subprocess failed; no credentials or raw process output emitted.',
    );
  return result.stdout;
};
const databaseUrl = (name) => {
  const copy = new URL(url);
  copy.pathname = '/' + name;
  return copy.toString();
};
const snapshot = async (name) => {
  const db = new pg.Client({ connectionString: databaseUrl(name) });
  await db.connect();
  try {
    const tables = (
      await db.query(
        "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename",
      )
    ).rows;
    const counts = {},
      dataHashes = {};
    for (const { tablename } of tables) {
      if (!/^[a-z_]+$/.test(tablename))
        throw new Error('Unexpected table name');
      counts[tablename] = (
        await db.query(`SELECT count(*)::int AS n FROM "${tablename}"`)
      ).rows[0].n;
      const rows = (
        await db.query(
          `SELECT * FROM "${tablename}" ORDER BY "${tablename === 'identity_rate_buckets' ? 'key' : 'id'}"`,
        )
      ).rows;
      dataHashes[tablename] = createHash('sha256')
        .update(JSON.stringify(rows))
        .digest('hex');
    }
    const constraints = (
      await db.query(
        "SELECT contype, count(*)::int AS n FROM pg_constraint WHERE connamespace='public'::regnamespace GROUP BY contype ORDER BY contype",
      )
    ).rows;
    const invalid = (
      await db.query(
        "SELECT count(*)::int AS n FROM users WHERE email NOT LIKE '%@example.test' OR password_hash IS NOT NULL",
      )
    ).rows[0].n;
    if (invalid || counts.users !== 1 || tables.length !== 38)
      throw new Error('Fictional fixture or table verification failed.');
    const definitions = (
      await db.query(
        "SELECT conname AS name, pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE connamespace='public'::regnamespace ORDER BY conname",
      )
    ).rows;
    const triggers = (
      await db.query(
        "SELECT tgname AS name, pg_get_triggerdef(t.oid) AS definition FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid WHERE c.relnamespace='public'::regnamespace AND NOT t.tgisinternal ORDER BY tgname",
      )
    ).rows;
    return { counts, dataHashes, constraints, definitions, triggers };
  } finally {
    await db.end();
  }
};
try {
  await admin.connect();
  const identity = (
    await admin.query('SELECT current_database() AS name, current_user AS role')
  ).rows[0];
  if (
    identity.name !== 'easyfinance_test_disposable_ci' ||
    identity.role !== 'postgres'
  )
    throw new Error('Unexpected cluster identity');
  // CREATE without IF NOT EXISTS fails safely on a collision. No DROP or --clean.
  await admin.query(`CREATE DATABASE "${sourceName}"`);
  const env = { ...process.env, DATABASE_URL: databaseUrl(sourceName) };
  run(process.execPath, ['database/scripts/prisma.js', 'deploy'], env);
  run(process.execPath, ['database/prisma/seed.js'], env);
  const before = await snapshot(sourceName);
  const pgEnv = {
    ...process.env,
    PGHOST: url.hostname,
    PGPORT: url.port || '5432',
    PGUSER: url.username,
    PGPASSWORD: decodeURIComponent(url.password),
    PGDATABASE: sourceName,
  };
  const binary = (name) =>
    process.env.PG_BIN ? join(process.env.PG_BIN, name) : name;
  const dump = join(directory, 'fictional.dump');
  run(
    binary('pg_dump'),
    ['--format=custom', '--no-owner', '--no-acl', '--file', dump],
    pgEnv,
  );
  chmodSync(dump, 0o600);
  run(binary('pg_restore'), ['--list', dump], pgEnv);
  await admin.query(`CREATE DATABASE "${restoreName}"`);
  run(
    binary('pg_restore'),
    [
      '--exit-on-error',
      '--single-transaction',
      '--no-owner',
      '--no-acl',
      '--dbname',
      restoreName,
      dump,
    ],
    pgEnv,
  );
  const after = await snapshot(restoreName);
  if (JSON.stringify(before) !== JSON.stringify(after))
    throw new Error('Restore comparison failed');
  const integrity = run(
    process.execPath,
    ['--test', 'database/tests/integration.test.js'],
    { ...process.env, DATABASE_URL: databaseUrl(restoreName) },
  );
  writeFileSync(join(directory, 'restored-integrity-tests.txt'), integrity, {
    mode: 0o600,
  });
  const evidence = {
    sourceName,
    restoreName,
    sha256: createHash('sha256').update(readFileSync(dump)).digest('hex'),
    ...after,
  };
  writeFileSync(
    join(directory, 'verification.json'),
    JSON.stringify(evidence, null, 2) + '\n',
    { mode: 0o600 },
  );
  console.log(
    'Fictional backup/restore passed: distinct fresh databases, 34 original plus 3 identity tables, all row counts and constraint counts match. Evidence:',
    directory,
  );
} catch {
  console.error(
    'Backup rehearsal failed; fresh databases retained for local inspection. No existing database reset.',
  );
  process.exitCode = 1;
} finally {
  await admin.end();
}
