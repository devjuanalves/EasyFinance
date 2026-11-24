// Explicit reviewed administrator operation; never called by API startup.
import 'dotenv/config';
import pg from 'pg';
import { disposableDatabaseUrl } from './safety.js';
const url = new URL(disposableDatabaseUrl());
if (
  url.hostname !== '127.0.0.1' ||
  url.port !== '5432' ||
  url.pathname !== '/easyfinance_block8_test'
)
  throw new Error('Unexpected target.');
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
    identity.address !== '127.0.0.1' ||
    identity.owner !== 'postgres'
  )
    throw new Error('Unexpected database identity.');
  const role = (
    await db.query(
      "SELECT rolsuper,rolcreatedb,rolcreaterole,rolbypassrls FROM pg_roles WHERE rolname='easyfinance_9a_app'",
    )
  ).rows[0];
  if (!role || Object.values(role).some(Boolean))
    throw new Error('Unexpected runtime privileges.');
  console.log(
    'Verified approved disposable database and restricted existing role',
    identity,
  );
  await db.query('BEGIN');
  await db.query(
    'GRANT SELECT, INSERT ON investment_accounts, investments, investment_movements, investment_valuations TO easyfinance_9a_app',
  );

  await db.query(
    'GRANT UPDATE ON investments, investment_movements, investment_valuations TO easyfinance_9a_app',
  );
  await db.query(
    'REVOKE UPDATE ON investment_accounts FROM easyfinance_9a_app',
  );
  await db.query('COMMIT');
  console.log(
    'Applied SELECT/INSERT/UPDATE investment grants. No DELETE/DDL or data mutation.',
  );
} finally {
  await db.end();
}
