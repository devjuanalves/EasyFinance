# Database foundation

Block 8 provides 34 Prisma models, one initial versioned PostgreSQL migration, guarded fictional seed and database tests. The frontend still uses its existing in-memory services; API health does not access a database.

See [architecture and model coverage](../docs/DATABASE_ARCHITECTURE.md), [safe setup and actual validation status](../docs/DATABASE_SETUP.md) and [future API/service mapping](../docs/DATABASE_FRONTEND_MAPPING.md).

Run `npm run db:format`, `npm run db:validate`, `npm run db:generate`, then `npm run db:test:offline` without a database. Live writes require a verified disposable loopback database, explicit acknowledgement and the guarded commands documented in DATABASE_SETUP.md. No destructive reset command is provided.

Prisma 7.10.1 uses the root JavaScript configuration, schema/migrations under `database/prisma/` and an ignored generated JavaScript client under `database/generated/`. All credentials remain server-only. SQL-only checks and deferred triggers are part of the migration and must not be discarded by regenerating SQL from Prisma alone.

Live PostgreSQL 18.7 validation passed: migration, seed reruns and 31 integrity tests, including independent-connection allocation races. Schema validation is not database execution or production authorization.
