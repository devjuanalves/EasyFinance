# Block 5 visual and interaction review

Reviewed 15 November 2026 (Australia/Sydney). Earlier Block 1–4 reviews are preserved.

## Authoritative sources

The local `frames/05-investments/` exports were rendered and inspected before implementing the UI. No Figma MCP was configured. No replacement artwork was generated.

| Screen | Desktop reference                                         | Mobile reference                                           |
| ------ | --------------------------------------------------------- | ---------------------------------------------------------- |
| F16    | `6. Dashboard de investimentos-1.svg` — 1296×2353         | `6. Dashboard de investimentos.svg` — 406×1949             |
| F17    | `6. editar investimento-1.svg` — 1296×1522                | `6. editar investimento.svg` — 430×1253                    |
| F18    | `6. Detalhes e histórico de investimento.svg` — 1296×1525 | `6. Detalhes e histórico de investimento-1.svg` — 406×1691 |

Draw.io page 05, F16–F18 and DB00/DB06/DB07/DB10/DB11 supplied the functional and entity contract. DB07 explicitly supports eight-decimal quantity/unit price with two-decimal monetary amounts. No database implementation was introduced.

All six principal references exist. F17 exports are named Edit and contain mixed create/edit prototype states; create mode and unexported validation/dialog states use the same existing components provisionally. Exact outlined font identity remains unconfirmed.

## Implemented structure and differences

F16 retains the existing shell, Overview/Holdings/History navigation, action heading, compact filters, four tinted metrics, performance/allocation pair, observations, holdings and activity. F17 uses the reference's basic/position/valuation/notes sections and desktop summary column, stacking on mobile. F18 retains the asset heading/actions, four metrics, history chart/activity and a secondary metadata column. The established logo, palette, form styling, cards, native AppDialog, keyboard focus and mobile navigation are reused.

Deliberate deviations:

- The established application shell and official logo take precedence over alternate shell/logo artwork in these exports. Mobile retains the existing EasyFinance navigation rather than the unrelated Summary/Transfers/Budget tabs drawn in the F18 export.
- Fictional portfolio records reconcile to the ledger and movement model instead of reproducing inconsistent artwork totals. The five AUD holdings and separate EUR holding are generic samples; no investment recommendation is implied.
- Charts show dated carry-forward steps with point markers and gaps for unknown values. No smooth speculative price trajectory is fabricated. Charts have exact data tables; asset allocation is a desktop donut and mobile bar/list.
- Unsupported tax discounts, automated reinvestment, live sync, projected yield, broker connections, AI advice and reminders are omitted. Deterministic observations show allocation/valuation age and recorded capital instead.
- F17 edit mode locks currency/type and omits editable initial financial inputs to protect history. Corrections occur through explicit activity confirmation. Create mode offers conditional quantity or principal fields and optional valuation.
- F18 uses shared scrollable dialogs for activity entry instead of the static desktop inline form. Native confirmations protect correction/deletion. Audit snapshots and explicit financial definitions add vertical space. Tables become mobile cards; mobile values and actions remain readable without compressed desktop columns.
- No save-draft or artificial asynchronous saving state is claimed: validated session commands save synchronously. Account addition is manual metadata, not a bank connection.

These are compared responsive implementations, not claims of pixel-perfect visual approval. Separate dialogs/error-state exports and final typography remain outstanding design dependencies.

## Screenshots and accessibility

Playwright Chromium captures are ignored local artifacts in `test-results/block5-layouts/`. Each principal full-page image has a matching `-viewport.png` at the exact target size.

| Screen | 1440×900 desktop            | 390×844 mobile             |
| ------ | --------------------------- | -------------------------- |
| F16    | `desktop-f16-dashboard.png` | `mobile-f16-dashboard.png` |
| F17    | `desktop-f17-editor.png`    | `mobile-f17-editor.png`    |
| F18    | `desktop-f18-details.png`   | `mobile-f18-details.png`   |

Additional paired captures cover `edit-investment`, `purchase`, `sale`, `invalid-sale`, `valuation`, `dividend`, `interest` and `unsaved-confirmation`. All six principal captures were inspected against the rendered exports for hierarchy, shell, card spacing, form labels, monetary legibility, table/card wrapping and navigation. Interaction captures were inspected for usable modal scrolling and visible focus. Full-page images retain fixed navigation at its viewport position; content scrolls past it and has bottom clearance.

Native labels, explicit select names, semantic tables, chart tables, text-based performance labels, visible focus and modal semantics support keyboard/screen-reader use. Unsaved form navigation uses the existing router blocker and native beforeunload path; workspace/sign-out prompts identify investment edits. The Block 4 dialog implementation and its six tests are unchanged.

## Validation record

The first complete quality run passed 143 tests, lint, formatting and production build. The first eight new browser workflows exposed implicit-label exact-match ambiguity and a mobile navigation timing assumption. Explicit select accessible names and waiting for the destination heading resolved these without delays or removed assertions. The next new-workflow run passed all eight tests. A subsequent currency review added an all-currencies/single-denomination regression and refined the dated chart presentation.

Final complete run: **144 Vitest tests passed in 10 files; 34 Playwright tests passed (17 per viewport), including all 26 previous browser regressions.** ESLint, Prettier and production build passed. Browser error, image-loading and document-width assertions passed for both viewports. No CI, other browser engine, real device or production integration is claimed. API health returned HTTP 200 with `status: ok` and `service: easyfinance-api`. Local socket checks required sandbox escalation. Installed dependencies and all 49 authoritative asset hashes were checked; the original SVGs, logos and blueprint remain byte-identical. Build has a non-fatal 601.52 kB main-chunk size warning.

## Remaining limitations

Manual dated valuations, session-only state, fixed sample dates and explicit unsupported aggregation are intentional. Cash transaction linkage, live market feeds, advanced return methodologies, tax calculations and production audit/authorization remain deferred. No Settings/Collaboration implementation or Block 6 work was started. See [investment behavior and calculations](../INVESTMENTS.md).
