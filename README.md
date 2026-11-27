# EasyFinance

EasyFinance implements 21 responsive V1 screens with explicit demo and authenticated local API modes. Express/Prisma persistence covers the established financial and workspace workflows, including real Home/Dashboard reports and category management. AI, live banking, market feeds and background automation remain unavailable. This is a locally validated development application, not a production deployment. See [current CI and quality controls](docs/BLOCK10B_CI_QUALITY.md) and the dated block reports for supported boundaries.

## Stack and requirements

JavaScript ESM/JSX, React, Vite, Tailwind CSS, React Router, TanStack Query, Node.js, Express, PostgreSQL and Prisma. npm workspaces, ESLint, Prettier, Vitest, Supertest and GitHub Actions support development. Use Node **24.19.0** (`.nvmrc`) and npm **11**. Exact dependency versions are pinned in workspace manifests and `package-lock.json`. PostgreSQL 18 is required for API-mode integration tests, but not ordinary lint/unit/demo checks. Playwright tests all 21 frontend screens and cross-module workflows at desktop and mobile sizes.

## Repository

```text
apps/web/                 React SPA and original-logo runtime copy
apps/api/                 Express REST API and Supertest tests
packages/shared/          Browser-safe API contracts
database/prisma/          34-model schema, reviewed migration and fictional seed
docs/blueprint/           Original Draw.io and PDF
docs/design/              Frame index, design system, brand and SVG references
docs/architecture/        Architecture and database review
.github/workflows/ci.yml  Automated checks
```

Source subdirectories are introduced as functionality requires them; see [architecture](docs/architecture/ARCHITECTURE.md) for planned component and backend boundaries. Original OS metadata remains ignored in the former reference directories; no original files were deleted.

## Install and run

```sh
nvm use
npm install
cp .env.example .env
npm run dev
```

After the initial install, use `npm ci` for reproducible installation from the lockfile. `npm run dev` starts both processes and stops the other if either exits. Open <http://localhost:5173>. Unauthenticated sessions open Login. Sign in with `alex@example.com` / `EasyFinanceDemo!`, or complete a simulated registration and onboarding. The successful destination is the Home assistant; Dashboard is available through navigation. The development foundation remains at `/development`. Refreshing ends the demo session.

Separate terminals are also supported:

```sh
npm run dev:web
npm run dev:api
```

API: <http://localhost:3001/api/health>. Expected JSON: `{"status":"ok","service":"easyfinance-api"}`. The listener binds loopback. Health is database-independent liveness.

## Configuration

Both apps read the repository-root `.env` from explicit paths, so workspace commands behave consistently. Defaults work without this file.

| Variable     | Scope                  | Default/purpose                                         |
| ------------ | ---------------------- | ------------------------------------------------------- |
| NODE_ENV     | Server                 | development; test/production also accepted              |
| API_PORT     | Server                 | 3001                                                    |
| WEB_ORIGIN   | Server                 | http://localhost:5173; exact allowed browser origin     |
| VITE_API_URL | Public browser bundle  | http://localhost:3001; API origin, no trailing API path |
| DATABASE_URL | Private server tooling | Private migration/test PostgreSQL connection            |

Never place credentials in `VITE_*`: Vite embeds them in browser code. Restart development processes after environment changes. Configure public values at build time for production. Keep `.env` ignored; `.env.example` contains placeholders only. If changing the web port, update the Vite config and matching WEB_ORIGIN. Do not use 127.0.0.1 in the browser unless WEB_ORIGIN is adjusted to match.

## Checks

```sh
npm run build
npm run lint
npm run test
npm run format:check
npm run check
```

`npm run format` formats code/documentation while excluding original assets. `npm run test:watch` runs interactive tests. `npm run preview --workspace @easyfinance/web` serves the built SPA locally. Run `npx playwright install chromium` once, then `npm run test:e2e` for browser tests. They start and stop both development servers and capture layouts under ignored `test-results/auth-layouts/` and block-specific directories. Use localhost, matching the configured CORS origin. CI runs `npm ci`, `npm run check`, installs Chromium and runs the browser suite; it requires neither database credentials nor external providers.

## Sources and next steps

- [Draw.io blueprint](docs/blueprint/EasyFinance_V1_Blueprint_Complete.drawio) and [PDF](docs/blueprint/EasyFinance_V1_Blueprint_Completo.pdf).
- [Figma export index](docs/design/FRAME_INDEX.md): all original filenames, desktop/mobile mappings and gaps. Figma source URLs were not supplied.
- [Design system](docs/design/DESIGN_SYSTEM.md) and [preservation manifest](docs/design/ASSET_MANIFEST.json).
- [21-screen inventory](docs/SCREEN_INVENTORY.md), [implementation plan](docs/IMPLEMENTATION_PLAN.md), [progress and validation](docs/PROGRESS.md).
- [Database workflow](database/README.md) and [database conflicts](docs/architecture/DATABASE.md).

Block 1 is implemented as a frontend demo; see [authentication behavior and limitations](docs/AUTHENTICATION.md). Blocks 2–6 are also implemented as session-only frontend demonstrations; see [Settings & Collaboration](docs/SETTINGS_COLLABORATION.md). All 21 functional screens are implemented. **Block 7 — Integration & QA** is documented in the [frontend audit](docs/FRONTEND_AUDIT.md); production readiness is not claimed. Onboarding visual approval and the original font remain pending. Schema and real authentication are separate future work.

## Review and commit (manual)

Block 1 changes are on `feat/authentication`. Nothing was staged, committed or pushed by this implementation task. Review `git status --short` and `git diff` before staging the files you intend to include.

Suggested commit message: `feat: implement responsive mock authentication and onboarding`.

## Mock authentication boundary

Vite development enables the mock automatically. Production builds disable it by default; the forms explain this. To deliberately exercise a local production preview, set `VITE_AUTH_MODE=mock` at build time. This public flag is not a security control and must never be mistaken for production authentication. The mock creates no persistent records, stores no submitted passwords, and sends no emails. Do not enter real personal information. See [demo scenarios](docs/AUTHENTICATION.md).

## Home and Dashboard

See [Block 2 behavior and calculation conventions](docs/HOME_DASHBOARD.md) and [visual review](docs/design/BLOCK2_VISUAL_REVIEW.md). Both screens share one fictional ledger and session-scoped filters. No external AI or financial integrations are active.

## Income & Invoices demonstration

F07–F11 provide invoice editing/preview, client management, partial payments, reviewed bank matches and recurring draft preparation. All financial views share one session ledger; reload resets changes. See [behavior and financial rules](docs/INCOME_INVOICES.md) and [ten-layout visual review](docs/design/BLOCK3_VISUAL_REVIEW.md). PDF uses the browser print dialog; email and recurring jobs are not live integrations.

## PostgreSQL/Prisma foundation (Block 8)

The 34-model persistence structure, reviewed versioned migration and guarded fictional seed are in `database/`; existing frontend services remain unchanged. Run `npm run db:validate`, `npm run db:generate` and `npm run db:test:offline` for checks without a database. See [database setup](docs/DATABASE_SETUP.md) for the explicit disposable-database safeguards, live validation results and migration commands. The migration, seed reruns and 31 live database tests passed on disposable local PostgreSQL 18.7; no production financial API is implemented.

## Backend foundation (Block 9A)

`npm run dev` retains the labeled demo. `npm run dev:api-mode` uses real local authentication and persistent Accounts/Transactions/Expense Overview with the restricted `API_DATABASE_URL` configured in ignored `.env`. Register a fictional development identity, sign in, complete onboarding and open Expenses. Other financial modules remain explicit in-memory demos; they do not share persistent balances yet. No bank/email/OAuth integration or production deployment is included.

See [backend architecture](docs/BACKEND_ARCHITECTURE.md), [API contracts](docs/API_CONTRACTS.md), [authentication](docs/AUTHENTICATION_BACKEND.md) and [integration/test commands](docs/BLOCK9A_INTEGRATION.md). Run `npm run test:api:live` only against the acknowledged disposable target. `npm run test:e2e:api` exercises real browser persistence separately from the unchanged demo browser suite. Keep both local servers stopped before switching test modes.

Block 9B.1 extends API mode to Income, Invoices, Clients and recorded receipts. Issuing a document does not receive cash or send email. See [invoice/payment persistence](docs/BLOCK9B1_INVOICES_PAYMENTS.md) for runtime grants, contracts, exact calculations and validation; demo mode remains available.

Block 9B.2 persistent CSV import and reconciliation: [behavior, validation and limitations](docs/BLOCK9B2_IMPORT_RECONCILIATION.md).

## Continuous integration — Block 10B

GitHub Actions separates quality/build gates, demo browsers and ephemeral PostgreSQL/API browsers. It uses the lockfile, exact project Node version, restricted runtime grants, bounded jobs and safe failure artifacts. Hosted execution is not yet verified; local replay results and open dependency advisories are in [the CI runbook](docs/BLOCK10B_CI_QUALITY.md). No production secrets or deployment are required. Use `npm run ci:preservation`, `npm run ci:infrastructure` and `npm run ci:backend-check` alongside existing checks. The runbook documents fresh isolated database setup and safe local test commands. Never run CI bootstrap against an existing developer database.

## Security and operations — Block 10C

See [the security/operations report](docs/BLOCK10C_SECURITY_OPERATIONS.md) for dependency patches, authentication review, the unavailable recovery/verification boundary, database readiness and the fictional backup/restore runbook. `/api/health` is liveness; `/api/ready` checks database availability. Production deployment remains blocked and unauthorized. The CI dependency audit now fails on reported advisories.

## Block 10D identity extension

Block 10D adds password-reset and email-verification proof lifecycles, account security events, shared database throttling and supporting React forms. Real email delivery remains explicitly unavailable; only isolated in-process test transports are supported. The original 34-table foundation is preserved with three additive identity tables. API startup now requires the server-only `IDENTITY_RATE_SECRET`; fresh CI bootstrap generates it. See [Block 10D identity security](docs/BLOCK10D_IDENTITY_SECURITY.md) for contracts, migration/grants, security boundaries, validation results and production blockers. Prior block reports are historical results, not evidence for this block.
