# Architecture

EasyFinance is a JavaScript ESM npm monorepo. `apps/web` owns the React SPA; `apps/api` owns the Express REST API; `packages/shared` contains browser-safe contracts only. Never import server configuration or Prisma into the browser.

## Frontend

Vite compiles JSX, Tailwind v4 provides CSS tokens, React Router owns navigation and TanStack Query owns asynchronous server state. `services/api.js` centralizes the current health request with cancellation support. Browser configuration is limited to `VITE_API_URL`. The root route is the Home assistant, guarded by an explicitly simulated session; the original foundation page is at `/development`. `features/auth` owns the four access/setup pages, shared AuthLayout/form controls, validation, mock service and session subscription. Login, signup and recovery are guest routes. Registration enters guarded onboarding; incomplete registrations cannot reach Home. Completed demo sessions reach Home; sign-out and refresh return to Login.

As approved screens are added, introduce `features/` for module behavior and `pages/` for route composition; `components/ui`, `components/layout`, and `components/shared` hold reusable primitives and compositions. ApplicationShell coordinates Sidebar, Header and PageContainer. Add hooks, contexts and utils only for concrete reusable behavior. Empty directories and speculative components are deliberately omitted. All 21 approved frontend screen roles now have session-demo implementations.

## Backend

Routes map URLs to controllers. Controllers translate HTTP requests/responses; future services enforce business rules and transactions; repositories own Prisma persistence. Future validators parse and reject request input before services. Middleware centralizes request parsing, CORS, 404s and safe errors. Configuration validates the port, origin and environment. No domain services, repositories or validators are fabricated for a health response with no input or persistence.

`app.js` exports the testable Express app without listening. `server.js` starts the local listener and handles shutdown. GET `/api/health` returns `{ "status": "ok", "service": "easyfinance-api" }` without any database connection. It is liveness, not database readiness. CORS permits the configured frontend origin; it is not authentication. Server binds loopback for local development; deployment host, TLS, rate limits, trusted proxies and cookie policy must be reviewed before deployment.

## Persistence and boundaries

PostgreSQL/Prisma follow the supplied blueprint. No models or migrations exist in Block 0. Production authentication, workspace authorization, financial mutations and external integrations are future blocks. Client route guards and mock service state are not authorization. See ../AUTHENTICATION.md for the service replacement boundary. Follow the detailed database dictionary and resolve its inconsistencies with page 42 before schema work. See DATABASE.md.

## Validation

Root Vitest discovers API/shared tests; Supertest exercises the actual Express middleware stack. CI installs the lockfile then checks lint, formatting, tests and production compilation. Playwright exercises all 21 screen roles and cross-module journeys at 1440×900 and 390×844, plus representative 320/768-width checks. Vitest reuses the frontend Vite plugins and discovers JSX component tests in jsdom as well as Node API tests. The native dialog is shimmed only in jsdom; real keyboard behavior is browser-tested.

## Block 2 frontend boundary

The authenticated route shell mounts WorkspaceProvider, Home (`/`) and Dashboard (`/dashboard`). The provider owns session-scoped conversations and filters; TanStack Query loads the deterministic ledger through a replaceable mock service. Both assistant responses and Dashboard call one financial summary module. Native SVG charts include data tables. No persistence or financial HTTP route is introduced. Future backend adapters must enforce workspace authorization independently of frontend filtering. See ../HOME_DASHBOARD.md for financial conventions and component boundaries.

## Current shared state and route loading (Block 7)

Protected route modules, WorkspaceProvider and AppShell load through React.lazy/Suspense; authentication pages stay eager. The Income financial store owns one session snapshot and dispatches Income, Expenses, Investments and Settings commands. Home/Dashboard subscribe to that same ledger; TanStack Query remains the asynchronous request boundary, not a second mutable ledger. CSV exports share one browser-safe encoder. See [audit](../FRONTEND_AUDIT.md) and [backend replacement requirements](../FRONTEND_BACKEND_READINESS.md). No production financial endpoints or schema have been added.
