# Block 7 frontend audit

Completed 17 November 2026 (Australia/Sydney). This audit continues the existing Blocks 0–6 implementation; it does not authorize persistence, deployment or Block 8. Earlier block reports remain historical records. Demo financial dates remain August–October 2026, with an as-of date of 31 October.

## Scope and result

All F01–F21 screens were reviewed at desktop 1440×900 and mobile 390×844: 42 targets. Representative Dashboard, invoice editor, import, transactions, investment editor, sharing and automation pages were also checked at widths 320 and 768. See [visual evidence and limitations](design/BLOCK7_VISUAL_AUDIT.md). The existing design system, shell and source artwork were preserved.

## Findings

Severity means P0 critical, P1 high financial/access impact, P2 functional/security/performance issue, P3 documentation or polish. These are scoped audit findings, not a guarantee that no other defect exists.

| Priority | Finding                                                                                             | Resolution / evidence                                                                                                                                                         |
| -------- | --------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P0       | No critical defect reproduced in reviewed workflows                                                 | Production security remains outside this demo's guarantees                                                                                                                    |
| P1       | Invoice discount residual could exceed a free/small final line, making its taxable base negative    | Fixed with bounded backward residual distribution; regression reproduced before correction; zero-value, full-discount, mixed-tax and fractional-value cases pass              |
| P2       | CSV formula prefix protection missed leading whitespace; Income and Expenses duplicated the encoder | Shared `services/csvExport.js` neutralizes formula/control prefixes, escapes quotes and preserves strict negative decimal amounts and Unicode; internal records are unchanged |
| P2       | All protected modules loaded eagerly; main bundle 649.39 kB                                         | React.lazy protected routes and Suspense; lightweight auth kept eager to preserve immediate forms; final bundle measurements below                                            |
| P2       | Home Add Transaction and suggestion review stopped at stale unavailable feedback                    | Add Transaction opens the existing editor; suggestion dialog links to uncategorized review, with no automatic classification or financial mutation                            |
| P3       | Frame index and architecture still described implemented screens as absent                          | Current index, roadmap, progress and architecture synchronized; old block reviews preserved                                                                                   |

No unresolved reproduced P0/P1 defect remains in the audited frontend scope. Missing design approvals and future production controls are recorded below rather than represented as completed work.

## Financial integrity

One session store still owns financial records. Home and Dashboard read the same calculations used by module selectors. Commands validate and mutate a cloned snapshot before publication, avoiding partial updates on rejected operations. No second ledger or new persistence was introduced.

Invoice quantities, prices and tax rates use scaled decimal strings/BigInt. Line base rounds half-up to cents. Fixed discounts first receive floor-proportional shares; remaining cents are assigned from the last line backward, bounded by each remaining line base. Every allocated discount sums to the requested discount, no line base becomes negative, and line tax rounds half-up after discount. This clarifies the older Block 3 residual description. Fully discounted invoices produce zero total and zero tax. Zero-value lines receive no discount. Existing total limits and payment rules remain enforced.

Regression coverage confirms invoice issuance/draft preparation does not increase cash, partial/full allocation cannot overpay, and linking an existing bank transaction does not create a second receipt. Currency and workspace scope remain explicit; there is no FX conversion. Internal transfers stay neutral; excluded transactions are omitted; splits retain exact parent cents. Import previews are not ledger entries; confirmation checks duplicates, and Keep Both remains an explicit audited exception. Category rules do not overwrite manual categorization. Investment purchases and unrealized gains stay separate from consumption expense and received cash. Movement replay retains weighted-average basis, oversell protection and valuation invalidation. Automation occurrence/template checks prevent duplicate drafts on retry.

The new browser journey creates a client and a 200 AUD invoice, verifies cash remains 7,250 AUD, allocates a new 50 AUD receipt, checks 150 AUD outstanding and 7,300 AUD cash. It then creates a holding, purchases more, values and sells it: basis becomes 225 AUD, realized gain 50 AUD, the old valuation becomes incomparable, and cash remains unchanged by the unlinked investment operations.

## Executed journeys and regression coverage

- Registration → onboarding → Home → Dashboard; sign-out/reload ends the deliberately memory-only session.
- Client → invoice draft → preparation (no email) → partial receipt → outstanding and Dashboard reconciliation.
- Real CSV selection/mapping → edited category and duplicate review → confirmation → Dashboard/Expenses; repeat-import detection, exclusion and independent manual category/rule workflows.
- Investment creation → purchase → valuation → sale → basis/gain and cash separation.
- Invitation → simulated acceptance; member role change → Viewer restrictions → revoked access and hidden workspace data.
- Recurring rule → reviewed draft → retry without duplicate or cash receipt.
- Protected routes, missing invoice/investment, unknown route, browser back and refresh, mobile dialog close/search and focus return. Existing unsaved form protections remain covered.

The comprehensive route test uses browser history inside an existing session, while module workflows exercise visible links/buttons. Lazy-loading assertions wait for headings and fallback removal, not arbitrary sleeps. No loading loop was observed; perceptual fallback flicker under throttled networks was not measured.

## Architecture, security and accessibility

Auth remains a replaceable asynchronous mock, health uses the existing API client, and the financial store dispatches domain commands through shared services. React subscriptions update cross-module views. Shared native dialogs retain the Block 4 synchronous per-opening close guard; close button, Escape, native close and delayed-owner regression tests remain in place. New focus checks verify return to the opener after Escape and button closure.

Active membership scopes simulated actions and records; pending invitations grant no access, Viewer writes fail, Owner operations remain guarded and revoked membership hides data. These checks are not production authorization. The legacy fixture compatibility path without memberships must never become a server authorization fallback. Service coupling (including income/settings imports) and whole-snapshot cloning are acceptable for this bounded demonstration, but require separation and concurrency design before API replacement.

Untrusted descriptions render as React text. File import is bounded, CSV parsing is explicit, PDF/OCR remains unavailable, and attachments do not imply persistent storage. No real secrets or server configuration were added to the browser. Demo credentials are public fixtures. CSV output quotes cells, doubles embedded quotes, uses BOM/CRLF and prefixes risky text with an apostrophe, including whitespace-prefixed formulas. Strict negative decimal literals remain numbers. Byte-level regression tests cover formula/control prefixes, quotes, delimiters, newlines and Unicode; Excel/LibreOffice execution was not tested, so universal spreadsheet application behavior is not claimed.

Labels, semantic headings/tables, chart data tables, text statuses, keyboard buttons, visible focus and native modal focus behavior were reviewed and browser-tested where covered. Browser checks assert no document overflow, missing images, page errors or console errors across principal routes. This is not a formal WCAG certification or screen-reader/contrast audit. Other browser engines and real devices remain untested.

## Validation and performance

Final validation completed successfully. Historical Block 6 baseline: 196 Vitest and 42 Playwright tests. New audit coverage adds 13 unit cases and eight browser tests; the existing registration journey additionally visits Dashboard. No tests were removed or skipped.

The measured pre-split main JS was 649.39 kB (186.74 kB gzip). The intermediate all-lazy 351.09 kB build was superseded because auth component tests require immediate forms. The final auth-eager/protected-lazy main chunk is 372.11 kB (116.61 kB gzip), a 42.7% raw main-chunk reduction. The largest separate domain chunk is settingsService at 24.96 kB (8.00 kB gzip). No chunk-size warning remains. No chunk warning threshold or dependencies were changed. Build sizes are not network latency or Core Web Vitals measurements. Production auth remains disabled unless explicitly built for mock preview; browser workflows use the development mock.

## Remaining limits and disposition

Session-only mock state, fixed fixture dates, manual valuations, print-to-PDF, simulated delivery and manual automation review remain intentional. No bank, brokerage, email, AI, production authentication or payment provider was connected. Large-ledger scaling, offline/chunk-load recovery, deploy/cache policy, CI execution, multi-browser testing and formal accessibility/security testing require later work. Historical dependency advisory reports are not a fresh registry audit; this block verifies installed dependency integrity without changing versions.

Missing onboarding desktop/mobile and mobile Dashboard designs, exact fonts and unexported interaction states still need approval. [Backend readiness](FRONTEND_BACKEND_READINESS.md) identifies blocking contract/schema decisions. No schema or migration was created.

## Final validation record

| Check                                 | Executed result                                                                                |
| ------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Targeted invoice/export/dialog Vitest | 49 passed                                                                                      |
| Complete Vitest                       | 209 passed, 12 files                                                                           |
| Complete Playwright                   | 50 passed, 25 per viewport, including all 42 previous regression tests; final run 54.7 seconds |
| Production build                      | Passed; main JS 372.11 kB / 116.61 kB gzip                                                     |
| ESLint                                | Passed                                                                                         |
| Prettier                              | Passed                                                                                         |
| Installed dependencies                | `npm ls --depth=0` passed; no dependencies added                                               |
| API health                            | Actual temporary listener: HTTP 200, `{"status":"ok","service":"easyfinance-api"}`             |
| Authoritative assets                  | All 49 SHA-256 hashes match; OS metadata excluded                                              |
| Git whitespace                        | `git diff --check` passed                                                                      |

`npm run check` executed lint, formatting, complete Vitest and production build. Browser/API execution required local socket permission outside the sandbox. The final browser run included the added registration-to-Dashboard step. Earlier interrupted/failing runs are superseded, not counted as passes: eager-auth compatibility, the missing Link import and audit accessible-name locator were corrected before final execution. No arbitrary waits or skipped tests were introduced.

## Change and preservation record

Block 7 touched route loading (`App.jsx`), Home actions/response and shell notice links, invoice rounding, Income/Expenses CSV adapters and the shared exporter. Added `services/tests/audit.test.js` and `e2e/audit.spec.js`; extended the existing auth browser journey with Dashboard assertions without removing prior coverage. Added this report, the backend-readiness assessment and visual audit; synchronized README, architecture, frame index, screen inventory, plan and progress.

Against the recorded start-of-Block-7 file hashes, no pre-existing file was deleted. Prior block visual reviews, auth application code, dialog implementation, dependency lockfile and original assets are unchanged. The branch remains `feat/authentication`; the working tree includes earlier legitimate changes and Block 7 work. The index remains empty. Nothing was staged, committed, pushed, merged, reset, cleaned or switched. Block 8 and schema implementation were not started.
