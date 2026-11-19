# Database setup and validation — Block 8

The existing web app still runs without PostgreSQL. Database tooling does not replace frontend mocks or change `/api/health` into a readiness probe.

## Installed tooling

Verified Prisma CLI, Client and PostgreSQL adapter **7.10.1**, Node **24.19.0**, and pg **8.23.1**. One root `prisma.config.js` specifies `database/prisma/schema.prisma`, its migrations directory and JavaScript seed. Connection URL comes from server-only DATABASE_URL; dotenv loads the root environment when commands run from repository root. No database URL is embedded in Vite.

The installed CLI successfully loads JavaScript configuration; no competing prisma7.config.ts was introduced. This matches the [official supported config extensions](https://www.prisma.io/docs/orm/v7/reference/prisma-config-reference). The supported legacy `prisma-client-js` generator creates a JavaScript-compatible client under ignored `database/generated/client/`, keeping application source free of TypeScript. The newer default generator emits TypeScript; see [official generator documentation](https://www.prisma.io/docs/orm/v7/prisma-schema/overview/generators). Future upgrades must review legacy generator support. Runtime database tooling uses PrismaPg; no production API imports the generated client.

## Live validation — 17 November 2026

The previous missing-server blocker is resolved. Authenticated read-only inspection verified PostgreSQL **18.7**, server address **127.0.0.1:5432**, database **easyfinance_block8_test**, role **postgres**, and local data directory `/Library/PostgreSQL/18/data`. Before writes, catalog inspection found no non-system relations or functions. The user explicitly designated this database disposable and configured ignored root `.env` with `EASYFINANCE_DISPOSABLE_DB=yes`. Credentials were not printed or committed.

The existing `202611170001_initial` migration applied successfully through the guarded deploy command; status reports up to date and the applied checksum matches the reviewed SQL. All 34 domain table names match Prisma model mappings. No SQL correction, reset, drop, db push or second database was needed. Actual catalogs contain **34 domain tables**, plus Prisma migration history; **84 validated foreign keys** (31 composite), **60 validated CHECK constraints**, **198 valid indexes** (104 unique, including primary keys; three partial), nine initially deferred financial checks and two initially deferred owner checks. The 35 primary keys include migration history. Unique indexes and relationships were also exercised behaviorally by integration tests.

Both explicit seed executions succeeded; the integration seed-rerun test also passed. **31 live database tests passed**, including actual-COMMIT rejection and competing allocation writes on two independently identified backend connections under ReadCommitted and Serializable. Each race committed only one 600-minor-unit allocation against a 1000-minor-unit invoice; the final sum remained 600.

This verifies the initial migration against one fresh local PostgreSQL 18.7 database. A second-database replay, other PostgreSQL versions, least-privilege runtime roles, production workloads and backup/restore remain untested. The `postgres` role used here is for this disposable validation only.

## Offline commands

From repository root:

```sh
npm run db:format
npm run db:validate
npm run db:generate
npm run db:test:offline
```

These require installed dependencies but not a DATABASE_URL. Client generation must precede offline tests, which inspect its actual DMMF model metadata. They verify 34-model coverage, minor-unit types, scope keys, migration safety markers, safe-target rejection and precise serialization. They do not parse/execute PL/pgSQL or prove FK/concurrency behavior.

The initial Prisma portion was generated with:

```sh
npx prisma migrate diff --from-empty --to-schema database/prisma/schema.prisma --script
```

Custom SQL was then reviewed and added to the versioned migration. Do not redirect that command over the reviewed migration. No `db push` or migration reset was used.

## Establishing a disposable local database

Use a supported local PostgreSQL **16 or later** installation, with a dedicated test role and newly created database. PostgreSQL 18.7 was tested here; other versions remain untested.

Verify the server is loopback-only, the database is new and disposable, and it contains no personal/shared data. A local port can tunnel elsewhere, so hostname validation alone does not establish ownership. Inspect the actual server/database identity before setting acknowledgement. Do not reuse an existing database merely because its name matches.

Example creation, after confirming your local server/role:

```sh
createdb --host=127.0.0.1 --port=5432 --username=YOUR_TEST_ROLE easyfinance_test_disposable
```

Set root `.env` locally (placeholders below; never commit credentials):

```dotenv
DATABASE_URL=postgresql://USER:PASSWORD@127.0.0.1:5432/easyfinance_test_disposable?schema=public
EASYFINANCE_DISPOSABLE_DB=yes
```

The acknowledgement explicitly designates the target as disposable. Guards reject production NODE_ENV, non-loopback hosts, unrelated names and URL query overrides. Allowed names are `easyfinance_test_disposable` or `easyfinance_dev_disposable`, optionally followed by an underscore and lowercase alphanumeric suffix. The exact user-designated name `easyfinance_block8_test` is also allowed, without suffixes. Only the public schema is accepted. Do not bypass guards by using unguarded write commands against another URL.

After reviewing the SQL and checking the target identity with psql, run:

```sh
npm run db:migrate
npm run db:status
npm run db:generate
npm run db:seed
npm run db:seed
npm run db:test
```

`db:migrate` uses versioned `prisma migrate deploy`; no shadow database or destructive reset is required. The migration is atomic BEGIN/COMMIT SQL. Check PostgreSQL catalog tables, indexes, FK/check definitions and trigger definitions; integration tests include structural counts and behavior, including rejection at commit. Inspect `pg_constraint` and `pg_trigger`, not Prisma validation alone.

For reproducibility, create a second new empty database named `easyfinance_test_disposable_replay`, explicitly designate that new URL and repeat deploy/status/seed/tests. There is no automated reset command. Prefer a fresh disposable database over deletion. If resetting is eventually necessary, stop clients, verify exact database identity and explicit disposal approval before any drop/recreation; never use migrate reset against existing personal/shared data.

## Seed and integration behavior

The seed creates 19 stable fictional records covering identity/membership, account/category/client/template, one 100 AUD invoice and item, one 25 AUD receipt/payment/allocation, manual investment account/position/movement/valuation, paused review automation, notification and preference. IDs use a deterministic UUID namespace. The user is disabled with no password hash; no usable login credentials, tokens or real personal information are stored. No notification email, schedule or financial provider runs.

Upserts use empty updates so reruns do not overwrite existing seed edits; this is idempotent initialization, not a reset. All inserts run in a transaction. Incompatible existing records will fail validation rather than being silently repaired. Some integration tests deliberately commit additional fictional records (especially concurrent allocation) in the disposable database; most positive cases force deferred checks then roll back their test data. Tests do not remove existing records. Repeated tests use unique operation IDs.

## Validation record

Prisma format, schema validation and JavaScript client generation executed successfully. **14 offline database tests and 31 live database tests passed**. Migration deployment/status and seed execution/rerun passed as described above. Full application regression and preservation results are recorded in PROGRESS.md after final checks.

## Troubleshooting and release gates

Missing generated client: run db:generate. Missing URL/acknowledgement: establish and inspect a disposable target; do not simply suppress the guard. Database connection refused: verify your dedicated server/port without exposing credentials. Constraint failure: inspect the rejected final transaction state; do not disable triggers. Deadlock/serialization failure: retry the entire idempotent command after permission/version checks. Failed migration: inspect Prisma status and SQL before any resolution; never mark an unexecuted migration applied to make status green.

Before production use, repeat live tests on the deployment environment and a second fresh migration replay, benchmark workspace write contention, review least-privilege roles, backups/restore and all unresolved contracts in DATABASE_ARCHITECTURE.md. Application roles must not own schema, disable triggers or create shadowing objects. Credentials belong in secret management; query parameters and logs must not leak connection strings.

Final application regression: **209 Vitest tests and 50 Playwright tests passed**; build, lint, formatting and installed dependency checks passed. API health returned HTTP 200 / ok; all 49 authoritative assets matched. Frontend source hashes are unchanged from the start of Block 8. The frontend continues using in-memory services; no database connection was added to React.

## Block 9B.1 runtime grant extension

After verifying the same approved disposable target, `node database/scripts/invoice-runtime-grants.js` was executed as a reviewed administrator operation. It grants only the existing invoice/client/payment tables and draft item replacement access to easyfinance_9a_app; it does not recreate the role, rotate credentials, change schema or reset data. Never run privileged setup automatically from API startup. See BLOCK9B1_INVOICES_PAYMENTS.md for the exact scope.
