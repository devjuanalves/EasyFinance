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
    'GRANT SELECT, INSERT, UPDATE ON clients, invoices, invoice_items, payments, payment_allocations TO easyfinance_9a_app',
  );
  // Only draft line replacement deletes rows. Issued records are locked by the service.
  await db.query('GRANT DELETE ON invoice_items TO easyfinance_9a_app');
  await db.query('COMMIT');
  console.log(
    'Applied scoped invoice/client/payment grants. No schema or data mutation.',
  );
} finally {
  await db.end();
}
