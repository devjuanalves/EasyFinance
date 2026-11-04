# EasyFinance

A personal finance application planned around an AI home, financial dashboard, income/invoices, expenses, manual investments and workspace collaboration. Block 0 establishes the development foundation only: no functional screens, authentication, financial endpoints or database models have been implemented.

## Stack and requirements

JavaScript ESM/JSX, React, Vite, Tailwind CSS, React Router, TanStack Query, Node.js, Express, PostgreSQL and Prisma. npm workspaces, ESLint, Prettier, Vitest, Supertest and GitHub Actions support development. Use Node **24.19.0** (`.nvmrc`) and npm **11**. Exact dependency versions are pinned in workspace manifests and `package-lock.json`. PostgreSQL is not needed for this block. Playwright will be configured with the first functional browser flow.

## Repository

```text
apps/web/                 React SPA and original-logo runtime copy
apps/api/                 Express REST API and Supertest tests
packages/shared/          Browser-safe API contracts
database/prisma/          Reserved schema location (no models yet)
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

After the initial install, use `npm ci` for reproducible installation from the lockfile. `npm run dev` starts both processes and stops the other if either exits. Open <http://localhost:5173>. The page is an infrastructure placeholder, not approved EasyFinance UI.

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
| DATABASE_URL | Private server tooling | PostgreSQL connection string; unused until schema block |

Never place credentials in `VITE_*`: Vite embeds them in browser code. Restart development processes after environment changes. Configure public values at build time for production. Keep `.env` ignored; `.env.example` contains placeholders only. If changing the web port, update the Vite config and matching WEB_ORIGIN. Do not use 127.0.0.1 in the browser unless WEB_ORIGIN is adjusted to match.

## Checks

```sh
npm run build
npm run lint
npm run test
npm run format:check
npm run check
```

`npm run format` formats code/documentation while excluding original assets. `npm run test:watch` runs interactive tests. `npm run preview --workspace @easyfinance/web` serves the built SPA locally. CI runs `npm ci` and `npm run check`; it requires neither database credentials nor external providers.

## Sources and next steps

- [Draw.io blueprint](docs/blueprint/EasyFinance_V1_Blueprint_Complete.drawio) and [PDF](docs/blueprint/EasyFinance_V1_Blueprint_Completo.pdf).
- [Figma export index](docs/design/FRAME_INDEX.md): all original filenames, desktop/mobile mappings and gaps. Figma source URLs were not supplied.
- [Design system](docs/design/DESIGN_SYSTEM.md) and [preservation manifest](docs/design/ASSET_MANIFEST.json).
- [21-screen inventory](docs/SCREEN_INVENTORY.md), [implementation plan](docs/IMPLEMENTATION_PLAN.md), [progress and validation](docs/PROGRESS.md).
- [Database workflow](database/README.md) and [database conflicts](docs/architecture/DATABASE.md).

Next: **Block 1 — Authentication**, after reviewing its missing onboarding references and required schema decisions. No Block 1 work is included here.

## First commit (manual)

The repository is local on `main`; nothing is staged or committed and no remote is configured. Review `git status --short`, especially ignored local files, before running:

```sh
git add .
git diff --cached --stat
git commit -m "chore: initialize EasyFinance project foundation"
```
