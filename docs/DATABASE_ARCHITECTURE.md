# Block 8 database architecture

Prepared 17 November 2026. Scope: PostgreSQL/Prisma persistence structure only. The frontend and existing Express health service remain unchanged. **Prisma/offline checks and live PostgreSQL 18.7 validation passed: 31 integration tests, including independent-connection allocation races. Production readiness still requires the service and deployment controls below.** See [setup and validation status](DATABASE_SETUP.md).

## Sources and reconciliation decisions

The actual 42-page Draw.io file, DB00–DB11 dictionary/ER/screen mapping, detailed frontend services and Block 7 readiness report were reviewed. DB01–DB09 enumerate **34 tables**, represented by **34 Prisma models**. The initial migration contains 34 domain CREATE TABLE statements; Prisma's own migration-history table is additional tooling metadata.

DB01–DB09 detailed names take precedence over the alternate page 42 overview: `auth_sessions` rather than sessions, `financial_accounts` rather than accounts, separate payments/allocations rather than invoice_payments, investments/movements/valuations rather than assets/positions, and conversations/conversation_messages rather than ai_conversations/ai_messages. Page 42 queue, insight, snapshot and provider-delivery expansions are deferred. They are not silently implemented as extra production tables.

Concrete frontend requirements refine the dictionary without adding tables:

- Personal preferences are `users.preferences` JSON; workspace type, currency and timezone remain separate. No extra profile/preferences table is needed for the current behavior.
- Import batches retain bounded `sourceRows`, `reviewDecisions` and mapping/parser-version JSON, including excluded rows, original values and duplicate candidate IDs. Accepted rows become transactions with batch/row identity. A normalized imported-row/review-queue design can be reconsidered for larger imports; JSON references require service validation.
- Financial amounts use BIGINT minor units rather than the dictionary's NUMERIC(18,2), matching existing integer-cent services. Decimal invoice quantities/prices and investment quantities/prices retain the dictionary's exact NUMERIC scales.
- Invoice lifecycle is draft/issued/cancelled. Sent is delivery evidence; partial/paid/overdue derive from confirmed allocations and dates. No contradictory stored overdue enum is introduced.
- A confirmed payment requires one transaction, with unique transaction linkage. Pending payments may have no transaction. A receipt can exist without any payment or invoice; do not sum payment and transaction amounts as independent income.
- Optional transaction client and invoice participant references preserve source/participant filters independently of the creating actor. Invoice client snapshots, receiving account, template occurrence, payment terms, investment correction markers/sequence/signature and manual category overrides preserve implemented behavior.
- Templates and recurring rules are separate as specified in DB04/DB06; the combined frontend recurring object maps to both. Automation can reference a recurring rule. Unique template occurrence on invoices protects preparation across different rules.
- Stable UUIDs replace fixture IDs at the future API boundary. Prisma generates UUID defaults; direct SQL callers must supply IDs. No live fixture migration exists.

## Naming and coverage matrix

Prisma model names are singular PascalCase, fields camelCase, tables/columns explicit snake_case via `@@map`/`@map`. All models have UUID IDs, created-at timestamps and Prisma-managed updated-at timestamps. Event timestamps are TIMESTAMPTZ(6), accounting dates DATE. Raw SQL writers must supply/update timestamps where Prisma normally does so.

Every row below has **schema/client coverage verified offline and table structure verified on PostgreSQL 18.7**. Parent lists show declared foreign-key targets; reverse collections provide one-to-many navigation. Required/optional cardinality is explicit in schema.prisma. All domain foreign keys use RESTRICT for deletion and update.

| Conceptual entity / SQL table | Prisma model             | Referenced parents                                                            | Validation                 |
| ----------------------------- | ------------------------ | ----------------------------------------------------------------------------- | -------------------------- |
| `users`                       | `User`                   |                                                                               | PG 18.7 structure verified |
| `auth_sessions`               | `AuthSession`            | User                                                                          | PG 18.7 structure verified |
| `password_reset_tokens`       | `PasswordResetToken`     | User                                                                          | PG 18.7 structure verified |
| `workspaces`                  | `Workspace`              | User                                                                          | PG 18.7 structure verified |
| `workspace_members`           | `WorkspaceMember`        | Workspace, User                                                               | PG 18.7 structure verified |
| `workspace_invitations`       | `WorkspaceInvitation`    | Workspace, User                                                               | PG 18.7 structure verified |
| `financial_accounts`          | `FinancialAccount`       | Workspace                                                                     | PG 18.7 structure verified |
| `import_batches`              | `ImportBatch`            | Workspace, FinancialAccount, Attachment, User                                 | PG 18.7 structure verified |
| `attachments`                 | `Attachment`             | Workspace, User                                                               | PG 18.7 structure verified |
| `transactions`                | `Transaction`            | Workspace, FinancialAccount, ImportBatch, Category, Transaction, User, Client | PG 18.7 structure verified |
| `transaction_splits`          | `TransactionSplit`       | Workspace, Transaction, Category                                              | PG 18.7 structure verified |
| `transaction_transfers`       | `TransactionTransfer`    | Workspace, Transaction                                                        | PG 18.7 structure verified |
| `categories`                  | `Category`               | Workspace                                                                     | PG 18.7 structure verified |
| `category_rules`              | `CategoryRule`           | Workspace, Category, User                                                     | PG 18.7 structure verified |
| `clients`                     | `Client`                 | Workspace                                                                     | PG 18.7 structure verified |
| `invoice_templates`           | `InvoiceTemplate`        | Workspace, Client                                                             | PG 18.7 structure verified |
| `invoices`                    | `Invoice`                | Workspace, Client, FinancialAccount, User, InvoiceTemplate                    | PG 18.7 structure verified |
| `invoice_items`               | `InvoiceItem`            | Workspace, Invoice                                                            | PG 18.7 structure verified |
| `invoice_deliveries`          | `InvoiceDelivery`        | Workspace, Invoice                                                            | PG 18.7 structure verified |
| `payments`                    | `Payment`                | Workspace, Transaction, User                                                  | PG 18.7 structure verified |
| `payment_allocations`         | `PaymentAllocation`      | Workspace, Payment, Invoice                                                   | PG 18.7 structure verified |
| `recurring_invoice_rules`     | `RecurringInvoiceRule`   | Workspace, Client, InvoiceTemplate, User                                      | PG 18.7 structure verified |
| `investment_accounts`         | `InvestmentAccount`      | Workspace                                                                     | PG 18.7 structure verified |
| `investments`                 | `Investment`             | Workspace, InvestmentAccount                                                  | PG 18.7 structure verified |
| `investment_movements`        | `InvestmentMovement`     | Workspace, Investment, User                                                   | PG 18.7 structure verified |
| `investment_valuations`       | `InvestmentValuation`    | Workspace, Investment, User                                                   | PG 18.7 structure verified |
| `conversations`               | `Conversation`           | Workspace, User                                                               | PG 18.7 structure verified |
| `conversation_messages`       | `ConversationMessage`    | Workspace, Conversation                                                       | PG 18.7 structure verified |
| `ai_suggestions`              | `AiSuggestion`           | Workspace, ConversationMessage, User                                          | PG 18.7 structure verified |
| `automation_rules`            | `AutomationRule`         | Workspace, User, RecurringInvoiceRule                                         | PG 18.7 structure verified |
| `automation_runs`             | `AutomationRun`          | Workspace, AutomationRule, Invoice                                            | PG 18.7 structure verified |
| `notifications`               | `Notification`           | Workspace, User                                                               | PG 18.7 structure verified |
| `notification_preferences`    | `NotificationPreference` | Workspace, User                                                               | PG 18.7 structure verified |
| `activity_logs`               | `ActivityLog`            | Workspace, User                                                               | PG 18.7 structure verified |

## Workspace and currency isolation

Workspace-owned records have a direct workspace FK and unique `(id, workspace_id)` key. Child-domain foreign keys include workspace, preventing cross-tenant client/invoice, import/account, split/category, message/conversation and similar references. Currency-bearing parents additionally expose `(id, workspace_id, currency)` identities. Accounts, transactions, imports, invoices, payments, allocations, investment accounts/positions/movements/valuations and recurring templates/rules use compatible currency references where applicable.

Accounting currencies are deliberately AUD/EUR/USD, the supported two-decimal financial currencies. Workspace base currency accepts uppercase three-letter preferences without converting any account. Client default currency is a default, not the historical invoice currency: changing it does not rewrite prior invoices. No exchange rates, FX conversions or monetary FLOAT/REAL fields exist.

Actor/creator/recipient IDs reference individual users. An FK proves identity existence, not active membership or permission at the event time. Historical authors and recipients survive revoked membership. Polymorphic activity/notification/AI target IDs and import JSON candidate IDs must be resolved and authorized in future services. PostgreSQL foreign keys do not prevent unauthorized SELECTs; there is no production authorization or RLS policy in this block.

## Exact financial representation

Amounts ending `Minor` are BIGINT cents, signed for cash transactions and nonnegative/positive as appropriate for totals/allocations. Serialize BigInt as base-10 strings, never raw JSON BigInt or unconditional Number casts. Future browser adapters may convert only after explicit safe-integer and supported-currency checks. Decimal quantities/prices serialize as decimal strings, preserving scale; no exponential or binary floating-point conversion is required.

Invoice quantity and unit price use NUMERIC(18,4); tax rate NUMERIC(8,4), bounded 0–100%. Line base is half-up rounded `quantity * unit_price * 100`. Tax is half-up rounded after line discount. Line discounts cannot exceed base. Header totals must reconcile exactly to items at commit. The future service must apply Block 7's proportional, bounded backward discount allocation; SQL verifies resulting amounts and rounding but does not choose how the discount is distributed.

Investment quantities/prices use NUMERIC(18,8), retaining eight fractional places (at most ten integer digits). This bound can be lower than permissive frontend input limits; the future API must validate it explicitly. Movements preserve date/sequence, fees, soft correction history and actor; valuations preserve date/currency and position signature. Weighted-average cost basis, oversell/history replay, asset-type rules, correction permissions and signature comparability remain future transactional service responsibilities. A valuation never creates a cash transaction.

## SQL-only constraints and transaction boundaries

`202611170001_initial/migration.sql` contains the Prisma-generated tables/enums/indexes/FKs followed by reviewed PostgreSQL additions, wrapped in BEGIN/COMMIT. Do not regenerate it from schema alone and discard these additions.

Row CHECK constraints cover normalized lowercase/trimmed identity email, SHA-256-format session/reset/invitation hashes and expiry ordering, active-user credential presence, membership/invitation lifecycle, non-owner invitations, supported currency codes, file size, import bounds/JSON shape, signed cash types, source row identity, duplicate self-links, split positivity, category kind/rule field/priority, client terms, invoice date/totals/cancellation, item precision/rounding, payment/allocations positivity, confirmed receipt linkage, movement amounts/fees, valuation source/amount, run dates and notification read state.

Partial unique indexes enforce one pending invitation per workspace/email, one active owner role per workspace and global notification preference uniqueness when workspace_id is NULL. Ordinary unique constraints cover membership pairs, invoice numbers per workspace, one payment per transaction, payment/invoice allocation pairs, source account/system/reference identities, batch/row identities, import operation IDs, investment sequence, automation occurrence/operation IDs and invoice template occurrences. Date/description/amount fingerprints are **not** unique: legitimate duplicate-looking transactions and explicit Keep Both remain representable.

Deferred constraint triggers validate final transaction state for:

- Invoice item sums against all four header amounts; issued invoices require positive totals and items.
- Issued-invoice/confirmed-payment allocation eligibility; aggregate allocations cannot exceed either invoice total or payment amount.
- Confirmed payment's linked transaction being an unexcluded matching income receipt with the same amount and date. Composite FKs independently enforce scope/currency.
- Imported transaction account matching the batch account, including later batch remapping.
- Expense splits: at least two positive children totaling the parent's magnitude, with expense categories.
- Transfer pairs: opposite amounts, distinct accounts, transfer types, compatible exclusion state and no transaction reused on either side.
- Workspace owner pointer retaining its active owner membership, allowing workspace and membership creation in the same transaction.

`ef_financial_fence` increments a workspace integrity version before financial, category, batch and membership changes. This is intended to serialize mutations within that workspace; a real row update also produces conflicts for stale repeatable-read/serializable snapshots. The deferred checks examine the final state so valid invoice/items and split replacement can commit together. Trigger functions use a fixed search path. Live PostgreSQL 18.7 tests verified actual-commit rejection and concurrent allocation conflicts on distinct backend connections at ReadCommitted and Serializable: exactly one competing allocation committed and the aggregate stayed within the invoice limit. This is scoped evidence for the tested invariant, not exhaustive proof of every concurrent workflow.

Workspace-wide serialization and aggregate scans favor correctness for V1 over throughput. Future services must use bounded transactions, lock in stable order, retry deadlock/serialization failures safely with idempotency and revalidate permission. Benchmark before increasing data volume; do not remove the fence without an equivalent concurrency proof. No claim is made that this approach alone enforces immutable finalized documents, authenticated actors, reviewed import decisions or investment cost basis.

## Lifecycle and retention

No accounting parent cascades deletion into history. Archive clients/categories/accounts/investments/workspaces and revoke memberships; retain invoice snapshots and historical relationships. Cancel invoices only through a validated correction flow; allocations already prevent cancelling a paid document under the deferred checks. Draft item replacement may delete rows within a reconciled transaction. Financial corrections, invoice finalization locks, transaction source immutability and append-only audit permissions still need server enforcement. Activity logs are application history, not a tamper-proof audit system.

All FK delete/update actions are RESTRICT; isolated leaf deletion is structurally possible and must be restricted by the eventual service/database role. User erasure must reconcile retention obligations rather than cascade through financial records. Retention periods, encryption, backup/PITR and restore exercises require deployment decisions; no production database or backups exist here.

## Index rationale and remaining decisions

Indexes support workspace/date lists, account/date filtering, invoice client/lifecycle/due-date review, scoped FK joins, category rule priority, investment date/sequence history, latest valuations, automation due queues and recipient/workspace/read-state notifications. Composite uniqueness may overlap some generic FK indexes; retain the current safe baseline until real query plans identify redundant indexes. No production query benchmark or EXPLAIN result is claimed.

Before API implementation, agree finalization/correction policy, structured import JSON validation/versioning, exact calendar recurrence and timezone/DST semantics, supported currency expansion, invitation verification, activity retention and attachment storage. The older fixed-day template workflow and calendar-aware Settings workflow must not silently become competing schedulers. No queue, delivery worker, bank/brokerage connection, AI service or production endpoint has been added.
