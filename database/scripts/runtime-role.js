// Explicit local administrator setup; never run automatically during API startup.
import 'dotenv/config';
import pg from 'pg';
import { randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { disposableDatabaseUrl } from './safety.js';
const url = new URL(disposableDatabaseUrl());
if (
  url.hostname !== '127.0.0.1' ||
  url.port !== '5432' ||
  url.pathname !== '/easyfinance_block8_test'
)
  throw new Error('Unexpected Block 9A setup target.');
const db = new pg.Client({ connectionString: url.toString() });
await db.connect();
try {
  const identity = (
    await db.query(
      'SELECT current_database() AS database, host(inet_server_addr()) AS address, pg_get_userbyid(datdba) AS owner FROM pg_database WHERE datname=current_database()',
    )
  ).rows[0];
  if (
    identity.database !== 'easyfinance_block8_test' ||
    identity.address !== '127.0.0.1'
  )
    throw new Error('Identity mismatch');
  console.log('Verified disposable target', identity);
  const existing = await db.query(
    "SELECT 1 FROM pg_roles WHERE rolname='easyfinance_9a_app'",
  );
  if (existing.rowCount)
    throw new Error('Role already exists; inspect rather than alter it.');
  if (process.env.API_DATABASE_URL)
    throw new Error(
      'Runtime configuration already exists; inspect rather than replace it.',
    );
  const password = randomBytes(32).toString('hex');
  await db.query('BEGIN');
  await db.query(
    `CREATE ROLE easyfinance_9a_app LOGIN PASSWORD '${password}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS`,
  );
  await db.query(
    'GRANT CONNECT ON DATABASE easyfinance_block8_test TO easyfinance_9a_app',
  );
  await db.query('GRANT USAGE ON SCHEMA public TO easyfinance_9a_app');
  // Deferred financial checks read all covered parent tables. No DDL, DELETE or TRUNCATE grants.
  await db.query(
    'GRANT SELECT ON users, auth_sessions, workspaces, workspace_members, financial_accounts, categories, transactions, transaction_splits, transaction_transfers, invoices, invoice_items, payments, payment_allocations, import_batches, activity_logs TO easyfinance_9a_app',
  );
  await db.query(
    'GRANT INSERT, UPDATE ON users, auth_sessions, workspaces, workspace_members, financial_accounts, categories, transactions, activity_logs TO easyfinance_9a_app',
  );
  await db.query("ALTER ROLE easyfinance_9a_app SET statement_timeout='10s'");
  await db.query(
    "ALTER ROLE easyfinance_9a_app SET idle_in_transaction_session_timeout='15s'",
  );
  await db.query('COMMIT');
  url.username = 'easyfinance_9a_app';
  url.password = password;
  const path = new URL('../../.env', import.meta.url);
  const env = readFileSync(path, 'utf8');
  writeFileSync(
    path,
    env +
      '\n# Restricted Block 9A runtime; migration URL above remains separate.\nAPI_DATABASE_URL=' +
      url.toString() +
      '\n',
    { mode: 0o600 },
  );
  console.log(
    'Restricted role created; runtime URL written only to ignored root .env.',
  );
} finally {
  await db.end();
}
