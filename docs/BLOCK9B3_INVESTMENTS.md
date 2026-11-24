# Block 9B.3 — persistent investments

Implemented on `feat/backend-9b3`; final verification dated 23 November 2026 (Australia/Sydney). This extends the existing development backend and F16–F18, not a production investment platform.

## Model and API

The unchanged InvestmentAccount, Investment, InvestmentMovement and InvestmentValuation models store manual account metadata, holdings, dated activity and valuations. ActivityLog stores correction snapshots and command idempotency fingerprints. No new portfolio entity, market-price table, migration or cash-account linkage was introduced. Existing composite workspace/currency foreign keys and numeric CHECK constraints remain enabled.

Under `/api/v1/workspaces/:wid`:

- `GET /investments` returns scoped accounts, holdings, movements, valuations, correction history, calculated positions and separate AUD/EUR/USD summaries.
- `POST /investments/commands` accepts `{ key, action, payload, version? }`. The UUID key identifies one operation. Existing-holding actions require the version captured when the form opens; a background refetch cannot silently authorize overwriting a newer record. The allowlisted actions are `createAccount`, `create`, `update`, `recordMovement`, `editMovement`, `deleteMovement`, `valuation` and `deleteValuation`.

Create includes the initial purchase/contribution and optional valuation atomically. Update edits metadata only; currency, asset type and original opening date cannot rewrite history. Corrections/deletions require explicit confirmation, retain audit snapshots, and revalidate all later movements. Deleted history is retained in PostgreSQL. Accounts can be created and selected; account editing, archive workflows and brokerage connections are not existing supported UI operations.

HTTP validation, controllers, service orchestration and persistence mapping live in separate investment modules. The existing Prisma client and transaction lifecycle are reused. Reads are complete bounded histories: each entity is capped at 10,000 rows, with an explicit failure rather than an incomplete financial result. This is not an optimized large-portfolio query design.

## Accounting and precision

The existing browser rules were extracted to browser-safe shared `investmentMath.js` and `investmentCommands.js`; the demo adapter still applies its original permission checks. The API independently validates fields and supplies authenticated server context before applying the same accounting rules.

Quantity and unit price are decimal strings with up to eight fractional digits and ten integer digits, matching Decimal(18,8). Products and weighted-average proportional disposal use scaled BigInt arithmetic, rounding half-up once to integer cents. Amounts/fees/valuations accept at most two fractional digits. Stored money is BIGINT. Investment DTO cents are bounded exact JSON integers (maximum 10,000,000,000,000 per amount), compatible with the established presentation code; quantities and prices remain plain decimal strings, including the smallest eight-decimal values; exponent notation from database Decimal serialization is explicitly avoided. Cumulative position and portfolio totals reject values outside exact integer range. Percentage display uses a floating-point ratio, not authoritative cash accounting.

Purchases and contributions add rounded acquisition amounts plus fees to remaining cost basis. Partial sales remove proportional weighted-average basis; full sales remove the exact residual. Realized result is proceeds less sale fee and disposed basis. In-kind withdrawals remove units and proportional basis without fictional proceeds. Principal withdrawals reduce basis at cost. Dividends/interest are distributions net of fees, not additional units. Standalone fees are counted once. Initial positive quantity may have zero price; principal must be positive. Unsupported types, negative values, excess precision and overselling are rejected.

Current unrealized result is comparable manual value minus remaining basis. Total nominal return is realized plus unrealized plus net distributions minus standalone/withdrawal fees. No annualized, money-weighted, time-weighted or tax return is claimed. All-currency reporting suppresses combined values and allocations; no implicit exchange rate exists.

## Valuation history

Manual snapshots retain date, source, creator, value and position signature. The signature uses dated capital movement identities and revisions. A later capital movement or backdated correction makes an earlier valuation unavailable for the changed position until a new value is recorded. Distributions and standalone fees do not change that signature. Zero is an explicit value; blank is unknown. Fully disposed positions have zero current value. Older snapshots remain available for dated history and confirmed soft deletion can restore an earlier comparable snapshot.

Same-day movements retain sequence ordering. Movement revisions use persisted update timestamps; valuations use creation ordering. Charts retain actual recorded dates, cost-basis steps and unknown gaps rather than fabricated historical prices. The API uses the current UTC accounting date, while UI reporting offers all recorded history, current year and current month. No fixed demo reporting range is applied to persistent records.

## Cash separation and cross-module behavior

Investment commands never write FinancialAccount, Transaction, ImportBatch, Invoice, Payment or PaymentAllocation. A purchase is not an ordinary expense; full sale proceeds are not profit; valuation appreciation is not income received. Contributions are portfolio capital records, not a brokerage cash balance. There is no automatic matching of imported bank transfers, dividends or invoice receipts to investments. Such reconciliation requires a separately designed workflow.

Live regression coverage records an actual invoice receipt and CSV expense, snapshots those records and account balances, then verifies purchase, sale and valuation operations leave them unchanged. Existing import, receipt, transfer and split constraints are exercised by their preserved suites.

## Authorization, transactions and limits

Every request resolves an active hashed-cookie session and active database membership. Owner/Editor may mutate; Viewer may read. Pending invitations grant no access; revoked memberships immediately lose access. All reads and mutations are workspace-scoped; account currency must match the holding. Actor, workspace, derived amounts, role and version increments cannot be mass assigned.

The existing user/workspace row locks coordinate authorization and commands. A command, initial history, version increment and audit event commit together. The UUID key, actor and canonical request fingerprint prevent repeated commands from creating repeated history. Identical retries return the original result; changed input or stale version returns 409. Independent-connection tests exercise competing sales and identical retries. An injected audit failure proves all related writes roll back. These are API transaction guarantees, not a claim that arbitrary direct SQL writes enforce the full accounting replay.

The guarded investment grant script verifies the approved loopback database and existing restricted role. `easyfinance_9a_app` receives investment SELECT/INSERT plus UPDATE only where correction/version workflows require it; no investment DELETE/TRUNCATE/DDL privileges. Existing session, CSRF Origin/custom-header checks, safe errors and authentication rate limits remain in effect. There is no RLS; server-side scoping remains essential. No credentials are exposed to React or documentation.

## React and visual preservation

Explicit API mode wraps the three existing components with persistent TanStack Query data and asynchronous commands:

- F16 `/investments`: persisted holdings, filters, dated charts, allocations and summaries.
- F17 `/investments/new` and `/:id/edit`: account creation, initial position and metadata editing.
- F18 `/investments/:id`: movements, corrections, valuations and retained history.

Investment links preserve the selected persistent workspace. Loading, empty, error/retry, stale values, read-only roles and save failures are handled. Retries reuse the pending operation identity; successful saves refresh shared cached records. Demo mode keeps its original fixtures/services. Home/Dashboard and unimplemented settings/category automation remain explicitly separate demonstration screens; their sample totals are not relabeled as persisted portfolio totals.

Existing components, cards, charts, tables, mobile cards, dialogs and shell are retained. Source references remain the six files in `docs/design/frames/05-investments/`: Dashboard `-1` desktop/base mobile; editar `-1` desktop/base mobile; Detalhes e histórico base desktop/`-1` mobile. Existing Block 5 visual interpretation remains applicable; creation and dialogs lack dedicated exports. A persistent workspace selector and truthful provenance labels add height. No pixel-perfect approval is claimed.

Screenshots live in ignored `test-results/block9b3-layouts/`, separate from demo/API runner artifacts. Principal `f16-overview`, `f17-editor`, `f18-detail` captures and matching viewport files cover 1440×900 and 390×844. Additional captures cover sale dialogs, corrected history and newly valued history. Full-page captures retain sticky controls at their current viewport position; content remains scrollable.

## Executed verification

Final regression results are recorded below after the final runs. Earlier intermediate failures are not counted as passes: one revoked-member fixture omitted revokedAt; a pending-invitation fixture used an invalid token hash; and the initial browser locator used labels that did not match the existing activity controls. These were corrected without weakening assertions. Vitest initially required local socket permission for existing API tests.

| Check                   | Final result                                                                                                                                                   |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Live API/security       | 98 passed: 72 preserved plus 26 investment cases                                                                                                               |
| Live database           | 31 passed                                                                                                                                                      |
| Offline database        | 14 passed                                                                                                                                                      |
| Vitest                  | 221 passed in 14 test files                                                                                                                                    |
| Demo Playwright         | 50 passed, 25 per viewport                                                                                                                                     |
| Real-API Playwright     | 8 passed, four per viewport                                                                                                                                    |
| Build, lint, formatting | Both production builds and npm run check passed                                                                                                                |
| Prisma                  | Schema validate and Client generation passed; one migration up to date                                                                                         |
| API health              | HTTP 200, status ok, service easyfinance-api                                                                                                                   |
| Preservation            | 34 domain tables, 84 foreign keys, 60 CHECK constraints, 11 deferred triggers; schema/migration/seed byte-identical to HEAD; all 49 authoritative hashes match |

After the final plain-decimal serialization correction, the 98-test live API suite and both investment browser viewport workflows were rerun successfully. The final form-version behavior is included in the complete 8-test API browser and 50-test demo browser runs. No tests were removed or skipped. Browser checks passed without page/console errors or horizontal document overflow. The final captures were inspected for responsive cards, exact decimals, readable activity, chart gaps, allocation and modal controls. No redesign or source-asset edit was needed. Installed dependency-tree validation passed. Test results and screenshots are local ignored artifacts; no CI or additional browser engine is claimed.

## Remaining limits

Local disposable PostgreSQL only; no production-readiness claim. No live prices, FX, broker connection, trade execution, advice, tax reporting, automated valuation, cash reconciliation, account editing/archive, background jobs or persistent Home/Dashboard integration. History-size limits and serialized workspace operations need workload evaluation. Production TLS/proxy policy, shared rate limiting, operational monitoring, backup/restore, audit retention, credential rotation and independent security review remain as documented in Block 9A. Other browser engines, real devices and CI were not exercised. Block 9B.4 is not started.
