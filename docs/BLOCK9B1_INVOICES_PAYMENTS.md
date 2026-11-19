# Block 9B.1 — persistent income, invoices and payments

19 November 2026 (Australia/Sydney). Continued the clean `feat/backend-9b` branch from `d3d4207`. Only this income/invoice/payment slice extends Block 9A. No Block 9B.2 work, dependency additions, database reset, schema recreation or seed replacement.

## Architecture and contracts

The existing Express `/api/v1` router adds `controllers/invoices.js`, `validation/invoices.js`, `services/invoices.js` and `repositories/invoices.js`. Controllers validate transport inputs; the service owns financial transitions and transactions; repositories scope queries and serialize exact values. See [endpoint matrix](API_CONTRACTS.md#block-9b1-contract-inventory).

Models used: Client, Invoice, InvoiceItem, Payment, PaymentAllocation, Transaction, FinancialAccount and ActivityLog, plus existing User/AuthSession/Workspace/WorkspaceMember authorization. No new model or migration is required. The original 34-model schema, migration and seed remain unchanged.

Supported operations: client list/create/edit/archive/restore; invoice search/status/client/account/currency/date filters with pagination; create draft and edit its items; details and payment/activity history; issue; cancel unpaid documents; duplicate into a new draft; record partial/full payments; reuse an existing compatible receipt; read scoped payments; income/receivables summary. Account responses now include exact `balanceMinor` alongside opening balance. Print / Save PDF reuses the existing browser print path and actual invoice values.

Every operation revalidates the real session and current active database membership. Owner and Editor can mutate; Viewer can read. Missing/inaccessible workspace resources return 404, disallowed roles 403, malformed inputs 400 and conflicting/stale operations 409. Client-supplied roles, workspace ownership, invoice totals and lifecycle fields are rejected. Existing CSRF, cookie, CORS, rate limiting and safe error handling remain intact. Demo identity does not authorize API operations.

## Lifecycle and calculations

Stored lifecycle is `draft → issued` or `draft/issued → cancelled`. Only drafts permit financial editing. Issue requires positive reconciled totals and an active client; it locks the document without sending email or creating income. Cancel requires no allocations; cancelled or allocated documents cannot be silently rewritten. No refund, reversal, credit note, deletion of posted receipts or correction workflow is invented.

Paid/partial/overdue statuses derive from allocations and today's UTC date. Overdue is the unpaid issued subset whose due date has passed, including partially paid overdue documents. Outstanding is zero for draft/cancelled documents. Payment changes increment the invoice version; stale draft edits or transitions require reload.

The original exact calculator now lives in `packages/shared/src/invoiceMath.js`; the demo module re-exports it. Server and browser share the same rules: four decimal places for quantity/unit price/tax; BigInt multiplication; half-up line bases; fixed discount distributed proportionally with bounded residual allocation from the last line backwards; half-up tax on discounted lines; exact summed totals. No default GST or FX conversion. A subtotal bound is checked before conversion to safe integer cents, preventing a very large subtotal hidden by a large discount. V1 retains the existing 100,000,000,000-minor-unit document limit. API money serializes as decimal strings; quantities/prices remain decimal strings. PostgreSQL verifies item rounding and header reconciliation at commit.

Client snapshots preserve historical identity when a client is edited or archived. New drafts require active clients and compatible active accounts/currency. Archived clients remain readable in prior invoices. Currency changes do not convert past records.

## Receipts, allocations and concurrency

Each payment command holds the existing workspace lock inside a Prisma transaction after rechecking session/membership. New receipts atomically insert one income Transaction, one confirmed Payment, its allocation, invoice version update and activity event. A failure rolls all of these back, including a database conflict after receipt insertion. Existing deferred checks and financial fence remain enabled.

A supplied transaction ID must resolve in the same workspace, be unexcluded income, and match receiving account, currency and payment date. Its full amount and original date remain unchanged. An existing Payment is reused; only its unallocated remainder can be allocated. Multiple invoices can share one payment, and later allocations to the same invoice increment its unique payment/invoice allocation. No extra cash transaction is created. Pending payments require a later review workflow. Payment-linked transactions remain protected against editing/exclusion by the existing ledger service.

The UUID request key is workspace-wide. A committed payment activity stores its normalized request fingerprint, actor, target invoice and original result. An identical retry returns that result even after later invoice changes; differing inputs conflict. Workspace locking serializes lookup and write. The Payment unique key also rejects collisions with preexisting receipts lacking an activity record. Reusing a receipt uses a fresh allocation request key without replacing its original payment identity. Activity metadata is internal and is not returned in the public invoice timeline. Audit rows are not claimed to be tamper-proof against administrators.

Independent runtime Prisma clients/backend PIDs exercise competing requests: only one excessive competing allocation succeeds, and concurrent identical keys create one receipt. Original database tests also exercise actual-COMMIT and independent-connection deferred constraint races. This is scoped V1 evidence, not a claim of unlimited throughput or exhaustive serializability.

## Reporting basis and frontend

Received income sums non-excluded income Transactions by booking date, never payments plus transactions. Issued invoices alone do not increase cash. Invoiced, paid allocations, outstanding and overdue use eligible invoice issue dates; overdue is not added again to outstanding. Each summary is currency/workspace isolated. Client/account filters are honored; Overview KPIs use issue period/account/client/currency independently of row search/status. Invoice-list KPIs also honor search; status narrows only the rows. Account `balanceMinor` is opening balance plus all non-excluded signed ledger records; it is a ledger-derived development balance, not a bank balance. Transfers affect individual account balances but remain excluded from income/expense totals. Existing receipt association does not rewrite its client/source/date metadata.

API mode connects F07–F11 through `PersistentIncome.jsx`, the existing authenticated client and TanStack Query. It reuses IncomePage, KPI cards, fields, InvoiceItems, InvoicePreview, ClientForm, AppDialog, existing table/card styles and shell. Mutations invalidate scoped caches; loading, retry, empty, forbidden and conflict errors are visible. Drafts warn on unsaved navigation/reload. Workspace selection is separate from the shell's demo selector; invoice links retain workspace context. Both mock and persistent modes remain available using the Block 9A commands.

F01–F04 and F12/F14 retain their real APIs. Home/Dashboard, statement import, category/rule editing, investments, collaboration/automations and shell history/notifications remain explicitly separate demonstrations. No persistent figures are replaced with mock fixtures in F07–F11. Email, automated bank suggestions, recurring templates/scheduling, batch CSV selection and real PDF generation are not connected in API mode. The original demo workflows retain those existing simulated controls. Browser print-to-PDF remains available. The persistent overview currently emphasizes reconciled KPIs and invoice rows rather than the demo's richer charts. No new design approval is claimed.

## Runtime permissions and preservation

`database/scripts/invoice-runtime-grants.js` is a separate reviewed administrator operation, not a migration or API-startup action. It checks the acknowledgement, exact loopback target `easyfinance_block8_test`, actual server/database owner and existing restricted role before granting SELECT/INSERT/UPDATE on clients/invoices/items/payments/allocations and DELETE only on invoice_items for draft replacement. It does not change credentials, ownership or schema. No DELETE privilege was granted on invoices, payments, allocations, transactions or users; no superuser/DDL/TRUNCATE rights were added. The API is responsible for draft-only item deletion and immutable posted records; this is not RLS. Production privilege/retention review remains required.

All writes/tests use the approved disposable local PostgreSQL 18.7 database. Tests retain fictional records and never delete/reset prior user data. No automatic seed recreation or schema migration was performed for this feature.

## Validation record

- 49 live API tests passed: original 26 plus 23 invoice/payment tests, including independent connections, idempotency, partial/full receipts, draft edits, permission isolation, rollback, currency checks and archived snapshot preservation.
- Original 31 live database tests and 14 offline tests passed.
- Complete `npm run check`: 220 Vitest tests in 14 files, ESLint, Prettier and default production build passed. An initial sandbox run could not bind local API test sockets; the authorized run passed.
- Prisma 7.10.1 validation/generation and migration status passed. The initial migration remains current.
- Complete demo Playwright regression: **50 passed**, no skipped tests. Real-API Playwright: **4 passed**, two workflows at each target viewport, retaining the original Block 9A journey.
- Both demo and API production builds passed; the checked React development bundle markers were absent in both artifacts. Installed dependency tree check passed.
- API health returned HTTP 200 with `status: ok`, `service: easyfinance-api`. Read-only live verification confirmed PostgreSQL 18.7, database `easyfinance_block8_test`, runtime role `easyfinance_9a_app`, 34 domain tables, 84 validated foreign keys, 60 CHECK constraints and 11 deferred triggers. Runtime diagnosis rejects elevated/owner/schema-create privileges; DELETE remained false for users/invoices/payments and true only for invoice items among the checked tables.
- Original Prisma schema, seed and initial migration are byte-identical to HEAD. All 49 authoritative asset SHA-256 hashes match; OS metadata is excluded. `git diff --check` passed. Exact configured credential/URL scanning found no matches in changed files or task logs; `.env` remains ignored.

### Browser artifacts and final review

Demo and API runner artifacts now use separate `test-results/demo-runs/` and `test-results/api-runs/` directories. This prevents either runner from deleting the other's results. Persistent captures remain under `test-results/block9b1-layouts/`, outside both runner output directories.

Each state has `desktop-` (1440×900) and `mobile-` (390×844) full-page PNGs and matching `-viewport.png` captures: `clients`, `editor`, `invoices`, `details`, `partial-payment`, `paid`, `overview`, `receipt-transactions`, and `account-reconciliation`. Captures were inspected for responsive cards/tables, invoice values, forms and navigation. Browser assertions check overflow, image loading, page errors and console errors; payment dialogs, navigation, refresh and logout are exercised. No horizontal overflow or browser errors remained in the passing runs. Partial payment shows 50 received / 104 outstanding; full payment shows 154 received / zero outstanding; account balance and income reconcile to the two receipts of 50 and 104. Full-page screenshots retain fixed navigation at the capture viewport position; page content remains scrollable above it.

The existing Block 3 visual references and shared shell/components remain authoritative. These are functional persistent adaptations, not new pixel-perfect approval; existing typography/visual approval dependencies remain. A final explanatory label was corrected to distinguish invoice-list search scope from overview KPI scope, without changing calculations.

An initial finalization demo run reported three console-error failures while Prisma generation overlapped the watched API process; traces showed health-connection refusals. A generation-triggered restart is the likely cause, not proven independently. The sequential full rerun passed all 50 tests with console assertions unchanged. An added account-balance browser assertion initially navigated to Transactions; it was corrected to Expense Overview, where Financial accounts is actually displayed. No delay or weakened assertion was used.

Initial corrections: the revoked-member fixture needed its required revoked timestamp; a browser transaction locator counted both visible text and screen-reader suffixes; the invoice table needed the existing income-table responsive class. An existing Expenses browser locator exposed a duplicate page/KPI heading, corrected by naming the KPI Transaction count. No assertion was removed or weakened and no arbitrary delay was added.

Remaining release work includes production deployment/security review, email verification/recovery, distributed throttling, operational backups/monitoring, large-ledger pagination/aggregation benchmarking, other browser engines/real devices and CI. Invoice lists currently filter derived statuses in memory after a scoped query; clients and summaries are scoped but not optimized for large workspaces. Block 9B.1 is complete for the approved local V1 persistence scope. Block 9B.2 may build on these contracts after separate authorization; it has not been started.
