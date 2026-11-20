# Block 9B.2 — persistent CSV import and reconciliation

20 November 2026 (Australia/Sydney). Continued `feat/backend-9b2` from `074f2ba`, preserving completed Blocks 0–9B.1. No schema migration, seed/reset, dependencies, bank integration or Block 9B.3 work.

## Architecture and API

The existing `/api/v1/workspaces/:wid` router adds import controllers, strict request validation, a transaction service and scoped repository. The original CSV parser is now browser/server shared in `packages/shared/src/statementCsv.js`; the demo module re-exports it, preserving existing behavior. React API mode uses `PersistentImport.jsx` at the existing `/expenses/import` route. Demo mode still uses the original screen/service.

| Method | Workspace-relative route     | Behavior                                                                                                      |
| ------ | ---------------------------- | ------------------------------------------------------------------------------------------------------------- |
| POST   | `/imports/preview`           | Parse source, validate account, normalize rows, report row errors and possible matches; no database writes    |
| POST   | `/imports`                   | Explicit confirmation, UUID idempotency key, preview hash and one decision per source row; atomic persistence |
| GET    | `/imports`                   | Latest 50 scoped confirmed batches and result counts                                                          |
| GET    | `/imports/:id`               | Scoped batch result and retained decisions                                                                    |
| PATCH  | `/transactions/:id/category` | Versioned category-only assignment/clear; no financial-field updates                                          |

Models used: ImportBatch, Transaction, Category, FinancialAccount and ActivityLog, with existing User/AuthSession/Workspace/WorkspaceMember authorization. Payment, PaymentAllocation, TransactionSplit and TransactionTransfer remain protected by existing services and SQL constraints. No new table, applied migration edit or seed change is needed.

## Formats and validation

UTF-8 CSV supports BOM, quoted/escaped fields and embedded newlines; comma, semicolon or tab delimiters; explicit ISO/DMY/MDY dates; dot/comma decimal formats with validated thousands separators; signed Amount OR separate nonnegative Debit/Credit columns. Required date/description/amount mappings must be unambiguous. No bank-specific format is inferred. Currency must match the active selected account; no conversion occurs.

Server limit: 2 MB CSV and 500 data rows. Import-only JSON transport is capped at 6 MB for escaped text; other API bodies retain 100 kB. The selected account's review set is capped at 10,000 ledger records and 100 candidates per row; excess is rejected rather than silently truncated. Parsing never executes content. Descriptions/references and option/mapping shapes are validated server-side. Invalid rows return row-specific errors and can only be explicitly excluded; repair their source CSV to import them. Zero values, invalid dates, excessive precision, incorrect signs, both nonzero debit/credit and wrong currencies are rejected. Amounts use deterministic BigInt parsing and bounded safe-integer minor units, then PostgreSQL BigInt storage and decimal-string API ledger serialization.

## Preview, confirmation and retries

Preview reads within the existing authenticated workspace transaction and performs no inserts/updates. Its hash covers raw source/options and the current normalized candidate set, including versions. Confirmation reparses the source and rechecks account, categories, membership and candidates under the existing workspace lock. A changed review yields 409 and requires a fresh preview. The hash is a consistency check, not an authorization token; every value is validated again.

Each source row requires keep, exclude, Keep Both, or match. The confirmation button is explicit user approval. Invalid rows must be excluded. All accepted rows, the confirmed batch, source rows, decisions and activity event commit in one transaction. Excluded and matched rows remain in review metadata but create no cash entries. Any failure rolls the whole command back. No partially completed batch is reported as successful.

A workspace-wide UUID key records a normalized source/decision/actor fingerprint. Identical retries return the same batch even after later ledger changes. Changed input with the same key conflicts. Independent connections serialize through the workspace lock: identical concurrent keys return one result; competing new keys with the same stale preview cannot both import without review. Original deferred SQL financial checks remain enabled.

## Duplicate review and reconciliation

A same-account/currency transaction is a possible candidate when its current signed amount/date matches or its exact source reference matches. A same-day equal amount alone is never automatically declared a duplicate. Description is supporting review evidence. Within-file candidates use normalized description plus amount/date, or a repeated reference. Excluded records remain visible as candidates but cannot be reused as confirmed matches.

Use existing transaction requires a specific, non-excluded candidate with the same account/currency/date/amount. It records the decision without modifying that transaction, invoice allocation, payment, transfer or balance. It does not create a Payment. Existing invoice receipts and paired transfers can therefore be reviewed without duplicate cash. It is reconciliation evidence in the batch, not a live bank reconciliation assertion.

Keep Both explicitly means distinct legitimate activity despite a candidate. The original reference and candidate IDs remain recorded. The new transaction uses a null source-system namespace for this deliberate exception to the account/system/reference unique index; ordinary imported references use `csv-v1`. There is no automatic overwrite, merge, refund or reversal. Imported rows otherwise remain signed income/expense; new transfer pairing is not implemented here. Exclude unidentified internal transfers until a supported pairing workflow is available. Category changes never turn an income/expense into a transfer.

## Categorization, authorization and security

Owner/Editor can preview, confirm and categorize. Viewer can read batch history and transactions but cannot mutate. Real server sessions and active database memberships authorize every operation; browser mock identity cannot authorize persisted records. Cross-workspace IDs are scoped/rejected. Existing origin/custom-header/JSON CSRF checks, HttpOnly session cookies, authentication rate limits and safe error mapping remain in force.

Category-only updates validate the active same-workspace category and transaction kind, check the current version, set manual override/review flags and increment the version. Amount, date, source and original fields are unchanged. Split parents, transfers and any payment-linked transaction are rejected; no split is flattened and no allocation is rewritten. Archived categories remain identifiable in historical data but cannot be newly assigned.

The guarded `database/scripts/import-runtime-grants.js` verified the approved loopback database and existing `easyfinance_9a_app` role, then added only SELECT/INSERT on import_batches. It granted no UPDATE/DELETE/DDL rights and changed no credentials/data/schema. Production RLS, distributed rate limiting, retention/encryption of retained statement rows, operational monitoring and large-account performance remain separate work. This is local development validation, not production security certification.

## Browser behavior and visual scope

The existing shell, fields, cards, import stepper, mapping and review conventions are reused. API mode supports file selection/drop/removal, mapping/options, row errors, duplicate review, explicit confirmation, results/history, persistent transaction category updates and reload. Repairing raw CSV replaces demo-only inline row edits; category/rule management, PDF/OCR, persistent attachment storage, batch reversal and new transfer pairing remain unavailable. History shows the latest 50 confirmed batches, not uploaded draft files.

Authoritative references remain the F13 desktop/mobile `5. Importar e revisar extrato bancário` SVGs and F14 `5. Lista e detalhes das transações` SVGs under `docs/design/frames/04-expenses/`, plus the preserved Block 4 visual review. The desktop/mobile F13 SVGs were rendered and visually compared with the implementation. The implemented CSV upload/review uses the established card adaptation, explicit mapping and duplicate decisions instead of the artwork's PDF/AI confidence claims and dense desktop table. Existing official runtime logo and shell take precedence over alternate export details. It does not claim pixel-perfect approval of the PDF artwork.

Runner artifacts are separated in `test-results/demo-runs/` and `test-results/api-runs/`. Block 9B.2 screenshots use `test-results/block9b2-layouts/`, preserving prior block captures. Desktop 1440×900 and mobile 390×844 workflows cover upload, duplicate review, confirmation, category dialog, refresh, repeated-file exclusion, workspace rejection and account reconciliation.

## Executed validation

| Check                                                | Executed result                                             |
| ---------------------------------------------------- | ----------------------------------------------------------- |
| Live API                                             | 72 passed: 49 preserved plus 23 import/categorization tests |
| Live database                                        | 31 passed                                                   |
| Offline database                                     | 14 passed                                                   |
| Vitest                                               | 220 passed in 14 files                                      |
| Demo Playwright                                      | 50 passed                                                   |
| Real API Playwright                                  | 6 passed, three workflows per viewport                      |
| ESLint / Prettier / default production build         | Passed via npm run check                                    |
| API-mode production build / dependency tree          | Passed                                                      |
| Prisma 7.10.1 validate / generate / migration status | Passed; one existing migration current                      |
| API health                                           | HTTP 200, status ok, service easyfinance-api                |
| Git whitespace / preservation                        | Passed                                                      |

No final tests failed or were skipped. Local-socket/browser/database commands required sandbox escalation. Live catalog verification confirmed PostgreSQL 18.7, 34 domain tables, 84 validated foreign keys, 60 CHECK constraints and 11 deferred triggers. Runtime import-batch INSERT is allowed; UPDATE/DELETE remain denied. Original schema, seed and migration bytes are identical to HEAD, and all 49 authoritative asset hashes match. The checked React development markers are absent from both production bundles. Configured connection/password values were absent from 27 changed files and 16 task logs at the final scan; .env remains ignored.

The new tests cover independent-connection conflicting imports, concurrent identical keys, repeat-file review, Keep Both, row exclusion, receipt reuse, unchanged transfer cash-flow totals, split protection, category version/conflict/archival checks, workspace/account/role isolation and a fault injected after ledger insertion that proves full rollback. The four earlier API browser workflows and all demo workflows remain intact.

Screenshots were inspected at 1440×900 and 390×844 for upload, review, completion, category dialog and account reconciliation. The mobile review decision/category controls were stacked to keep the full Keep Both label readable. The passing browser checks reported no horizontal overflow, missing images, page errors or unexpected console errors. The fictional test reconciles AUD 100 income less AUD 12.34 expenses to AUD 87.66; repeat-file exclusion leaves that balance unchanged. Full-page captures retain fixed navigation at its capture viewport position; content remains scrollable. Screenshots are under test-results/block9b2-layouts with desktop/mobile prefixes and matching viewport captures.

Block 9B.2 is complete for this approved local scope. CI, other browser engines, real devices and production deployment were not exercised. Nothing was staged or committed; Block 9B.3 was not started.

Initial validation found and fixed an incorrect shared-parser relative path, the activity log field (`metadataJson`), and a category control accidentally rendered outside the details dialog. The new browser locator was corrected to the existing accessible name “Close dialog”; no sleeps or removed assertions. Confirmed stale EasyFinance development servers were stopped with TERM to free test ports; unrelated applications were not terminated.
