# Block 9B.4 collaboration, settings and automations

## Contract inventory — prepared before implementation

Prefix `/api/v1`. Existing session, CSRF, strict JSON and error conventions apply. F19 Settings, F20 Sharing and F21 Automations remain the presentation targets. Source: Draw.io sharing/permission model, F19–F21, DB02/DB08/DB09 and existing Settings workflows.

| Operation               | Route                                        | Input / result                                                                           | Authorization and transaction                                                                                      |
| ----------------------- | -------------------------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Read settings           | GET /workspaces/:wid/settings                | Workspace, own profile, members, safe invitations, configurations, actual runs and audit | Active member; no other user's preferences or invitation secrets                                                   |
| Save own profile        | PATCH /workspaces/:wid/settings/profile      | fullName, preferences                                                                    | Own identity only; user/workspace lock, atomic audit                                                               |
| Save workspace          | PATCH /workspaces/:wid/settings/workspace    | name, type, baseCurrency, timeZone                                                       | Owner; currency immutable in this slice; atomic audit                                                              |
| Invite                  | POST /workspaces/:wid/invitations            | email, role editor/viewer; one-time local token response                                 | Owner; workspace lock, unique pending email; no email delivery                                                     |
| Accept                  | POST /invitations/accept                     | token                                                                                    | Authenticated matching email; token possession, expiration, workspace lock, single use and atomic membership/audit |
| Revoke invite           | POST /workspaces/:wid/invitations/:id/revoke | empty                                                                                    | Owner; scoped record; repeat safe                                                                                  |
| Change/remove member    | PATCH /workspaces/:wid/members/:id           | role editor/viewer, status active/revoked                                                | Existing Owner-only route; owner protected; atomic audit                                                           |
| Save automation         | POST /workspaces/:wid/automations            | id UUID, name, type, frequency, nextDate, timeZone, status, invoiceId?, timing?          | Owner; scoped target, strict configuration; UUID creation retry                                                    |
| Edit/archive automation | PATCH /workspaces/:wid/automations/:id       | same configuration without id plus updatedAt                                             | Owner; optimistic timestamp and workspace lock; archive preserves history                                          |

Automations are configuration-only in API mode. The existing implementation has no worker, durable job dispatcher or approved timezone execution policy. No execution endpoint is introduced: disabled and enabled configurations both perform no financial actions. Next preparation date is a date in the selected zone, not a promised execution timestamp. Actual stored run history is read without fabricating runs. Financial alerts and invoice-reminder configurations are supported; recurring invoice drafts require the deferred persistent template service and are explicitly unavailable. No scheduler, email, client delivery or financial mutation is implied.

Invitation tokens are 32 random bytes, SHA-256 hashed at rest, expire in seven days, and are returned only once to the inviting Owner for explicit local handoff. Acceptance requires an authenticated account with the exact normalized invited email and possession of the secret. Account email verification/provider delivery remains a production dependency; local token handoff must reach the intended recipient through a trusted channel. Tokens never appear in listing, audit metadata, routes or logs. Acceptance repeats by the same user return the existing membership only while that membership remains active; they cannot reactivate revoked access.

## Validation

This inventory preceded implementation. Executed results are recorded below.

## Implemented boundaries

F19, F20 and F21 reuse their existing components and responsive CSS through `PersistentSettings.jsx`. API mode supplies server-derived roles, records and asynchronous commands; demo mode retains the existing session workflows. An explicit persistent workspace selector preserves selection across Settings tabs. Unsupported or inaccessible workspace IDs never fall back silently. Loading, request failures, validation feedback, native dialogs, profile unsaved-change protection and refresh persistence remain supported.

F19 persists name, supported language/currency/format preferences, IANA time zone and financial-month start (1–28), independently of workspace metadata. The workspace Owner can update name/type/time zone. Base currency is deliberately locked in this slice rather than interpreting a change as conversion. Personal currency is a preference, never an FX operation. Password change reuses Block 9A; deletion, avatar uploads, 2FA and remote device management remain unavailable.

F20 displays active/revoked members, role descriptions, pending/historical invitations and recorded activity. Owners prepare/revoke local invitations, change Editor/Viewer roles and remove members with confirmation. Owner changes remain protected. A recipient accepts a token while signed in; first-time accounts can complete onboarding before opening Sharing. Acceptance is not simulated and does not trust any browser role or user ID. Expired pending records are retired when preparing a fresh invite. There is no resend endpoint: revoke and prepare a fresh secret. If the one-time preparation response is lost, revoke the pending invitation and prepare another.

F21 persists financial-alert and issued-invoice-reminder configurations, including weekly/fortnightly/monthly frequency, date, IANA time zone, reminder timing, active/paused state and archive state. Reminder targets must be issued invoices in the same workspace. This is configuration validation, not a claim that a reminder has been delivered. Recurring invoice draft/template persistence is deferred; its existing demo-only control is disabled in API mode. Archived configurations retain their runs and audit history. Read details use the Settings snapshot; no unneeded generic automation framework was added.

Own notification preferences persist through `PATCH /workspaces/:wid/settings/notifications`: `enabled` keyed by the shared event inventory, `frequency` immediate/daily/weekly, `time` HH:mm and `timeZone`. `NotificationPreference` rows are scoped to the authenticated user/workspace/channel; the user's preference JSON stores the notification time zone. Profile saves preserve that unrelated preference. Email, digest delivery and API-mode event generation remain unavailable. The shell notification center remains explicitly part of the demonstration shell, not a persisted inbox.

## Authorization, atomicity and concurrency

| Action                                                 | Owner       | Editor      | Viewer      |
| ------------------------------------------------------ | ----------- | ----------- | ----------- |
| Read Settings, members, configuration and history      | Yes         | Yes         | Yes         |
| Edit own profile/notification preferences              | Yes         | Yes         | Yes         |
| Edit workspace, invite/revoke/change/remove member     | Yes         | No          | No          |
| Create/edit/pause/resume/archive shared configurations | Yes         | No          | No          |
| Execute automation                                     | Unavailable | Unavailable | Unavailable |

Invitation listings are Owner-only within the Settings snapshot. Member DTOs contain names/contact/role/status, never passwords, sessions or personal preferences. The older `/members` endpoint retains its Owner-only contract. Active membership is resolved in PostgreSQL on each request; cookies and CSRF protection are unchanged. Client role fields and unknown request keys are rejected. Owner membership is protected both in the service and by the original database constraints.

All mutations use `withActor`, revalidate the session, lock the workspace and atomically write their audit event. The same workspace lock orders invitation acceptance, member changes and financial operations. Concurrent acceptance creates one membership and one acceptance event; replay cannot restore revoked membership. The existing pending-email unique index adds a database guard. Independent runtime connections exercised the race, not merely parallel promises on one transaction.

Automation creation uses a caller-generated UUID and an exact configuration comparison for retry. The comparison is independent of JSONB key ordering. Changed input under an existing UUID conflicts. Edits carry the original `updatedAt` timestamp; concurrent or stale edits conflict. Archive is an update, never deletion. No execution endpoint, automatic financial write, timer, scheduler or fabricated run exists, so execution idempotency and concurrent execution are not claimed. A future worker needs separately reviewed timezone/DST semantics, occurrence idempotency, retry/outbox policy, current authorization and existing financial service reuse.

## Runtime privileges and preservation

`database/scripts/collaboration-runtime-grants.js` verifies the exact approved disposable target `127.0.0.1:5432/easyfinance_block8_test`, its owner and the restricted `easyfinance_9a_app` role before applying grants. Added SELECT/INSERT/UPDATE on workspace_invitations, automation_rules and notification_preferences; SELECT only on automation_runs. No DELETE, TRUNCATE, execution-write, ownership, CREATE or superuser privileges were added. Existing user/workspace/member/activity privileges are reused. This script is an explicit administrator operation, never API startup.

Read-only catalog inspection confirmed **34 domain tables**, **84 foreign keys**, **60 CHECK constraints** and **11 deferred constraint triggers**. Prisma schema, original applied SQL migration and seed match HEAD bytes. Migration status is current. All **49 authoritative assets** match their manifest SHA-256 hashes. No reset or seed recreation was performed for this block. Tests add fictional isolated identities/workspaces through the established disposable test safeguards.

An initial diagnostic counted only the 24 tables visible through the restricted role's information_schema and hit Prisma's unsupported PostgreSQL char decoding. The corrected catalog query counted all 34 tables and explicitly cast constraint type to text; no schema change was needed.

## Security review and limitations

Opaque hashed sessions, HttpOnly/SameSite cookies, production Secure defaults, exact-origin/custom-header CSRF, strict input validation and server-side tenant authorization remain in force. Invitation acceptance additionally uses the existing process-local rate limiter. Secrets occur only in the one-time preparation response and the acceptance request body; they are excluded from URLs, normal listings and audit metadata. Browser-held demo identities cannot authorize these endpoints. No secrets were added to tracked source/configuration.

This is local development functionality, not production readiness. Trusted local token handoff is not verified email delivery. Registration still lacks provider-backed email verification. Production requires HTTPS deployment validation, verified email ownership/delivery, shared rate limiting, abuse controls, operational monitoring, retention, backup/recovery and a separately approved execution architecture. Audit writes are transactionally consistent but not an external tamper-proof archive. Application scoping remains essential; database row-level security is not claimed.

Snapshot reads are bounded: 500 members/configurations, latest 100 invitations/runs/audit events; activity UI shows the latest 20. Reminder selection currently loads at most 100 invoices per supported currency. Pagination/search for larger workspaces and a persistent notification inbox remain future work. Notification preferences do not promise event generation, scheduled delivery or a digest.

## Executed validation — 24 November 2026

| Check                               | Result                                                     |
| ----------------------------------- | ---------------------------------------------------------- |
| Full live API/security suite        | 119 passed: 98 existing + 21 collaboration cases           |
| Live database integrity             | 31 passed                                                  |
| Offline database checks             | 14 passed                                                  |
| Vitest                              | 221 passed, 14 files                                       |
| Demo Playwright                     | 50 passed                                                  |
| Real API Playwright                 | 10 passed: previous 8 + 2 collaboration viewport workflows |
| Prisma validation/generation        | Passed                                                     |
| Migration status                    | Up to date, one original migration                         |
| Production demo/API builds          | Passed                                                     |
| ESLint / Prettier / dependency tree | Passed                                                     |
| API health                          | `ok`, `easyfinance-api`                                    |
| Source/asset preservation           | Original schema/migration/seed bytes and 49 hashes match   |

Final targeted reruns passed all 21 collaboration API cases and both collaboration browser viewport workflows after the last validation/copy refinements. Targeted reruns are verification of the same tests, not additional distinct coverage. New API cases cover real authentication/CSRF, Owner/Editor/Viewer enforcement, own preferences, locked currency, token hashing/expiry/revocation/email binding, pending access denial, duplicate invites, independent-connection acceptance, last-owner protection, removal/replay rejection, configuration retries/stale edits/invalid targets, cross-workspace IDs, recipient notification ownership, minimal privileges, audit rollback and preservation of an existing cash transaction. Actual background execution is unavailable and therefore not tested or claimed.

Browser workflows verify profile refresh, local invitation preparation/acceptance, Viewer restrictions, automation pause/refresh, notification preference save, removal/revocation and logout at 1440×900 and 390×844. The first attempts exposed two test locator errors (shared status roles and sign-out location) and a date-only presentation issue; corrected runs passed without sleeps or weakened assertions. Console/page errors and horizontal overflow checks pass.

## Visual review

References: all six original exports in `docs/design/frames/06-settings/`, as mapped by FRAME_INDEX.md: `7. Perfil e configurações.svg` and `-1`; `7. Compartilhamento de conta e permissões.svg` and `-1`; `7. Automações e notificações-1.svg` (desktop) and unsuffixed mobile. Bounded local Chromium renders were inspected after a full-size SVG capture timed out. No source asset was edited.

Screenshots are ignored artifacts under `test-results/block9b4-layouts/`: desktop/mobile `f19-settings`, `f20-sharing`, `f21-automations` and `f21-editor`, each with a matching viewport capture. API and demo runner outputs remain separate. Existing layout conventions, official logo, orange accents, profile/security columns, member tables/mobile cards, role cards, automation metrics and preference groups are retained. Persistent workspace selection, local handoff and truthful unavailable states add height. No fictional avatar/device verification, delivery, AI engine, job success or bank sync is copied from the artwork. Dates are adapted to the existing date-only formatter. Font identity, missing interaction-state designs and pixel-perfect approval remain unconfirmed. Chromium desktop/mobile checks do not substitute for other browsers or physical-device validation.

Block 9B.5 has not started. Changes remain uncommitted.
