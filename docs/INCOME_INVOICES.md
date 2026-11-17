# Block 3 — Income & Invoice Management

Implemented 7 November 2026 (Australia/Sydney). This is a session-only frontend demonstration. It extends the existing authenticated application and fictional financial ledger. No database schema, financial API, email provider, bank connection, payment processor or background job was added.

## Screens and routes

| Screen                  | Route                                               | Working behavior                                                                                                                                                                           |
| ----------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| F07 Income Overview     | `/income`                                           | Received/billed/outstanding/overdue KPIs, period/account/currency/participant/client filters, trend, income sources, invoice pipeline, recent receipts, loading/empty/partial/error states |
| F08 Invoice List        | `/income/invoices`                                  | Combined search/status/client/period filters, five-row pagination, selection and actual CSV download, invoice actions                                                                      |
| F09 Create/Edit Invoice | `/income/invoices/new`, `/income/invoices/:id/edit` | Labeled item editor, decimal calculations, client prefill/add, live preview, save draft, recipient preparation, unsaved-change protection                                                  |
| F10 Invoice Details     | `/income/invoices/:id`                              | Document, client snapshot, totals, payment history, bank-match review, timeline, print/PDF path and status-aware actions                                                                   |
| F11 Clients & Employers | `/income/clients`                                   | Add/edit/view/search/type/status filters, billing totals, archive, prefilled invoices, recurring review templates                                                                          |

Income navigation is integrated into the existing sidebar and mobile navigation. Home’s Create Invoice action opens the editor. Dashboard invoice actions open the list or the relevant reconciliation invoice; income links open F07. Existing Home, Dashboard, auth and development routes remain intact.

Run `npm run dev` and sign in with the credentials in AUTHENTICATION.md. Sample date stays fixed at **31 October 2026**, matching Block 2 coverage. New invoice issue dates and new payment dates must be within 1 August–31 October 2026. Due dates may extend beyond coverage. The actual review date above is not the simulated accounting date.

## One shared financial source

`financialData.js` remains the seed entry point. `incomeFixture.js` extends its accounts, clients, invoices and transactions with invoice items, confirmed payments, allocations, delivery records, bank-match suggestions and events. Draft and cancelled documents demonstrate list states without changing original billed/received balances. Recurring rules start empty and become shared session records when created.

`WorkspaceProvider` owns one `createFinancialStore` instance per mounted authenticated session. `useSyncExternalStore` distributes immutable snapshots after synchronous, validated commands. TanStack Query continues to represent initial loading and demonstration failure states. Both Home and Dashboard receive the current snapshot through their existing ledger interface. Historical chat responses remain labeled snapshots; a new question uses current totals. Signing out/reloading creates a fresh session. No localStorage, sessionStorage, cookies or database persistence is introduced.

`incomeService.js` validates workspace and role context, applies commands to an isolated copy, and publishes only a successful result. Payment, allocation, transaction and invoice changes become visible together. Failed validation cannot partially update the store. The role defaults to owner because the existing auth fixture has no membership role; owner/editor are allowed to write, viewer/unknown roles are denied. This is a mock boundary, not production authorization. Empty/partial/error scenarios do not permit editing.

The Router entry uses `createBrowserRouter` with the existing App routes so the editor can use React Router’s navigation blocker. Unsaved forms block in-app navigation and browser back; reload uses `beforeunload`. Workspace changes and sign-out ask before discarding a dirty invoice. See [official useBlocker documentation](https://reactrouter.com/api/hooks/useBlocker).

## Invoice lifecycle

The stored lifecycle is `draft`, `issued`, or `cancelled`. Display status is derived in this order:

1. Cancelled or Draft lifecycle.
2. Paid when the full total is allocated.
3. Overdue when an unpaid issued invoice is past its due date at the sample date.
4. Partially Paid when an issued invoice has a positive allocation and is not overdue.
5. Sent only for a predefined historical mock delivery; otherwise Prepared / not sent.

Overdue is a subset of outstanding, never an additional balance. A partial invoice can be overdue; the canonical badge is then Overdue, while received/outstanding values retain the partial-payment facts.

Only drafts can be edited. Recipient confirmation finalizes a valid positive-total draft as issued, records a preparation event and locks editing. It does not transmit anything. Paid records cannot silently become drafts. Duplicate creates a new numbered draft and copies items, not payments, allocations, delivery history or bank matches. Numbers are unique within a workspace. Cancellation requires UI confirmation and is permitted only without allocations; refunds/corrective invoices are outside this block.

Invoices capture client billing details. Editing or archiving a client does not rewrite old documents. Archiving preserves invoices and payments and prevents new preparation requests for that client.

## Decimal and reporting rules

Quantities, unit prices and per-item percentage tax rates accept non-negative decimal strings with up to four fractional digits. Quantity must be positive. Tax is configurable from 0–100%, default zero; there is no automatic GST or inferred registration. Monetary discounts/payments accept at most two decimal places for the supported AUD/EUR currencies.

Calculation uses scaled BigInt arithmetic rather than multiplying binary floating-point values:

- Each quantity × unit price is rounded half-up to cents.
- A fixed discount cannot exceed the subtotal. It is distributed proportionally across rounded line bases; intermediate allocations round down and the final line receives the exact residual.
- Tax applies to each discounted line and rounds half-up to cents.
- Total = rounded subtotal − discount + sum of rounded taxes.
- Output monetary amounts remain safe integer cents with a bounded demo maximum. Discount input strings remain separate from derived discount cents during refresh.

Income Overview uses confirmed income transactions by payment date for Received. Every confirmed payment has exactly one income transaction; adding their amounts together would double count, so only transactions are summed. Invoiced uses eligible issued invoices by issue date. Outstanding is their total less allocated receipts, excluding drafts/cancelled invoices. Overdue uses the fixed sample date and due date. Invoice List Paid is allocations against the selected issue-period invoices, not all cash received during that period. Client totals use all invoice issue dates in the selected native currency and workspace. Search/status narrow list rows; KPI scope is explicitly period/account/currency/participant/client.

Default October AUD values remain compatible with Block 2:

| Metric                               |       Amount |
| ------------------------------------ | -----------: |
| Received income                      | AUD 7,250.00 |
| Finalized invoiced                   | AUD 7,000.00 |
| Allocated receipts on those invoices | AUD 2,350.00 |
| Outstanding                          | AUD 4,650.00 |
| Overdue subset                       | AUD 4,650.00 |

Other employment receipts explain why received income differs from invoiced or allocated amounts. Internal transfers remain excluded. EUR is isolated; no conversion exists. Account opening balances and Dashboard cash-flow calculations are preserved.

## Payments and reconciliation

Record Payment supports positive partial/full amounts, date, method, reference and an optional existing income transaction. Overpayments require an unsupported adjustment workflow and are rejected. New payments create one payment, one income transaction and one allocation, updating the invoice and shared Home/Dashboard totals.

Existing-transaction links preserve the receipt’s original date, account and currency. No new transaction is generated. A payment can have allocations to several invoices, but each payment/invoice pair is unique and aggregate allocations cannot exceed available money. Allocations cannot exceed the invoice remainder. Foreign-workspace, foreign-currency and transfer transactions are rejected. Older receipts can be reviewed as advances; their original income period is not rewritten.

The seeded bank suggestion proposes the unallocated September Acme receipt against its October invoice. Its earlier date and partial amount are explicitly displayed; it is a suggestion, not an automatic match. Review opens a confirmation dialog. Confirmation uses the same allocation validation as Record Payment; dismissal only updates review state. Confirmed/dismissed suggestions cannot be reconfirmed. Activity events come from fixture history or successful operations.

## Clients and recurring preparation

Clients support individual/business types, name, business name, email, phone, address, optional jurisdiction-specific tax identifier, default currency, payment terms and notes. Name/type are required, business name is required for businesses, and any supplied email must be valid. Email may be blank during client creation, matching the blueprint; preparation always requires a valid recipient. Tax identifiers are never verified or assumed Australian.

Creating an invoice from a client prefills currency and terms and chooses a compatible workspace account. Invoice currency must match the selected client default and receiving account. Client changes do not retroactively convert historical invoices.

Recurring templates store name, client, items, currency, terms, frequency and next preparation date. Save creates only a review rule. Prepare Draft Now is enabled only when due at the sample date, produces one draft per cycle, and advances the review date. Weekly/monthly/quarterly demo intervals are explicitly 7/30/90 days; calendar-aware scheduling is a future integration. No email or revenue is generated and no timer runs in the background.

## Documents and delivery limits

InvoicePreview uses the actual invoice items, captured billing data, dates, discount, tax, totals and allocations. Print / Save PDF opens a document preview and the browser print dialog; users choose Save as PDF. This is a working print path, not a one-click binary PDF generator or a claimed completed download. Print styling isolates a document clone from navigation, dialogs and application height. CSV selection export creates a real file with escaping and spreadsheet-formula neutralization.

Prepare Send / Prepare Resend confirms the recipient and records `prepared-not-sent`. Only predefined delivery records carry a historical mock label. No real sent/read/opened event or external provider status is invented. Import Statement, Add Income, transaction details, external reminders and other future modules provide explicit unavailable feedback.

## Future integration

Replace the in-memory command boundary with authenticated server operations, enforce workspace permissions server-side, and persist atomic allocation/transaction updates with uniqueness and idempotency constraints. Supply authoritative date coverage, invoice lifecycle/correction rules, tax jurisdiction/configuration and currency precision. Add a real document renderer, delivery provider, reconciliation review API and calendar-aware background scheduler only in their authorized blocks. No Prisma model or migration is implied by these JavaScript records.

See design/BLOCK3_VISUAL_REVIEW.md for references, ten target screenshots, executed verification and provisional visual choices. Earlier block documentation remains a historical record rather than being rewritten.
