# Investments — Block 5

Implemented and reviewed 15 November 2026 (Australia/Sydney). F16–F18 provide manual portfolio tracking inside the existing React application. This is session-only demonstration data, not trading, advice, tax reporting or a production financial service.

## Routes and controls

| Screen                           | Route                                       | Working behavior                                                                                                                                                                                                                                                                                                  |
| -------------------------------- | ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F16 Investment Dashboard         | `/investments`                              | Account/type/currency/reporting-period filters; value, remaining basis, unrealized difference and capital-addition KPIs; dated history; allocation; holdings search; observations; recent activity; Add Investment; Update Values; per-holding view/edit/value/contribution/withdrawal actions                    |
| F17 Add/Edit Investment          | `/investments/new`, `/investments/:id/edit` | Conditional quantity/principal fields; account/institution creation; optional ticker, tags and notes; fixed-precision preview; validation; save/navigation; unsaved-change confirmation; metadata editing without rewriting financial history                                                                     |
| F18 Investment Details & History | `/investments/:id`                          | Dated valuation and basis, quantity/average cost, realized/unrealized results, distributions, fees, nominal return; history chart/table; purchase/sale/contribution/withdrawal/dividend/interest/fee entry; valuation updates; filtered activity; confirmed correction/deletion with dependent-history validation |

Overview/Holdings/History links share the existing router and navigate to the dashboard or its sections. Sidebar, breadcrumb and mobile navigation use the existing shell. Home's Add Investment opens F17. Supported portfolio questions and the Financial Dashboard read the same selectors; historical chat messages retain their original snapshot.

## Architecture and model

`features/finance/data/investmentFixture.js` extends `financialData.js` with `investmentAccounts`, `investments`, `investmentMovements`, `investmentValuations` and `investmentEvents`. These are distinct portfolio records in the same session snapshot as cash transactions, invoices and allocations.

`features/investments/investmentMath.js` contains decimal parsing, dated replay, weighted-average basis, valuation comparability, allocation and reporting. `investmentService.js` validates `investment:*` commands through the existing `createFinancialStore`. It clones the snapshot, validates the complete proposed history, and publishes only on success. Failed commands cannot partially update other screens. Shared calendar validation was extracted to `finance/data/dates.js` and re-exported from the existing calculations module, avoiding a fixture/math import cycle without changing prior date behavior.

Stable IDs and ordering are assigned centrally. Account ownership, account currency, investment workspace, role and data-state restrictions are checked at the service boundary. Owner/editor may mutate; viewer/unknown roles cannot. These are simulated frontend permissions, not production authorization. Workspace changes cannot reveal another workspace's details. Reload/sign-out discards the session. No storage, database schema, migration, financial endpoint or dependency was added.

## Asset and account conventions

Stocks, ETFs and Cryptocurrency use quantity-based positions. Fixed Income, Other and Custom use principal-based positions; Custom requires a descriptive category. All permit an optional symbol. Accounts store institution, name, workspace and currency as manual metadata. Adding an account does not connect to a financial institution or create a bank account.

AUD, EUR and USD are supported with two monetary decimal places. No conversion exists. All-currencies reporting always suppresses combined KPIs/chart/allocation and shows per-currency subtotals, even when an additional filter leaves only one currency. Quantity and currency are never inferred from the user's location.

The reporting period supplies an as-of end date for position state and an interval for contributions and recent activity; holdings are not limited to assets purchased during that interval. Investment account/type filters narrow portfolio positions. Cash-account and participant filters do not allocate investment holdings; Home/Dashboard disclose that their investment summary covers all investment accounts in the selected workspace/currency.

## Fixed precision and cost basis

Quantities and unit prices are stored as decimal strings with at most eight fractional places, matching DB07. BigInt scaled arithmetic computes quantity × price and rounds **half-up once to integer cents**. Monetary amounts/fees accept at most two places. Blank values, exponential notation, invalid precision, negative values and excessive demo amounts are rejected. A positive quantity with a zero unit price is permitted for a genuinely zero-cost holding. Principal must be positive. A blank valuation is unknown; an explicit zero is a supported zero valuation.

Weighted-average cost basis is replayed in ascending movement date, then stable insertion order for same-day movements:

- Buy and quantity Contribution add units and rounded purchase amount plus fee to basis. Principal Contribution adds amount plus fee to basis.
- Sell disposes proportional basis, rounded half-up to cents. A full disposal consumes the exact remaining residual. Realized gain/loss = gross proceeds − sale fee − disposed basis.
- Quantity Withdrawal is explicitly an **in-kind withdrawal**. It removes proportional basis and units without recording realized profit or fictional sale proceeds.
- Principal Withdrawal reduces recorded principal/basis by the withdrawn amount; it is not profit. Amount cannot exceed the remaining basis. Principal assets do not expose quantity buy/sell operations.
- Dividend and Interest remain separate distributions, net of their entered fees. They do not alter holdings or unrealized appreciation.
- Standalone Fee records its amount once; its additional fee field must be zero. Withdrawal fees and standalone fees reduce nominal return separately and are assumed external to the remaining holding. Buy/contribution fees are capitalized; sell fees already reduce realized proceeds.

Average cost per unit is remaining basis divided by units, displayed to at most eight decimal places. Percentage change is unrealized difference divided by remaining basis; zero basis yields Unavailable. It is not annualized or a return on lifetime contributions.

Total nominal return, when a comparable current value exists, is realized gain/loss + unrealized gain/loss + net distributions − standalone/withdrawal fees. No money-weighted, time-weighted, compounded or tax return is calculated. The Contributions KPI includes buy/contribution amounts in the selected reporting interval, excludes fees, and is distinct from remaining capital after disposals.

## Valuations and history

Each valuation retains date, explicit currency, estimated value, manual source, actor, notes and the signature of capital-affecting movements at that date. The latest non-deleted valuation on/before the report date is used only when its signature matches the current dated position. A subsequent purchase, sale or withdrawal makes the old value unavailable until revalued. A backdated financial correction also invalidates affected comparable valuations. Distributions/standalone fees do not change the position signature.

Fully disposed positions have current value zero and retain history. A positive valuation for a closed position is rejected. Metadata editing changes name/account/tags/notes but preserves purchase dates, asset type, currency, movements and valuations. Value corrections append a new dated snapshot via Update Value; old valuations remain visible unless explicitly deleted.

Charts use actual movement/valuation dates on a proportional date axis, with step segments carrying a known value forward only while the position remains comparable. Unknown values create gaps. They never interpolate live prices. Exact values are available in accessible tables. Same-day points show end-of-day replay; the activity table preserves individual events. Allocation uses current values in one currency; rounded display percentages may differ from 100% by rounding, while underlying amounts reconcile exactly.

Edit/Delete Activity requires confirmation. Movements are revalidated against the complete subsequent history, so a purchase cannot be removed or reduced if a later sale would exceed holdings. Deleted records are retained with a marker, and before/after snapshots are recorded in `investmentEvents`. Valuation deletion restores the latest remaining comparable dated valuation. This in-memory trail is not a production audit log.

## Cash-ledger separation and integration

No investment command writes to `transactions`, `payments` or invoice `allocations`. Buying an asset, contributing capital, withdrawing, selling or changing a valuation cannot increase consumption expenses or salary income. Dividends/interest entered here remain portfolio-only records. There is no cash-linking UI in this block; if a distribution already exists in the cash ledger, recording its portfolio history does not add another receipt. Portfolio distributions must not be added to the operating-income total.

The Financial Dashboard displays a separate portfolio card; holdings are not added to bank cash balances. Home supports current portfolio value, remaining invested capital, largest holding/allocation and latest period capital addition from the shared selectors. Unsupported questions retain honest demo feedback. Prior invoice and expense allocation guards remain intact.

Default October AUD portfolio: five holdings, **AUD 22,090.00 value**, **AUD 20,000.00 remaining basis**, **AUD 2,090.00 unrealized gain**. Initial capital was recorded in August, so October Contributions is zero. The separate EUR holding has EUR 1,050.00 value. Cash remains AUD 7,250.00 income, AUD 2,840.00 expenses and AUD 14,410.00 bank balance. These coherent records replace inconsistent totals drawn in static artwork.

## Demonstration limits and future backend

The sample accounting date remains 31 October 2026 with entry dates from 1 August through 31 October; this is distinct from the implementation review date. Future dates are rejected. Loading/error/empty/partial states reuse the shared ledger scenarios. Partial reporting stops at coverageEnd and disallows mutation. No live prices, FX, broker connections, tax eligibility, background jobs, reinvestment automation, recommendations or investment-account cash subledger exist. Interest information is descriptive notes, not an accrual engine.

Future persistence must provide server-enforced workspace authorization, decimal storage, stable event ordering, atomic replay/corrections, audited soft deletion and valuation versioning. Any cash linkage needs explicit reconciliation, uniqueness and protection against later exclusion or incompatible invoice allocation. It must preserve the separation between investment performance and cash movement.

Validation results and the six responsive reference mappings are recorded in [Block 5 visual review](design/BLOCK5_VISUAL_REVIEW.md). The existing main bundle remains above Vite's 500 kB warning threshold; no dependency or unrelated build refactor was introduced.
