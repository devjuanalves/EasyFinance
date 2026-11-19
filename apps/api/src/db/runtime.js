import { PrismaClient } from '../../../../database/generated/client/index.js';
import { PrismaPg } from '@prisma/adapter-pg';
import { disposableDatabaseUrl } from '../../../../database/scripts/safety.js';
export function createRuntimeClient(source = process.env) {
  const connectionString = disposableDatabaseUrl({
    ...source,
    DATABASE_URL: source.API_DATABASE_URL,
  });
  if (new URL(connectionString).username === 'postgres')
    throw new Error('API runtime cannot use postgres.');
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString, max: 10 }),
  });
}
export async function diagnoseRuntime(db) {
  const [r] =
    await db.$queryRaw`SELECT current_database() AS database, current_user AS role, r.rolsuper, r.rolcreatedb, r.rolcreaterole, r.rolbypassrls, has_schema_privilege(current_user,'public','CREATE') AS schema_create, EXISTS(SELECT 1 FROM pg_class WHERE relnamespace='public'::regnamespace AND relowner=r.oid) AS owns_objects FROM pg_roles r WHERE rolname=current_user`;
  if (
    r.rolsuper ||
    r.rolcreatedb ||
    r.rolcreaterole ||
    r.rolbypassrls ||
    r.schema_create ||
    r.owns_objects
  )
    throw new Error('Unsafe runtime database privileges.');
  return { database: r.database, role: r.role };
}
