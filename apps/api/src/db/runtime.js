import { PrismaClient } from '../../../../database/generated/client/index.js';
import { PrismaPg } from '@prisma/adapter-pg';
import { disposableDatabaseUrl } from '../../../../database/scripts/safety.js';
export function createRuntimeClient(source = process.env) {
  const connectionString = disposableDatabaseUrl({
    ...source,
    DATABASE_URL: source.API_DATABASE_URL,
  });
  const url = new URL(connectionString);
  if (url.username === 'postgres')
    throw new Error('API runtime cannot use postgres.');
  const password = decodeURIComponent(url.password);
  if (
    password.length < 16 ||
    /^(password|changeme|postgres|placeholder|example)/i.test(password)
  )
    throw new Error('An explicit non-default runtime password is required.');
  return new PrismaClient({
    adapter: new PrismaPg({
      connectionString,
      max: 10,
      connectionTimeoutMillis: 2000,
      idleTimeoutMillis: 30000,
      statement_timeout: 10000,
    }),
  });
}
export async function diagnoseRuntime(db) {
  const [r] =
    await db.$queryRaw`SELECT current_database() AS database, current_user AS role, r.rolsuper, r.rolcreatedb, r.rolcreaterole, r.rolreplication, r.rolbypassrls, has_schema_privilege(current_user,'public','CREATE') AS schema_create, EXISTS(SELECT 1 FROM pg_class WHERE relnamespace='public'::regnamespace AND relowner=r.oid) AS owns_objects FROM pg_roles r WHERE rolname=current_user`;
  if (
    r.rolsuper ||
    r.rolcreatedb ||
    r.rolcreaterole ||
    r.rolreplication ||
    r.rolbypassrls ||
    r.schema_create ||
    r.owns_objects
  )
    throw new Error('Unsafe runtime database privileges.');
  return { database: r.database, role: r.role };
}
