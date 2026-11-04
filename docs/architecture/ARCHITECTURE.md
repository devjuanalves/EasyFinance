# Architecture

EasyFinance is a JavaScript ESM npm monorepo. `apps/web` owns the React SPA; `apps/api` owns the Express REST API; `packages/shared` contains browser-safe contracts only. Never import server configuration or Prisma into the browser.

## Frontend

Vite compiles JSX, Tailwind v4 provides CSS tokens, React Router owns navigation and TanStack Query owns asynchronous server state. `services/api.js` centralizes the current health request with cancellation support. Browser configuration is limited to `VITE_API_URL`. The root route is explicitly a development placeholder.

As approved screens are added, introduce `features/` for module behavior and `pages/` for route composition; `components/ui`, `components/layout`, and `components/shared` hold reusable primitives and compositions. ApplicationShell coordinates Sidebar, Header and PageContainer. Add hooks, contexts and utils only for concrete reusable behavior. Empty directories and speculative component implementations are deliberately omitted because Git cannot preserve empty directories and no approved behavior is implemented yet.

## Backend

Routes map URLs to controllers. Controllers translate HTTP requests/responses; future services enforce business rules and transactions; repositories own Prisma persistence. Future validators parse and reject request input before services. Middleware centralizes request parsing, CORS, 404s and safe errors. Configuration validates the port, origin and environment. No domain services, repositories or validators are fabricated for a health response with no input or persistence.

`app.js` exports the testable Express app without listening. `server.js` starts the local listener and handles shutdown. GET `/api/health` returns `{ "status": "ok", "service": "easyfinance-api" }` without any database connection. It is liveness, not database readiness. CORS permits the configured frontend origin; it is not authentication. Server binds loopback for local development; deployment host, TLS, rate limits, trusted proxies and cookie policy must be reviewed before deployment.

## Persistence and boundaries

PostgreSQL/Prisma follow the supplied blueprint. No models or migrations exist in Block 0. Authentication, workspace authorization, financial mutations and external integrations are future blocks. Follow the detailed database dictionary and resolve its inconsistencies with page 42 before schema work. See DATABASE.md.

## Validation

Root Vitest discovers API/shared tests; Supertest exercises the actual Express middleware stack. CI installs the lockfile then checks lint, formatting, tests and production compilation. Playwright is deferred to the first functional browser flow in Block 1; no meaningless E2E suite is created for the placeholder.
