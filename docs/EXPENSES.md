# Expenses and statement review — Block 4

Validated 11 November 2026 (Australia/Sydney). F12–F15 extend the existing React shell and session financial store. No database schema, financial HTTP endpoint, dependency, external service or persistence was added.

## Routes and working controls

| Screen                        | Route                    | Behavior                                                                                                                                                                                                                                    |
| ----------------------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F12 Expense Overview          | `/expenses`              | Shared period/account/currency/participant/category filters, KPIs, daily trend and accessible data table, category distribution, recurrence suggestions, review links, recent transactions, add expense, loading/empty/partial/error states |
| F13 Statement Import & Review | `/expenses/import`       | File selection/drop/removal, account/currency/date/format selection, real CSV parsing and column mapping, row edits and keep/exclude decisions, duplicate review, explicit confirmation, import summary and recoverable batch exclusion     |
| F14 Transactions & Details    | `/expenses/transactions` | Combined search/filter/pagination, selection, CSV export, add/edit, source and audit details, splits, explicit transfer classification/pairing, duplicate decisions, exclusion/restoration and protected invoice links                      |
| F15 Categories & Rules        | `/expenses/categories`   | Category create/edit/archive/search, historical category retention, rule create/edit/priority/enable/disable/delete, simulator, conflict preview and explicit application to eligible records                                               |

Transaction details use `?id=...`; `?add=1&type=income` prefills income entry. Home, Dashboard and Income links open these implemented routes. Future-module navigation retains explicit unavailable feedback.

## Shared architecture

`features/finance/data/expenseFixture.js` extends the existing Income fixture. `features/expenses/expenseService.js` handles `expense:*` commands through the same `createFinancialStore` in `incomeService.js`. Commands validate a cloned snapshot and publish atomically. Home, Dashboard, Income and Expenses observe that snapshot; no page owns a separate ledger. Invalid bulk operations leave the snapshot untouched.

The fixture contains transaction source/review metadata, splits, import batches, attachment metadata, category rules, transfer pairs and audit events. IDs remain stable. Session teardown/reload resets demonstration changes. Workspace, account, currency and participant filters reuse Block 2 context; command validation rejects cross-workspace/currency writes and viewer edits. These frontend controls are not production authorization.

## Financial rules

- Amounts are signed integer cents. CSV/manual decimal strings are parsed deterministically with BigInt before safe integer conversion; more than two decimal places are rejected. Expenses use negative amounts; income uses positive amounts. Display averages/percentages do not change the ledger.
- Totals include confirmed, non-excluded transactions. Transfers affect account movement but are excluded from income and expense totals. Explicitly pairing existing opposite same-currency account movements creates no extra transaction.
- Splits require at least two positive amounts whose exact sum equals the parent expense magnitude. The parent remains the one cash movement; category reports use its children instead of counting parent plus children. Remove splits before changing the parent's amount.
- Exclusion is reversible and preserves source/history. Restoration reactivates the existing record. Import batch exclusion also preserves records and validates the entire batch first.
- An invoice is not income. Allocated invoice receipts cannot be excluded or have protected financial fields changed. Excluded receipts cannot be newly allocated. Imports create transactions, not invented invoice payments; later explicit allocation reuses an existing receipt without adding income.
- No currency conversion occurs. Account currency, workspace and invoice allocation currency must agree.
- Default October sample expenses are AUD 2,840.00 and received income AUD 7,250.00. The fixture covers 1 August–31 October 2026; edits/imports stay in that demonstration window. Comparisons use an explicitly dated equal-length preceding period and are unavailable when coverage is incomplete.

## Import and duplicate decisions

CSV supports UTF-8, BOM, quoted/escaped fields, embedded newlines, comma/semicolon/tab delimiters, signed amount or separate debit/credit columns, explicit ISO/DMY/MDY dates and dot/comma decimal formats. Files are limited to 2 MB and 500 data rows. Missing/ambiguous columns, malformed rows, invalid dates, currencies or amounts produce errors before ledger confirmation.

Raw rows and original date, description and amount are retained alongside reviewed fields. The batch stores filename, MIME, size, SHA-256 metadata, decisions and accepted/excluded counts. File bytes are read locally; no upload occurs. PDF selection validates the signature but explicitly reports that extraction/OCR is unavailable. It never fabricates PDF transactions.

Fingerprints use workspace, account, currency and original date/amount/normalized description; matching references also flag candidates. Existing-ledger and within-batch matches require an explicit duplicate decision. Keep Both is a deliberate exception for distinct legitimate transactions, not automatic deduplication. An import token prevents confirming the same batch twice. Reimporting a file creates a new review with duplicate candidates; excluded rows never enter totals. CSV export produces a real escaped file and neutralizes spreadsheet formula prefixes.

## Categories, rules and review

Archiving categories retains IDs and historical assignments. Rules match normalized description, merchant or reference using contains/equals/starts-with. Lower priority number wins, then stable rule ID. Conflicting matches are visible. Saving or testing a rule does not rewrite transactions. Explicit application rechecks eligibility and protects manual classifications, reviewed records and split parents. Preview covers active transactions in the selected workspace/currency; its scope is broader than the period/account reporting filters.

Recurrence is a predefined pattern suggestion with frequency and expected date, not a scheduled charge, payment or background job. There is no AI classification, live banking, receipt storage service, automatic payment or production reconciliation.

## Dialog regression

The interrupted implementation guarded native close with `if (open) onClose()`. This prevented a second notification after React committed `open=false`, but a regression test demonstrated duplicate notification before that commit. `AppDialog` now gates all close requests with a synchronous ref, resets the gate when opening, prevents Escape's default independent native close, and stops cancel/close propagation. A native close event is ignored when the DOM dialog is already open again, protecting against an older queued event. Closing through the controlled state still invokes native `dialog.close()` for focus/modal cleanup.

Six component tests cover button close followed by native close, Escape, native-only close, a delayed parent update, reopening and stale native events. Browser tests exercise Escape/reopening and closing transaction details followed by search. Synchronization waits for the dialog to be absent and verifies the search value; no arbitrary delays or removed assertions were introduced.

## Validation and boundaries

`npm run check` passed: ESLint, Prettier, 103 Vitest/component/service/API tests and production build. All 26 Chromium Playwright tests passed (13 per viewport), including the 18 earlier-module regressions. API health returned `{"status":"ok","service":"easyfinance-api"}`. Dependency tree validation passed and all 49 authoritative asset hashes match. See [visual review](design/BLOCK4_VISUAL_REVIEW.md) for eight principal layouts and deliberate differences.

The build emits a non-fatal 500 kB chunk warning (main JavaScript approximately 551 kB minified). CI, other browser engines, real devices, production authorization and persistent/API concurrency were not exercised. Future API work must preserve atomic commands, source/audit data, scoped authorization, idempotency and allocation constraints. Block 5 was not started.
