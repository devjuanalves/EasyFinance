# Progress

Current block: **Block 7 — frontend audit and refinement, completed and validated**. All 21 session-only screens are implemented and reviewed; final evidence is recorded below and in FRONTEND_AUDIT.md. Production readiness and Block 8 are not authorized.

## Completed

- Audited the original directory before restructuring: 40 Figma frame SVGs, six logos, one palette, one Draw.io file, one PDF and three OS metadata files. No source, package manifests or application configuration existed.
- Created an independent Git repository on main. The enclosing home-directory repository was not modified.
- Preserved all 52 original files byte-for-byte, with original/current paths and SHA-256 in the asset manifest. Organised 49 authoritative assets; ignored OS metadata stays in place. One small intentional logo copy supports application imports.
- Created the three JavaScript ESM workspaces, minimal React placeholder, Express health route, environment validation, error handling, local CORS, CSS color tokens, quality tools and GitHub Actions CI.
- Indexed all 21 planned screens, documented architecture and database conflicts, and established permanent agent rules and roadmap.
- Installed exact dependencies with a root lockfile. See DEPENDENCIES.md for actual versions.

## Validation — 4 November 2026, Australia/Sydney

- Dependency installation: passed. Clean `npm ci` tested; package-lock resolves the workspace packages.
- Frontend/backend development: root `npm run dev` started Vite and Node watch processes. Frontend returned HTTP 200 with its Vite entry; API returned HTTP 200 with exactly `{"status":"ok","service":"easyfinance-api"}`. CORS returned the configured origin. Both processes were stopped after verification.
- Production build: passed.
- ESLint: passed.
- Vitest/Supertest: all six tests passed (health contract, local/arbitrary CORS origins, JSON 404, malformed JSON and environment validation).
- Prettier check: passed. Original SVG/Draw.io/PDF assets excluded from formatting.
- Asset verification: all 52 original hashes match; no byte-identical frame duplicates; runtime logo copy matches its source.
- Git: main, no commits, no staged/tracked files and no remotes. Ignore checks cover local environments, node_modules, build output and OS metadata. No secrets are tracked; a targeted common credential-pattern scan of text sources found no matches. The environment example contains placeholders only.
- First sandbox test attempt could not bind localhost (EPERM); rerun with local socket access passed. This was an execution restriction, not a test failure in application behavior.
- CI configuration exists but no remote GitHub Actions execution was triggered. Browser end-to-end flows are deferred until functional screens exist.

## Known issues and pending decisions

- Missing F04 onboarding desktop/mobile and F06 mobile dashboard exports. Aside.svg is preserved as an unclassified standalone navigation reference. F08 combined list/overview and F09/F17 creation-state coverage need review.
- Font identity, final component tokens, responsive breakpoints and some component states are unconfirmed. Placeholder styling is not an approved design.
- Blueprint page 42 conflicts with the detailed 34-table dictionary; resolve before schema implementation. PostgreSQL server major, hosting, providers, storage and backup policies remain open.
- Final npm audit reports six moderate development-tool findings; production-only audit reports zero. The remaining minimatch dependency chain has no supported npm fix; no cross-major dependency overrides were forced. Recheck before CI processes untrusted repositories. High-severity Prisma transitive findings were resolved by using 7.10.1.
- This machine's npm policy reports unapproved install scripts for Prisma engines/CLI and optional fsevents. Installation, checks and dev servers succeed without them. No Prisma client or database connection was generated/tested; review engine installation when the schema block begins.
- Prisma schema, migrations, production authentication and financial operations remain deliberately unimplemented. Block 1 adds only frontend mock authentication and browser tests.

## First commit readiness

Ready for manual review and initial commit with the above documented limitations. Nothing has been staged, committed or pushed. Use the README commands after review.

## Block 1 — 4 November 2026 (Australia/Sydney)

Completed Login, Sign Up, Forgot Password and four-step Onboarding; shared responsive layout and controls; deterministic in-memory service; guest/completed/onboarding route guards; sign-out; protected original Home placeholder. All required input, loading, failure, confirmation and step-navigation behavior is implemented. Official source files remain unchanged.

Validation: 28 Vitest/component/service/API tests passed; four Playwright tests passed across 1440×900 and 390×844. Eight screenshots captured and visually inspected. Browser checks found no horizontal overflow, missing images or page/console errors. Frontend/API servers started through Playwright; Home reported API ok. Build, ESLint and Prettier checks passed. Test infrastructure fixes included workspace plugin resolution, jsdom dialog shims, unambiguous selectors and using localhost to match API CORS.

Remaining limitations: exact font unavailable; onboarding reference pair missing and visuals provisional; no real accounts/sessions, OAuth, emails, reset tokens, invitations, permissions or persistence. The remember-me option does not survive reload. Production builds disable the mock unless explicitly opted in at build time. Six existing moderate development-tool advisories remain from Block 0; dependency additions did not require replacing the established framework stack.

Git: clean working tree at start on existing `feat/authentication`; user changes were not overwritten. Changes remain unstaged and uncommitted. No push or remote operation performed. Suggested manual commit: `feat: implement responsive mock authentication and onboarding`.

See AUTHENTICATION.md for demo credentials/scenarios and design/BLOCK1_VISUAL_REVIEW.md for source mapping, deliberate differences and screenshot locations. The original Block 0 validation record above is historical; its no-commit and no-screen statements describe the end of that block, not the current repository.

## Block 2 — 6 November 2026 (Australia/Sydney)

Implemented F05 Home assistant/history and F06 Dashboard with shared authenticated navigation, responsive mobile history drawer and bottom navigation, session-only chat state, attachment selection, truthful future-feature dialogs, consistent financial fixture and calculation helpers, filters, charts, insights, reviews, recent transactions and loading/empty/partial/error states. No dependencies, backend financial endpoints, persistence, AI service or schema were added.

Validation: `npm run check` passed (lint, format, 37 unit/component/API tests, build); dependency tree verified. Browser and visual results are detailed in design/BLOCK2_VISUAL_REVIEW.md. Calculation tests cover cents reconciliation, transfers, currency/participant/workspace isolation, invalid dates, incomplete data, zero denominators and assistant/Dashboard consistency. Initial API tests required local socket permission; browser tests found and resolved nested-dialog event bubbling and selector label issues. Empty expense totals were normalized to positive zero.

Preservation: all 49 authoritative assets match SHA-256 manifests; Block 1 visual review and auth implementation files unchanged. Existing uncommitted work preserved, with only auth test destination assertions updated for the new Home. Current branch remains `feat/authentication`; nothing staged, committed, pushed, merged or switched. See HOME_DASHBOARD.md for usage, formulas and integration boundaries.

Block 2 final browser result: all eight Playwright tests passed (four desktop, four mobile), including existing authentication flows. Screenshots and viewport captures were inspected. Final registry audit: four moderate development-tool findings in the ESLint/minimatch chain; zero high or critical findings. The suggested ESLint fix is a cross-major downgrade, so no dependency changes were made. This supersedes the historical six-moderate count for the current audit only.

## Block 3 — 7 November 2026 (Australia/Sydney)

Completed F07 Income Overview, F08 Invoice List, F09 Create/Edit Invoice, F10 Details & Payments and F11 Clients & Employers inside the existing shell. Added one session financial store, decimal invoice math, lifecycle-aware commands, client snapshots, partial/full payments, explicit bank-match review, CSV export, invoice preview/print, recipient preparation and recurring draft review. Home and Dashboard now consume the same mutable ledger. Invoice issuance never creates received income; linking an existing transaction never creates a second receipt.

Validation: `npm run check` passes (ESLint, Prettier, 67 unit/component/service/API tests, production build). All 18 Playwright tests pass, including eight prior auth/Home/Dashboard flows. Ten principal layouts and matching viewport captures were inspected at 1440×900 and 390×844; document overflow, missing-image and browser-error checks pass. API health is ok. Dependency tree and all 49 authoritative asset hashes verified. No dependencies, database schema, backend financial API or external integrations added.

Design: all five desktop/mobile SVG pairs were available and inspected. Combined F08 and create/edit F09 exports require interpretation; exact font and unexported interaction states remain provisional. See design/BLOCK3_VISUAL_REVIEW.md and INCOME_INVOICES.md for sources, calculations, screenshots and limits. PDF uses browser print; email is preparation only; recurrence is manual review, not a background job.

Preservation: existing dirty work on `feat/authentication` retained. Authentication source, prior visual reviews and dependency lockfile unchanged from the start of Block 3. Nothing staged, committed, pushed, merged, reset or switched. Block 3 ends here; later modules and production integrations need separate authorization.

## Block 4 — 11 November 2026 (Australia/Sydney)

Completed F12 Expense Overview, F13 Statement Import & Review, F14 Transactions & Details and F15 Categories & Rules within the existing shell. CSV parsing, explicit duplicate review, exact-cent splits, exclusion/restoration, transfer review, source/audit preservation and deterministic category rules use the same session ledger as Home, Dashboard and Income. Invoice-linked receipts retain allocation protections. No dependencies, production services or database changes were added.

Resumed final validation without restarting implementation. The initial dialog open-prop guard was insufficient before a parent update committed; a synchronous per-opening close-request guard now prevents duplicate notifications, and Escape follows controlled closure. Six dialog regression tests and the previously failing mobile close/search workflow pass without arbitrary waits.

Validation: `npm run check` passed (ESLint, Prettier, 103 unit/component/service/API tests, build). All 26 Playwright tests passed, including the 18 previous regressions. All eight F12–F15 targets were captured and inspected at 1440×900 and 390×844; width, browser-error and image checks passed. API health returned ok, dependency tree passed, and all 49 authoritative asset hashes match. A non-fatal approximately 551 kB main-chunk build warning remains.

See [Expenses behavior](EXPENSES.md) and [Block 4 visual review](design/BLOCK4_VISUAL_REVIEW.md) for references, financial invariants, visual deviations and limits. PDF/OCR, live AI/banking, persistence, real scheduling and production authorization remain unavailable. Exact visual approval and other browser engines are unverified.

Git remains on `feat/authentication` with earlier and current changes uncommitted and unstaged. Nothing staged, committed, pushed, merged, reset, cleaned or switched. Block 4 ends here; Block 5 requires separate authorization.

## Block 5 — 15 November 2026 (Australia/Sydney)

Completed F16 Investment Dashboard, F17 Add/Edit Investment and F18 Details/History in the existing shell. Manual accounts, conditional asset forms, purchases, contributions, withdrawals, sales, distributions, fees, dated valuations and confirmed history corrections use the shared session store. Eight-decimal quantity/price arithmetic uses scaled BigInt and half-up cents; weighted-average basis and history replay prevent overselling and invalid dependent corrections. Currency/workspace isolation and explicit unknown valuations prevent misleading aggregation. Portfolio values and distributions remain separate from confirmed cash income. Home and Dashboard read the same portfolio selectors.

Validation: complete `npm run check` passed: ESLint, Prettier, **144 Vitest tests in 10 files**, production build. Complete Playwright suite: **34 passed**, 17 per viewport, including all 26 previous regressions. All six principal F16–F18 layouts and interaction captures were inspected at 1440×900 and 390×844. Browser errors, missing images and horizontal overflow checks passed. Dependency tree passed; all 49 authoritative asset hashes match. API health returned HTTP 200 with `status: ok` and `service: easyfinance-api`. The build has a non-fatal 601.52 kB main-chunk warning.

All six source SVGs were available; create/edit and unexported interaction states require documented interpretation. See [Investment behavior](INVESTMENTS.md) and [Block 5 visual review](design/BLOCK5_VISUAL_REVIEW.md). No dependencies, schema, financial API, live feeds, brokerage integration, tax engine or cash linking were added. Manual valuations, session-only state, fixed sample dates and final visual approval remain limitations.

Earlier uncommitted work remains on `feat/authentication`. Original assets, authentication, prior visual reviews, Block 4 dialog and dependency lockfile are preserved. Nothing staged, committed, pushed, merged, reset, cleaned or switched. Stop before Block 6.

## Block 6 — 15 November 2026 (Australia/Sydney)

Completed F19 Profile & Settings, F20 Sharing & Permissions and F21 Automations & Notifications inside the existing shell. Personal preferences remain distinct from workspace metadata. Active memberships now determine mock read/write permission across financial services; explicit demo identity switching exercises Owner, Editor, Viewer and revoked access. Invitations require explicit simulated acceptance. Shared automations prepare reviewable invoices through existing invoice math/store, with occurrence/template idempotency and no received-income changes. Header notifications are recipient/workspace scoped and obey implemented preference behavior.

Final corrections preserved the Expenses read-only error contract while distinguishing inaccessible workspaces and Owner-only operations. Destructive actions retain the existing button geometry with red warning treatment and confirmations. Settings sidebar alignment/active state and action sizing were corrected with scoped styles. Automation entity labels distinguish drafts, reminders and workspace reviews. Member summaries exclude other users' personal preferences. The shared dialog regression fix and all previous tests are unchanged.

Validation: targeted Settings/Expenses tests **82 passed**; eight new browser workflows passed independently. Complete `npm run check` passed: ESLint, Prettier, **196 Vitest tests in 11 files**, production build. Complete Playwright: **42 passed**, 21 at each viewport, including all 34 previous browser regressions. F19/F20/F21 were captured and inspected separately at 1440×900 and 390×844, including relevant editors, confirmations and notification states. Browser errors, missing images and horizontal overflow checks passed. Dependency integrity passed; API health returned HTTP 200 / ok. All 49 authoritative assets match their hashes. A non-fatal approximately 649 kB main-chunk warning remains.

See [Settings behavior](SETTINGS_COLLABORATION.md) and [Block 6 visual review](design/BLOCK6_VISUAL_REVIEW.md) for sources, precise preference/notification limits and future integration needs. No real email, security controls, background scheduling, database, production authorization or new dependencies were introduced. Unexported interaction states and typography remain provisional.

The current branch remains `feat/authentication`; earlier uncommitted work is preserved. Changes remain unstaged and uncommitted. Nothing staged, committed, pushed, merged, reset, cleaned or switched. Stop before Block 7.

## Block 7 — 17 November 2026 (Australia/Sydney)

Completed the resumed frontend audit without rebuilding prior modules. Fixed a reproduced invoice discount residual defect with bounded backward allocation, consolidated CSV export escaping/formula neutralization while preserving negative amounts, connected stale Home transaction/review actions, and retained protected-route lazy loading with eager auth pages. Main JS reduced from 649.39 kB to **372.11 kB (116.61 kB gzip)**; no chunk-size warning remains. No dependency, backend or schema additions.

Final `npm run check` passed: ESLint, Prettier, **209 Vitest tests in 12 files**, production build. Final complete Playwright suite: **50 passed**, 25 per viewport, including all 42 earlier regressions and the extended registration-to-Dashboard journey. All 21 screens were reviewed at 1440×900 and 390×844 (42 targets); representative 320/768-width checks also passed. No principal-route console/page errors, missing images or document overflow were reported. API health returned HTTP 200 / ok; installed dependencies and all 49 authoritative asset hashes passed. `git diff --check` passed.

See [frontend audit](FRONTEND_AUDIT.md), [visual evidence](design/BLOCK7_VISUAL_AUDIT.md) and [backend readiness](FRONTEND_BACKEND_READINESS.md). Financial regressions cover shared-ledger updates, invoice allocation/rounding, imports/splits/transfers/exclusions, investment cost basis and automation idempotency. Missing onboarding desktop/mobile and Dashboard mobile references remain provisional; exact font, real-device/multi-browser/CI, formal accessibility and production integration remain pending. CSV safety is byte-tested; spreadsheet application execution was not exercised.

Earlier uncommitted work is preserved on `feat/authentication`; no pre-existing baseline file was deleted, no source assets or old block visual reviews changed, and nothing is staged or committed. No branch, push, merge, reset or cleanup operation occurred. Block 7 ends here; Block 8 is not started.
