# Database foundation

PostgreSQL is the database engine; Prisma is the ORM. Prisma 7.10.1 is pinned with matching CLI/client versions. The initial Prisma 6 selection was replaced to remove a high-severity transitive advisory. No client is generated or imported yet. No database is required for install, web development, health tests or builds.

## Local development (future schema block)

Provision a local PostgreSQL instance or container after the supported server major is selected in schema review. Create a dedicated development database and least-privilege user. Copy the root `.env.example` to `.env` and replace the `DATABASE_URL` placeholders locally; do not commit real values. Only server tools may read this URL. Never prefix it with `VITE_`.

`database/prisma/` is reserved for the reviewed schema and migrations. It contains only a README now. When approved, define the PostgreSQL datasource, JavaScript-compatible client generation and PostgreSQL driver adapter, validate the schema, generate the client, then create a named development migration. Review generated SQL before applying it. Commit schema and migration history; use migration deployment in release automation, not development migration commands or `db push` against production. Test migration rollback/recovery through backups and restore procedures. Do not create database scripts until their schema/config exists.

## Integrity and authorization

Use the blueprint's UUID keys, foreign keys, workspace-scoped uniqueness and exact decimal amounts. Dates and currencies remain explicit; do not use binary floating point for money. Invoice issuance is distinct from confirmed payment. Allocation/split totals need transaction-level checks; transfers and imports must avoid double counting. Keep source lineage and audit events. Store file bytes outside SQL, retaining metadata and authorization in SQL.

Every request must authenticate the individual, confirm active workspace membership and the required owner/editor/viewer permission, and scope repository access to that workspace. Child records must be checked through their parent scope; never trust a client-supplied workspace ID alone. Invitation possession is not active membership. Sessions and reset/invitation tokens are stored hashed, with expiry/revocation.

See [database review](../docs/architecture/DATABASE.md) for the authoritative pages and open conflicts. Schema and migrations remain explicitly deferred.
