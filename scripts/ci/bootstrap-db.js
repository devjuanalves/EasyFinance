// Fresh isolated CI/local-replay target only. Never reads or edits developer .env.
import pg from 'pg';
import { randomBytes } from 'node:crypto';
import { appendFileSync } from 'node:fs';
import { disposableDatabaseUrl } from '../../database/scripts/safety.js';
const url = new URL(disposableDatabaseUrl());
if (
  process.env.EASYFINANCE_CI_BOOTSTRAP !== 'yes' ||
  url.hostname !== '127.0.0.1' ||
  url.pathname !== '/easyfinance_test_disposable_ci' ||
  url.username !== 'postgres'
)
  throw new Error(
    'Fresh isolated CI target and explicit bootstrap acknowledgement required.',
  );
const destination =
  process.env.GITHUB_ENV || process.env.EASYFINANCE_CI_ENV_FILE;
if (!destination)
  throw new Error('Explicit CI environment output file required.');
const db = new pg.Client({ connectionString: url.toString() });
await db.connect();
try {
  const {
    rows: [identity],
  } = await db.query(
    'SELECT current_database() AS name, pg_get_userbyid(datdba) AS owner FROM pg_database WHERE datname=current_database()',
  );
  if (
    identity.name !== 'easyfinance_test_disposable_ci' ||
    identity.owner !== 'postgres'
  )
    throw new Error('Unexpected CI database identity.');
  const {
    rows: [counts],
  } = await db.query(
    "SELECT (SELECT count(*) FROM pg_tables WHERE schemaname='public' AND tablename<>'_prisma_migrations')::int AS tables, (SELECT count(*) FROM users)::int AS users, (SELECT count(*) FROM workspaces)::int AS workspaces",
  );
  if (counts.tables !== 34 || counts.users || counts.workspaces)
    throw new Error('Provision only a freshly migrated empty CI database.');
  if (
    (
      await db.query(
        "SELECT 1 FROM pg_roles WHERE rolname='easyfinance_9a_app'",
      )
    ).rowCount
  )
    throw new Error('Runtime role already exists; no replacement permitted.');
  const password = randomBytes(32).toString('hex');
  await db.query('BEGIN');
  await db.query(
    `CREATE ROLE easyfinance_9a_app LOGIN PASSWORD '${password}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS`,
  );
  await db.query(
    'GRANT CONNECT ON DATABASE easyfinance_test_disposable_ci TO easyfinance_9a_app',
  );
  await db.query('GRANT USAGE ON SCHEMA public TO easyfinance_9a_app');
  // Union of the reviewed Block 9A–9B.4 grants, not ALL TABLES or default grants.
  await db.query(
    'GRANT SELECT ON users, auth_sessions, workspaces, workspace_members, financial_accounts, categories, transactions, transaction_splits, transaction_transfers, invoices, invoice_items, payments, payment_allocations, import_batches, activity_logs, clients, investment_accounts, investments, investment_movements, investment_valuations, workspace_invitations, automation_rules, notification_preferences, automation_runs TO easyfinance_9a_app',
  );
  await db.query(
    'GRANT INSERT, UPDATE ON users, auth_sessions, workspaces, workspace_members, financial_accounts, categories, transactions, activity_logs, clients, invoices, invoice_items, payments, payment_allocations, investments, investment_movements, investment_valuations, workspace_invitations, automation_rules, notification_preferences TO easyfinance_9a_app',
  );
  await db.query(
    'GRANT INSERT ON import_batches, investment_accounts TO easyfinance_9a_app',
  );
  await db.query('GRANT DELETE ON invoice_items TO easyfinance_9a_app');
  await db.query("ALTER ROLE easyfinance_9a_app SET statement_timeout='10s'");
  await db.query(
    "ALTER ROLE easyfinance_9a_app SET idle_in_transaction_session_timeout='15s'",
  );
  await db.query('COMMIT');
  url.username = 'easyfinance_9a_app';
  url.password = password;
  if (process.env.GITHUB_ACTIONS === 'true') {
    console.log(`::add-mask::${password}`);
    console.log(`::add-mask::${url.toString()}`);
  }
  appendFileSync(destination, `API_DATABASE_URL=${url}\n`, { mode: 0o600 });
  console.log(
    'Fresh CI runtime role provisioned; connection written only to the explicit environment file.',
  );
} catch (error) {
  await db.query('ROLLBACK');
  // Do not print connection errors or SQL containing credentials.
  console.error(
    'CI role provisioning failed; verify the fresh isolated target and migration.',
  );
  process.exitCode = 1;
  void error;
} finally {
  await db.end();
}
