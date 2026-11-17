# Block 2 — Home assistant and financial dashboard

Implemented 6 November 2026. Frontend-only, deterministic, fictional data. No AI provider, bank connection, database or financial API was added. Run `npm run dev`, sign in with the credentials in AUTHENTICATION.md, then use Home `/` and Dashboard `/dashboard`. The prior health/foundation view remains at `/development`.

## Working behavior

Home includes a personalized welcome, six suggested questions, multi-turn conversations, Enter/send and Shift+Enter, session history with search/open/new/rename/delete confirmation, loading/error/retry, and unsupported-question guidance. `/demo-error` deliberately fails once; Retry produces a sample spending answer. Each response stores its calculation snapshot and identifies its period, currency, account, participant and source. Changing filters affects subsequent responses, not historical messages.

CSV/PDF selection validates extension and a 10 MB size limit. Only the filename is retained, with remove support; contents are never read, uploaded or analyzed. Suggestion dismissal only hides that suggestion in the current message. Review opens an explicit unavailable dialog; no categorization or financial mutation is performed.

Dashboard includes period, account, native currency and participant filters; four KPIs; cash-flow, category and account-balance charts; accessible chart tables; calculated insights; review counts; and six most recent movements. Desktop and mobile workspace selectors scope both screens. Switching workspace starts a fresh active conversation and displays that workspace's own history.

The Demo data state filter exposes normal, partial (through 18 October), empty, and failed loads. Retry returns to the normal sample. Initial fetches show loading. August has no activity with a valid opening balance; the empty workspace has zero balances. Participant balances and incomplete balances are explicitly unavailable. No currency conversion is performed. Onboarding currency preferences remain profile preferences: the sample ledger defaults explicitly to AUD, regardless of the preferred currency.

Export, share, notifications, settings, import, new financial records, invoice/investment actions, review and transaction details have truthful informational dialogs. Income, Expenses and Investments are future modules, not fabricated pages. Signing out or refreshing clears conversations and the simulated session. No browser storage is used.

## Data and financial conventions

`features/finance/data/financialData.js` is the one fixture for accounts, participants, categories, invoices and transactions. All amounts use integer minor units; ISO dates are validated against actual UTC calendar dates. Only valid, scoped, correctly signed income/expense movements enter the calculation. Transfers affect account balances but never income, expenses or savings. A transfer pair cancels at the combined account level. Suspected duplicates remain included until reviewed, and unknown categories map to Uncategorized.

`data/calculations.js` provides shared filtering, income, expenses, savings, equal-length previous periods, category grouping, daily balances and chart buckets. `assistant/assistantService.js` calls the exact same `summarize` function as Dashboard. No separate AI totals are hardcoded.

Default: personal workspace, October 2026, all AUD accounts, all participants.

| Measure                          |        Result |
| -------------------------------- | ------------: |
| Income                           |  AUD 7,250.00 |
| Expenses                         |  AUD 2,840.00 |
| Net cash flow                    |  AUD 4,410.00 |
| Savings rate                     |         60.8% |
| Opening balance on 1 October     | AUD 10,000.00 |
| Closing balance on 31 October    | AUD 14,410.00 |
| Unpaid/partial invoice remainder |  AUD 4,650.00 |

Net cash flow is income minus expenses; it is not account balance. Savings divides net cash flow by income, with unavailable for zero income and valid negative values when expenses exceed income. Account balances add explicit opening balances to all signed account movements. Participant attribution cannot allocate account-level opening balances, so those balances are unavailable.

October compares with 31 August–30 September: both periods contain 31 days. Comparison requires full coverage of both periods and a positive prior denominator. The dated label makes this distinct from a calendar-month comparison. Charts aggregate consecutive seven-day groups, with a shorter final group. Category cents reconcile exactly to expenses; displayed percentages may round.

Invoices represent a status snapshot as of 31 October 2026 and are scoped by issue date. Paid/partial/unpaid status is separate from cash receipts. The paid portions already exist as income transactions; the outstanding amounts are never added to income. Partial data has incomplete totals and unavailable balance/comparison; it is not a forecast.

## Architecture and components

- `WorkspaceProvider` / `WorkspaceContext`: authenticated session state, shared filters, conversations and TanStack Query ledger loading.
- `AppShell`, `AppDialog`, `AppIcon`: shared navigation, mobile drawer, profile/sign-out, informative dialogs and SVG icons.
- `HomePage`, `ConversationHistory`, `ChatComposer`, `AssistantResponse`: assistant UI and interaction state.
- `DashboardPage`, `FinancialFilters`, `KpiCards`, `CashFlowChart`, `CategoryChart`, `InsightsAndReviews`, `RecentTransactions`: presentation of shared summaries.
- Reused Block 1 auth service/hooks/guards, Router/Query provider setup, official logo, base style tokens and dialog/button styling. No new dependencies.

The mock service boundary can later be replaced by an authenticated API; production integration must enforce permissions server-side and supply authoritative opening balances, transaction coverage, invoice statuses and currency rules. The assistant is a keyword-routed calculator, not a general language model. No database schema or backend contract is claimed.

## Verification

`npm run check`: ESLint, Prettier, 37 Vitest/component/API tests and production build pass. `npm ls --depth=0` passes with the existing pinned dependency tree. Browser and visual results are recorded in design/BLOCK2_VISUAL_REVIEW.md. Block 1 auth service and page sources are unchanged; only routing and destination assertions were adapted. All 49 authoritative assets retain their manifest hashes. Block 1 visual review is unchanged.
