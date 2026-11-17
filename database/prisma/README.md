# Prisma persistence structure

`schema.prisma` maps all 34 detailed blueprint entities. `migrations/202611170001_initial/migration.sql` contains generated structure and reviewed SQL-only integrity checks. `seed.js` creates disabled fictional identity and financial examples only through the disposable-database guard.

The sole configuration is root `prisma.config.js`. Generated code belongs in ignored `database/generated/client/`; never import it into React. See [setup](../../docs/DATABASE_SETUP.md) for commands, live results and safe validation requirements. The initial migration applied successfully to the verified disposable local database; seed reruns and 31 live integrity tests passed.
