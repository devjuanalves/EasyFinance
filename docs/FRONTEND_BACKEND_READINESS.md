# Frontend to backend readiness

Reviewed 17 November 2026. This is a design assessment, not implemented API contracts, an approved schema or authorization to begin Block 8. Sources: Draw.io functional pages F01–F21, database dictionary DB01–DB09 and alternate page 42, plus [existing database conflict review](architecture/DATABASE.md).

## Existing replacement boundaries

`features/auth/services/authService.js` supplies simulated asynchronous account/session behavior. `services/api.js` currently calls health only. The shared financial store in the Income service publishes session snapshots; Income, Expenses, Investments and Settings dispatch validated domain operations into that same state. Selectors feed Home/Dashboard and module screens. Keep UI contracts independent of HTTP, replace service operations with adapters and invalidate/refresh the affected queries after committed server results. Avoid optimistic financial totals unless rollback and version checks are defined. Do not persist demo users or fixture records as real customer data.

## Persistent entity inventory

| Dictionary group | Required persistent concepts                                                   |
| ---------------- | ------------------------------------------------------------------------------ |
| DB01             | users, auth_sessions, password_reset_tokens, workspaces                        |
| DB02             | workspace_members, workspace_invitations, financial_accounts, import_batches   |
| DB03             | attachments, transactions, transaction_splits, transfers                       |
| DB04             | categories, categorization_rules, clients, invoice_templates                   |
| DB05             | invoices, invoice_items, invoice_deliveries, payments                          |
| DB06             | payment_allocations, recurring_invoice_rules, investment_accounts, investments |
| DB07             | investment_movements, investment_valuations, conversations, messages           |
| DB08             | ai_suggestions, automation_rules, automation_runs, notifications               |
| DB09             | notification_preferences, activity_logs                                        |

Use the actual dictionary for final column/enum names; this inventory groups concepts, not DDL. Preserve foreign-key ownership, archive/history semantics and immutable source records.

## Proposed operation contracts to agree before implementation

| Domain        | Reads / commands                                                                                        | Required boundary                                                                                    |
| ------------- | ------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Identity      | Register, sign in/out, session, recovery, onboarding                                                    | Server-derived identity, credential policy, generic recovery response; real verified invitations     |
| Workspace     | Profile/preferences, workspace metadata, membership/invitation lifecycle                                | Owner-only management; personal preferences never exposed through member lists; immediate revocation |
| Ledger        | Scoped accounts/transactions, create/edit, split, transfer, exclude/restore                             | Editor/Owner writes, Viewer reads; source preservation, allocation protection, exact cents           |
| Imports       | Upload, parse/map, review, confirm, batch history/exclusion                                             | Separate preview from committed ledger, explicit duplicate decisions, idempotent confirmation        |
| Income        | Clients, invoice drafts/items, issue/correct/cancel/duplicate, document render and delivery preparation | Finalized record protection; immutable recipient/document snapshot; server-generated numbering       |
| Payments      | New receipt, link existing transaction, allocations, match review                                       | Atomic receipt/allocation, currency agreement, remaining-balance lock, no double income              |
| Investments   | Accounts/holdings, movement history, valuation, correction                                              | Decimal precision, history replay, position/version checks; explicit cash-link policy                |
| Automation    | Templates/rules, preview, prepare occurrence, run history, retry                                        | Unique occurrence and template-cycle keys; drafts only until reviewed; transactional job/outbox      |
| Notifications | Recipient inbox/read state/preferences                                                                  | Recipient and workspace isolation; real delivery acknowledgements distinguished from preparation     |
| Assistant     | Conversations/messages, suggestions, review decisions                                                   | Scoped read access, untrusted AI output, explicit human approval before financial commands           |

Agree pagination, sort order, filter semantics, ISO date formats, stable IDs, typed error codes and field errors for every operation. Distinguish 401, 403/hidden inaccessible records, 404, conflict/version errors and validation failures. Use safe user messages and correlation IDs, not stack traces. This document does not invent live endpoint URLs.

## Identity and authorization requirements

Authenticate on the server; use an explicitly reviewed cookie/token design with secure transport, HttpOnly/Secure/SameSite settings where applicable, CSRF protection, rate limits, expiry and revocation. CORS and route guards are not authorization. Every query, join, attachment and command must enforce active workspace membership from the authenticated identity. Do not trust client userId, role or workspace selection. Validate each referenced account/client/invoice/category belongs to the authorized workspace and currency scope. Owner/Editor/Viewer rules must apply even when UI buttons are bypassed. Invitations need hashed expiring tokens and verified recipients; simulated identity switching must not ship as production access control.

## Atomicity, idempotency and concurrency

- Commit a new receipt transaction, payment and allocations together. Linking an existing transaction must reuse its payment identity; lock/check unallocated payment amount and outstanding invoice balance. Enforce compatible currency and unique external/source identifiers.
- Commit splits with an exact parent sum; keep the original source for audit. Transfer pairs need a unique relation, same authorized ownership and explicit FX policy. Exclusion must reject protected invoice-linked receipts unless a corrective allocation workflow exists.
- Confirm imports with a stable request key, locked review version and duplicate fingerprints against the committed ledger. Keep Both needs explicit actor/reason evidence; a fingerprint alone must not permanently forbid legitimate equal transactions.
- Serialize investment movements per position or use optimistic versions and replay checks. Invalidate valuations after incompatible movements; corrections must revalidate dependent history. Do not count unlinked investment activity as cash.
- Enforce unique automation rule/occurrence and template/cycle preparation, transactionally create draft/run records and an outbox item. Retry must return the existing result. Email or bank provider retries need provider idempotency keys and delivery acknowledgement records.
- Recheck permission and record version when committing, including membership revocation between preview and confirmation. Audit rejected and successful sensitive operations without logging secrets.

## Precision and time

The frontend uses integer minor units for supported two-decimal currencies, invoice decimal inputs up to four places and investment quantity/price inputs up to eight places. BigInt scaled arithmetic and half-up cent rounding are deterministic. Invoice discount floors proportional shares then distributes residual backward within each line's capacity; tax follows discount. Persist exact decimal strings/NUMERIC with explicit scale, bounds and rounding; do not use binary floats for financial totals or silently infer FX. Recalculate on the server and compare versions rather than trusting client totals.

Separate date-only issue/payment/valuation dates from UTC event timestamps. Define workspace timezone, date cutoffs and DST behavior before scheduling. The older manual recurring template uses fixed day intervals; Settings automation uses calendar-aware recurrence. Resolve this distinction into one approved backend schedule contract rather than copying both behaviors accidentally.

## Attachments, parsing and audit

Use private object storage with scoped short-lived access, size/type/content checks, scanning, checksums, retention and deletion rules. Never trust filename extensions or browser MIME alone. Parse statements in a bounded isolated process; record source hash, mapping/parser version and row-level errors. PDF/OCR requires a separately reviewed service and explicit user review. Preserve raw sources separately from normalized values and category overrides. Neutralize spreadsheet formula text on export without modifying stored source data; test actual supported spreadsheet consumers before release.

Append actor/workspace/time/request/version/reason to financial and access changes. Delivery preparation, successful provider delivery, failure and retry must be distinct. Logs must not expose credentials, invitation/reset tokens or unnecessary personal/financial text.

## Unresolved model and migration decisions

The detailed 34-table dictionary and alternate page 42 use conflicting session/account/invoice-payment/position/conversation concepts. Existing `architecture/DATABASE.md` remains authoritative for these unresolved discrepancies. Do not implement both variants or silently pick a new schema.

The mock combines some template/rule concepts, derives invoice overdue/partial state, uses dated opening balances and accepted ledger entries without a production settlement state, and stores profile/preferences/notification settings in frontend shapes. Define normalized mappings and lifecycle enums before persistence. Participant fixture identities must map to real users/memberships explicitly. Client snapshots, recurring-template item snapshots, investment correction history, notification preference scope and immutable invoice versions need agreed ownership and retention. No database migration has been authored or exercised; PostgreSQL version, hosting, backups, encryption and recovery objectives remain undecided.

## Recommended sequence

Resolve dictionary and API contracts first; then implement identity/workspaces and server authorization, accounts/ledger with atomic commands, imports, clients/invoices/payments, investment history, notifications/automation and finally external providers/AI. Each stage needs contract, authorization, concurrency and migration tests plus frontend regression coverage. Current mocks are useful behavioral examples, not production repositories or security controls.

## Block 8 structural decisions

The later authorized database foundation now represents all 34 detailed dictionary entities. [Database architecture](DATABASE_ARCHITECTURE.md) resolves the alternate page-42 names, maps preferences/import review data without extra tables, and documents integer money, exact decimals, lifecycle mappings and composite ownership/currency keys. [Setup](DATABASE_SETUP.md) records successful Prisma/client/offline checks and live PostgreSQL 18.7 execution. [Frontend mapping](DATABASE_FRONTEND_MAPPING.md) proposes future endpoint/service boundaries; none were implemented. The earlier readiness assessment above remains historical. Schema/migration structure exists, but live migration and scoped allocation concurrency validation passed; production integration controls remain outstanding.

## Block 9A implemented boundary

The earlier readiness inventory remains historical. Real local registration/login/session/logout/password change, workspace authorization and Accounts/Transactions/Expense Overview now have [implemented contracts](API_CONTRACTS.md). Cookie authentication and PostgreSQL runtime privileges are documented in [backend architecture](BACKEND_ARCHITECTURE.md). Explicit API mode connects F01–F04 and the F12/F14 persistence slice; other domain screens continue as labeled demos. Home/Dashboard do not yet combine persistent data with fixtures. [Integration evidence](BLOCK9A_INTEGRATION.md) records actual tests and remaining production gaps. No Block 9B endpoints were added.
