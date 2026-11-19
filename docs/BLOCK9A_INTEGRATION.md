# Block 9A integration and validation

18 November 2026 (Australia/Sydney). Continued the clean `feat/backend` branch after `e8b4ccb` (Block 8 database) and `819adbc` (frontend audit). No branch change, staging, commit, push, reset or cleanup. Original schema/migration/seed and all 21 screens remain available.

## Running modes

```sh
# Original explicitly labeled development demo: no database access in the API.
npm run dev

# Real auth and persistent Expenses slice, using the ignored configured root .env.
npm run dev:api-mode
```

`dev:api-mode` sets `API_MODE=api` and `VITE_AUTH_MODE=api`. Root `.env` must provide `API_DATABASE_URL` for the restricted runtime role and `EASYFINANCE_DISPOSABLE_DB=yes`; `DATABASE_URL` remains a separate admin/migration URL. Never use VITE variables for either URL. Browser mode is public configuration, never authorization. A mock browser session cannot call protected API operations.

The setup script `database/scripts/runtime-role.js` is an explicit privileged, one-time administrator operation, already executed with approval on the verified disposable database. It refuses an existing role/runtime configuration rather than silently rotating or escalating it. It creates no database and applies no migration. Review it before using it elsewhere; do not rerun to suppress a startup permission error.

`WEB_ORIGIN` defaults to http://localhost:5173. The Vite proxy sends `/api` to 127.0.0.1:3001. Real login is same-origin; use localhost consistently. Production builds explicitly set NODE_ENV=production so a development root `.env` cannot accidentally bundle React development code. To prepare the API-mode browser artifact use `VITE_AUTH_MODE=api npm run build`; a separately reviewed production server deployment is not included.

## Integrated screens and boundaries

- F01 Login: real credential check, session hydration after refresh, loading/retry/error states, logout.
- F02 Registration: neutral registration response, then explicit login; no email delivery claim.
- F03 Recovery: explicit unavailable response in API mode; original simulation retained in demo mode.
- F04 Onboarding: persistent profile defaults, workspace, owner membership, one manual account and basic categories, atomically and idempotently.
- F12 Expense Overview and F14 Transactions: authenticated workspace selector, currency/account/date/search filters, server summary, paginated rows, account opening information, create/edit, detail/original values/splits and exclude/restore. TanStack Query invalidation reconciles views after server success. Create retries retain one UUID for the editor opening. Errors and role restrictions are visible; no optimistic money is claimed.

F05–F11, F13, F15–F21 and the shell's demo workspace/history/notifications remain separate in-memory demonstrations. The global mixed-mode banner, sidebar selector label and footer explicitly distinguish them. Their actions do not persist private financial records and their simulated role never authorizes an API call. Home/Dashboard intentionally do not show persistent totals yet; both mock and server cash arithmetic share the same browser-safe calculation contract. The actual API workspace selector is inside the two persistent Expenses views.

The existing shell, logo, tokens, KPI cards, fields, transaction editor and native dialog are reused. API mode exposes only supported financial controls; source/split/transfer/payment corrections explain their restriction. Demo mode keeps the full original module interactions. No new framework, dependency, migration or schema model was added.

## Executed validation

- Live restricted-role API/security tests: **26 passed**, including authentication, expiry/revocation, password change, owner/editor/viewer permissions, pending/revoked membership, cross-workspace/currency references, CSRF, rate limiting, idempotent creation, stale concurrent edits, protected receipts/splits/transfers and safe monetary serialization.
- Original live database suite: **31 passed**, retaining actual-COMMIT and independent-backend-connection allocation concurrency cases. Offline database suite: **14 passed**.
- Complete Vitest: **220 passed in 14 files**, preserving all 209 prior tests and adding backend security, exact monetary boundary and pending-dialog checks.
- Original demo Playwright: **50 passed**, 25 per viewport. Real API Playwright: **2 passed**, one complete persistence journey at each viewport.
- Build, ESLint and Prettier passed. Production bundles remain below the 500 kB warning threshold after correcting the local NODE_ENV build interaction; API main chunk approximately 375 kB. No dependency changes.

The browser journey registers a fictional account, logs in, onboards, creates a -12.34 expense, refreshes, edits it to -23.45, refreshes again, excludes/restores, closes/searches immediately, checks Overview totals, logs out and verifies protected navigation. Both use 1440×900 / 390×844, check no horizontal document overflow/page errors/unexpected API 5xx or console errors (apart from the expected anonymous session 401), and confirm empty local/session storage. The final desktop journey also exercises the shell Add Record action.

Captures: `test-results/block9a-layouts/{desktop,mobile}-{transactions,overview,editor}.png` (ignored). All six were visually inspected for shell continuity, wrapping, values, controls and responsive cards. Full-page captures can show fixed navigation at its current scroll position; content remains scrollable. This is a scoped API-mode adaptation of established components, not a new pixel-perfect Figma approval or a repeat of all 42 earlier visual targets.

Initial test corrections: the new browser locator matched both visible description and its screen-reader button suffix; it now targets the visible row. One added receipt fixture used `paymentDate` instead of the authoritative `paidAt`/idempotency key and was corrected without schema changes. No tests were removed, weakened, skipped or given arbitrary delays. Pending saves use the dialog's optional close-disabled state, tested to allow normal closure afterward. The original duplicate-close guard is preserved.

## Final preservation and security review — 19 November 2026

The final API browser run passed both viewports after the editor navigation refinement. Complete `npm run check` passed (220 Vitest tests, ESLint, Prettier and production build); the separate API-mode production build also passed. An earlier run concurrent with browser regression hit an existing one-second authentication assertion timeout. Its isolated suite and the complete sequential check passed without changing or weakening that assertion. The 50-test demo browser regression passed separately.

Prisma 7.10.1 validation/client generation, dependency integrity, HTTP health (`200`, `ok`, `easyfinance-api`), anonymous protected-request rejection and migration status were executed successfully. Read-only final catalog inspection confirmed PostgreSQL 18.7, runtime `easyfinance_9a_app`, 34 domain tables, 84 validated foreign keys, 60 CHECK constraints and 11 initially deferred triggers. The original schema, initial migration SQL and seed are byte-identical to HEAD; no additional migration was required. All 49 authoritative asset SHA-256 hashes match (OS metadata excluded). Git diff whitespace checks passed, the index is empty and credentials remain ignored.

Security review covers Argon2id hashing, hashed opaque sessions, expiry/revocation, HttpOnly/SameSite cookies, production Secure configuration, exact Origin/custom-header CSRF checks, restricted CORS, bounded process-local rate limits, strict writable-field validation, transactional database membership checks and tenant-scoped resources. Mock browser identity cannot create a database session or authorize persistent records. Live tests verify role restrictions, forged/expired/revoked sessions, cross-workspace rejection, DDL/delete denial and conflicting financial writes. Runtime diagnostics reject elevated privileges; there is no claim of database row-level security. Production bundle inspection found the minified React production error marker and no React development-module or DevTools invitation markers. Development credentials and database URLs are never browser configuration.

The runtime remains deliberately restricted to acknowledged local disposable targets. Production deployment, shared throttling, email ownership verification, operational hardening and independent security assessment remain prerequisites, not completed assurances. This review did not reset data or rerun the one-time runtime-role setup.

## Remaining scope

No blocker remains for this local slice. This is not production readiness. Other API domains, account management beyond onboarding, split/transfer correction, imports, invoice/payment commands, investments, invitation acceptance, real recovery/OAuth/email/AI/banking, production authorization assessment, RLS decisions, distributed rate limiting, load testing, CI/multi-browser/device validation and operational deployment controls remain future work. No Block 9B implementation was started.
