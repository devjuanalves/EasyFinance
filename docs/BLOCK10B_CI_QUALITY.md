# Block 10B — CI, quality gates and test reliability

Reviewed 26 November 2026. This is local CI preparation, not a deployment or a claim that hosted GitHub Actions has passed. Application source, financial calculations, layouts, schema, migrations, seed and lockfile are unchanged.

## Workflow architecture

`.github/workflows/ci.yml` runs on pushes, pull requests and manual dispatch. All branches are included so a required check cannot remain pending because a path filter excluded a change. The workflow uses `contents: read`, disables persisted checkout credentials, uses GitHub-hosted Ubuntu 24.04 runners and cancels superseded runs of the same PR/ref. No `pull_request_target`, self-hosted runner, repository secret, production resource or paid provider is required. Checkout 6.0.2, setup-node 6.0.0 and upload-artifact 6.0.0 use immutable official release commits verified against their GitHub refs.

| Job          | Dependency | Gates                                                                                                                                                                                                                               | Limit      |
| ------------ | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| quality      | None       | npm ci/tree, asset/database preservation, Prisma validate/generate, backend syntax, infrastructure safety/bounds tests, lint, formatting, Vitest, offline DB tests, both builds and bundle checks, whitespace, advisory diagnostics | 15 minutes |
| demo-browser | quality    | Chromium installation and all demo workflows at both viewports, no DB service                                                                                                                                                       | 15 minutes |
| database-api | quality    | PostgreSQL readiness, original migration, fresh runtime-role bootstrap, migration status, runtime diagnostics/startup/health/shutdown, DB integrity, API/security and API browser suites, preservation                              | 20 minutes |

Each job installs from the same lockfile with `npm ci`; setup-node caches the npm download cache, not node_modules or database data. Node comes from `.nvmrc` (24.19.0), with the repository's npm 11 requirement. No package manager or dependency version changed. Demo/API browser jobs are isolated on different runners; the database/API job executes its seed-based DB suite, API suite and browser suite sequentially. A failed command fails its step/job. Dependency advisories are an explicitly nonblocking review diagnostic; malformed/unavailable audit results fail the diagnostic step. Required branch-protection checks must still be configured in repository settings by its maintainers.

## PostgreSQL and credentials

The database job creates a fresh `postgres:18` service with `easyfinance_test_disposable_ci`, readiness checks and a loopback-only published port. The major image tag intentionally accepts PostgreSQL 18 maintenance updates; it is not a digest-pinned claim of byte-identical infrastructure. The service is destroyed with its job. No connection to the developer's Mac or shared database is configured.

The bootstrap administrator credential is disposable and run-specific, derived from the run ID/attempt; it is not a production secret or the security boundary. The security boundary is the isolated short-lived runner/service with no private records. `github-env.js` masks its URL and password before exporting them for subsequent steps. `bootstrap-db.js` generates a cryptographically random runtime password, masks it, and writes it only to `GITHUB_ENV` (or the explicitly selected ignored local replay file). Neither script edits root `.env` or prints a usable runtime credential. Do not enable shell tracing or upload these environment files.

Existing `disposableDatabaseUrl` guards remain unchanged: loopback, approved disposable naming, explicit `EASYFINANCE_DISPOSABLE_DB=yes`, no production mode. Bootstrap additionally requires `EASYFINANCE_CI_BOOTSTRAP=yes`, exact database `easyfinance_test_disposable_ci`, administrator `postgres`, 34 migrated tables, zero users/workspaces and no existing runtime role. It refuses to replace a role or initialize the developer's `easyfinance_block8_test`. The migration is deployed with the existing guarded command; no db push, reset or seed recreation is used as a shortcut.

Runtime `easyfinance_9a_app` receives the explicit union of reviewed Block 9A–9B.4 grants. It has no superuser, database/role creation, replication, bypass-RLS, schema creation, ownership or blanket table grants. DELETE is limited to invoice_items for the established draft replacement workflow; import batches and investment accounts remain append-only for runtime writes. Statement and idle-transaction timeouts are retained. Membership/workspace enforcement remains in the existing application services; database privileges alone are not tenant authorization. No production role provisioning is implemented.

| Variable                      | Purpose                                                                |
| ----------------------------- | ---------------------------------------------------------------------- |
| DATABASE_URL                  | Private ephemeral administrator connection for migration/test fixtures |
| API_DATABASE_URL              | Private generated restricted runtime connection                        |
| EASYFINANCE_DISPOSABLE_DB=yes | Existing explicit disposable-write safeguard                           |
| EASYFINANCE_CI_BOOTSTRAP=yes  | Additional fresh-target bootstrap acknowledgement                      |
| GITHUB_ENV                    | Runner-owned environment output; never uploaded                        |
| EASYFINANCE_CI_ENV_FILE       | Explicit ignored output path for local bootstrap replay                |
| CI=true, TZ=UTC               | Bounded workers, no focused tests, safe reporter, UTC runner           |
| EASYFINANCE_BROWSER_MODE      | api or demo, separate safe summary filename                            |

Tests create fictional accounts and unique workspace/record identifiers. The DB integrity suite intentionally uses its existing deterministic seed and idempotent seed checks inside the fresh service. No local developer records are used by this replay.

## Browser reliability and artifacts

Playwright now starts API and Vite as separate owned processes, waits for API HTTP health and the web URL, and refuses to reuse occupied ports. Modes and public origins/ports are explicit, so a local `.env` cannot silently turn a demo run into API mode. Ports 3001/5173 remain the established contract; different CI jobs have independent network namespaces. Stop only confirmed test-owned servers or run on another isolated machine when these ports are busy. Playwright owns teardown. No arbitrary sleeps, weakened assertions or retries were added (zero retries; two demo workers, one API worker).

All API browser specs use a shared fixture setting the browser Date API to 26 November 2026. Timers continue normally and the real server session clock is unchanged. This prevents November financial fixtures from disappearing when the calendar moves to another month. Viewports remain Chromium 1440×900 and 390×844, with browser timezone UTC. No real-device or other-engine testing is claimed.

`demo-runs` and `api-runs` remain separate. CI traces are disabled because raw traces may contain authentication headers, cookies, invitation tokens and request bodies. Local traces remain available on failure and must not be published without review. Failure uploads retain only a strict JSON summary (title, project, status, duration, retry) plus an allowlist of desktop/mobile financial Dashboard PNGs from fictional fixtures. Auth, profile, invitations, raw error contexts, storage state, HTML reports, logs and arbitrary trace archives are excluded. Artifacts expire after three days. Missing captures do not fail an already failing job. The safe reporter has a test proving that error/stdout/attachment credentials are excluded; screenshots still require re-review if fixture content changes.

Prisma generation precedes browser startup in CI. During local work a generation performed while node --watch was active restarted the API and one invoice browser check failed with a request error. After generation finished, the complete browser run passed. No timing workaround was added; the workflow ordering prevents this interference.

## Build and performance checks

Both demo and API Vite builds explicitly use the existing production build script. `ci:build-check` checks emitted JavaScript for development-module/debug markers, private URL/password values present in its environment and a server-secret sentinel. These checks supplement the actual NODE_ENV=production invocation; they are not a general secret scanner or proof against every possible leak. Backend source is native ESM: `ci:backend-check` runs Node syntax checks on all 38 API source files; no fake backend bundle/transpilation was introduced.

Bounded infrastructure tests parse 500 fictional CSV rows repeatedly, reject 501, and verify that reporting rejects collections over 10,000 instead of returning partial totals. Startup/health/graceful-SIGTERM checks exercise a dedicated child API on port 13001 and disconnect Prisma. Existing live tests retain financial concurrency, pagination/validation, duplicate prevention and rollback coverage. These small tests do not establish throughput or scalability. Workspace serialization, bounded full portfolio replay, report query volume and production connection-pool/load behavior remain risks. The installed pg driver emits a deprecation warning for overlapping query calls; it is recorded for a future driver/service review, not changed in this infrastructure block.

## Local reproduction

Use Node from `.nvmrc`. No PostgreSQL is needed for lint, Vitest or demo browser tests. Ordinary Vitest API tests do need permission to bind temporary local sockets.

```sh
npm ci
npm run db:generate
npm run check
npm run db:test:offline
npm run ci:infrastructure
npm run ci:backend-check
npm run ci:preservation
npx playwright install chromium
CI=true EASYFINANCE_BROWSER_MODE=demo npm run test:e2e
VITE_AUTH_MODE=api npm run build
npm run ci:build-check
```

For a **new isolated local Docker replay**, use a new container name and an unused loopback port. Do not point bootstrap at existing development data. The following service contains only disposable fixtures; `--rm` removes only that named service when stopped. Do not echo credentials or enable shell tracing.

```sh
export POSTGRES_PASSWORD="$(node -e "process.stdout.write(require('node:crypto').randomBytes(32).toString('hex'))")"
docker run --rm -d --name easyfinance-ci-10b \
  -p 127.0.0.1:55432:5432 \
  -e POSTGRES_PASSWORD -e POSTGRES_USER=postgres \
  -e POSTGRES_DB=easyfinance_test_disposable_ci postgres:18
# Wait for this readiness command to succeed before migration:
docker exec easyfinance-ci-10b pg_isready -U postgres -d easyfinance_test_disposable_ci
export DATABASE_URL="postgresql://postgres:${POSTGRES_PASSWORD}@127.0.0.1:55432/easyfinance_test_disposable_ci"
export EASYFINANCE_DISPOSABLE_DB=yes EASYFINANCE_CI_BOOTSTRAP=yes
mkdir -p .tmp
export EASYFINANCE_CI_ENV_FILE=.tmp/ci-runtime.env
npm run db:validate
npm run db:generate
npm run db:migrate
npm run ci:db-bootstrap
set -a
. .tmp/ci-runtime.env
set +a
npm run db:status
npm run ci:lifecycle
npm run db:test
npm run test:api:live
CI=true EASYFINANCE_BROWSER_MODE=api npm run test:e2e:api
# Stop only the explicitly created disposable container after inspection:
docker stop easyfinance-ci-10b
```

Bootstrap is intentionally not a rerunnable repair tool: an existing role or populated target fails rather than being reset. Re-run tests on the same disposable target if needed, or explicitly create fresh infrastructure; never weaken the guard. Keep generated credentials ignored. For failures inspect test output and local `test-results/{demo-runs,api-runs}`; locally `npx playwright show-trace PATH` opens retained traces. Hosted safe summaries identify the failed test without publishing its request data.

## Executed local evidence

The local replay used PostgreSQL **18.7**, a newly initialized temporary cluster at **127.0.0.1:55432**, exact database `easyfinance_test_disposable_ci`. The original server/database on port 5432 was not reset, seeded or used by these live tests. Docker is not installed here; therefore the native isolated replay verifies migration/grant/test prerequisites, not the hosted Linux container execution.

| Check                                  | Actual result                                                                                                                        |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Clean npm ci / dependency tree         | Passed; lockfile unchanged                                                                                                           |
| Workflow syntax                        | actionlint 1.7.12 passed; downloaded official release checksum verified                                                              |
| Prisma validate / generate             | Passed; generation also works without a configured DATABASE_URL for the demo job                                                     |
| Original migration / status            | Applied successfully to the fresh target; one migration, up to date                                                                  |
| Runtime lifecycle / health             | Restricted role diagnostics, HTTP 200/ok and clean SIGTERM exit passed                                                               |
| Live API/security                      | 131 passed                                                                                                                           |
| PostgreSQL integrity                   | 31 passed, including original concurrency and fictional seed rerun checks                                                            |
| Offline DB                             | 14 passed                                                                                                                            |
| Vitest                                 | 226 passed, 15 files                                                                                                                 |
| Infrastructure safety/bounds/artifacts | 7 passed                                                                                                                             |
| API Playwright                         | 14 passed, seven per viewport, no retries/skips                                                                                      |
| Demo Playwright                        | 50 passed, 25 per viewport, no retries/skips                                                                                         |
| Demo/API production builds             | Passed, including bundle checks                                                                                                      |
| Backend syntax                         | 38 source files passed                                                                                                               |
| ESLint / Prettier / whitespace         | Passed after final documentation                                                                                                     |
| Preservation                           | 34 tables, 84 foreign keys, 60 CHECK constraints, 11 deferred triggers; 49 asset hashes and original schema/migration/seed unchanged |
| Hosted GitHub Actions                  | **Not executed**; workflow is uncommitted and no push/dispatch was authorized                                                        |

Application source and all 21 existing screens were preserved; browser regressions exercise their existing workflows. No financial model, seed, migration, runtime feature or dependency version changed. The fresh temporary cluster is stopped after validation; its ignored local evidence can be inspected without touching the original database.

## Security findings and remaining operations work

`npm audit` reported **6 affected package entries: 3 moderate, 3 high, 0 critical**. These include transitive counts, not six independent advisories. The chains are minimatch → @eslint/config-array / eslint (moderate, [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249)) and effect → @prisma/config / prisma (high, [GHSA-7589-6fvf-x4pw](https://github.com/advisories/GHSA-7589-6fvf-x4pw)). npm suggests ESLint 10.15.0 and a major Prisma change to 6.12.0. No automatic fix or incompatible downgrade was applied. These remain open dependency findings and the advisory step is intentionally nonblocking; maintainers should review supported upgrades separately.

The clean install also reported pending lifecycle-script approvals for Prisma engines, Prisma and fsevents under npm 11.17.0. Explicit Prisma commands succeeded locally; Linux first-install behavior remains part of the unverified hosted run. No global script allowlist was weakened. Official setup-node pins the project Node version; npm's bundled version and PostgreSQL maintenance image should be monitored.

CI does not establish production readiness. Outstanding work includes the first hosted Linux run, required-check configuration, dependency remediation, broader browser/device coverage, production secrets/identity recovery/monitoring, load testing and database operations. Artifact upload behavior and service cleanup on hosted cancellation remain unverified locally. No remote push, commit, deployment or Block 10C work was performed.

References: [GitHub PostgreSQL service guidance](https://docs.github.com/en/actions/use-cases-and-examples/using-containerized-services/creating-postgresql-service-containers), [Playwright CI guidance](https://playwright.dev/docs/ci), and the official action release refs recorded in the workflow comments. Local results above are separate from these configuration references.
