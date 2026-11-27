# Block 9A backend foundation

Implemented 18 November 2026 (Australia/Sydney) on the existing Express application and unchanged 34-model Prisma schema. This is a local development backend, not a production deployment. See [contracts](API_CONTRACTS.md), [authentication](AUTHENTICATION_BACKEND.md) and [integration evidence](BLOCK9A_INTEGRATION.md).

## Structure

- `apps/api/src/routes/v1.js`: versioned route inventory, public auth throttling, CSRF and authenticated boundary.
- `controllers/v1.js`: validate/translate HTTP requests and return consistent envelopes; no financial calculations.
- `validation/contracts.js`: strict body/query allowlists, UUIDs, supported currencies, real calendar dates, signed minor-unit strings, pagination and enum validation.
- `services/auth.js`, `workspaces.js`, `ledger.js`: credential/session lifecycle, atomic onboarding and workspace/member commands, financial mutation orchestration.
- `repositories/access.js`: active session lookup, user lock/transaction helper and database membership authorization. `repositories/ledger.js`: scoped ledger lookup, safe DTO serialization and audit writes. Services orchestrate Prisma operations inside these transaction boundaries; Prisma entities are not exposed to controllers as an authorization shortcut.
- `db/runtime.js`: one Prisma Client/PrismaPg pool per process, maximum ten connections, explicit development-target guard and startup privilege diagnostics.
- `security/passwords.js`, `security/http.js`: Argon2id, random opaque sessions, cookie policy, Origin/custom-header CSRF, bounded process-local throttling and request IDs.
- `middleware/authentication.js`, `middleware/errors.js`: authenticated identity and safe error responses. Logs contain request ID and safe error code, never bodies, cookies, password/hash, SQL or URLs.
- `server.js`: validates configuration, connects/diagnoses before listening, closes HTTP then disconnects Prisma on SIGINT/SIGTERM, with a bounded shutdown timeout.

The original `/api/health` contract is unchanged and deliberately database-independent. Startup diagnostics check the actual connected role; no public database-identity diagnostic endpoint was introduced. Prisma construction is not per request. Production flags require HTTPS and API mode, but the retained disposable-database guard deliberately rejects production runtime: enabling a deployment requires a separately reviewed configuration and secrets policy.

## Authorization and transactions

A cookie resolves to a hashed, active, unexpired session and active user. Each protected operation rechecks that session after taking a user row lock. Workspace operations then lock the workspace and re-read active membership from PostgreSQL. Owner/Editor may write financial records; Viewer may read. Membership list/change is Owner-only; no client role claim authorizes anything. Owner membership cannot be demoted through this route. Pending invitations are never consulted as membership. Unknown/inaccessible workspace/resource returns 404; a known member with insufficient role receives 403.

User then workspace lock order coordinates password/session changes, member revocation and domain writes. Workspace member updates use the same workspace lock as financial mutations. Existing SQL integrity fences/deferred triggers remain enabled. Successful transaction commands and their minimal audit event commit together. Reads use the same scoped helper/transaction boundary; this deliberately serializes small development workloads and is not a throughput claim.

Transaction creation requires a caller-generated UUID as its operation identity. A normalized request fingerprint is stored in server-owned `sourceData`; an identical retry by the same actor returns the one existing record. Different input/actor or a global ID collision conflicts. Mutations require the last observed integer `version`; a stale competing update returns 409. No automatic retry obscures a conflict. Tests execute simultaneous HTTP requests with different actor sessions and verify one stale edit loses; repeated identical creation yields one transaction and one audit event. Block 8 separately tests distinct PostgreSQL backend connections at ReadCommitted/Serializable.

## Financial contracts

Money is BIGINT in PostgreSQL and decimal integer strings in JSON; no FX or float arithmetic. Supported accounting currencies remain AUD/EUR/USD. Shared browser-safe `cashTotals` implements the same cash definition for Number fixture cents and BigInt database cents: non-excluded income, negative expense magnitude, transfer-neutral net cash. Split children classify an existing parent and never add cash. Opening balances are displayed separately, not counted as income. Database checks still enforce allocations, splits, transfer pairs and scope/currency relationships.

Create supports manual income/expense only. Account/currency/original source values are immutable after creation. Editing imported/payment/transfer/split records is blocked pending a corrective workflow. Any payment-linked receipt is protected, including a receipt originally created manually. Exclusion retains splits and originals; transfer rows and payment receipts cannot be independently excluded. Unrelated manual transactions can be edited/excluded/restored with version checks. Manual category decisions set the override marker and require a matching active scoped category.

Accounts are listed/read; onboarding supplies one empty manual account and two basic categories. No bank account is opened. Account management, import confirmation, split replacement, paired-transfer creation, invoice allocations, investments and automations are Block 9B contracts, not implemented endpoints. Existing mock services continue to exercise those UI workflows independently.

## Local database role

Before writes, read-only inspection reverified PostgreSQL 18.7 at 127.0.0.1:5432, database `easyfinance_block8_test`, owned by postgres, with the 34 domain tables plus migration metadata. User-authorized `database/scripts/runtime-role.js` created `easyfinance_9a_app`, generated its password and wrote only ignored root `.env` (`API_DATABASE_URL`). No database reset, table recreation or migration change occurred.

The runtime role has no superuser, CREATE DATABASE, CREATE ROLE, replication, bypass-RLS, schema CREATE, object ownership, DELETE or TRUNCATE grants. It can read the tables needed for authentication, workspace operations and deferred financial checks; INSERT/UPDATE is limited to users, sessions, workspaces, memberships, accounts, categories, transactions and activity logs. It cannot write invoice/payment/investment records. PostgreSQL tests verify DDL and DELETE are denied. This is table-level privilege separation, not row-level authorization: there is no RLS, and the application must enforce tenancy. The migration URL stays separate and is used only by guarded administration/tests.

## Remaining deployment work

Independent security assessment, verified email ownership, recovery delivery, MFA, trusted proxy/TLS configuration, distributed rate limiting, secret rotation, session cleanup/absolute policies, audit retention, least-privilege review under deployment workloads, database backup/restore, migration replay and operational monitoring remain pending. Lists paginate; summary currently scans the scoped ledger inside a transaction and needs workload benchmarking/aggregation planning before large datasets. Runtime privileges intentionally support only this slice; do not broadly expand them to bypass a failed future command.

## Block 9B.1 extension

The runtime now also serves clients, invoices, payment allocations and income summaries through dedicated invoice controller/validation/service/repository modules. A guarded grant script extends the same restricted role to these tables, including DELETE only on invoice_items for draft replacement. The Block 9A-only grant inventory above is historical. No schema or migration change was needed. See BLOCK9B1_INVOICES_PAYMENTS.md for the current authorization, financial and privilege boundaries.

## Block 10C operational hardening

Added `controllers/readiness.js` and `security/operations.js`: bounded/coalesced database readiness and allowlisted operational/authentication outcomes. Runtime credentials reject common defaults; pooling and HTTP timeouts are explicit; startup diagnostics reject replication privileges. Graceful shutdown marks readiness unavailable before draining. The API remains loopback/disposable-only. No financial service, schema, migration, seed or runtime grant changed. See [security/operations evidence](BLOCK10C_SECURITY_OPERATIONS.md) and the new guarded fictional backup rehearsal under `scripts/operations/`.
