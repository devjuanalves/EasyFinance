# Block 10D — Identity security

Implemented on `feat/backend-10d`, 27 November 2026. This extends Block 10C; real email delivery remains unavailable. No external provider, production infrastructure or next block was introduced.

## Storage and compatibility

The forward migration `202611270001_identity` adds `email_verification_tokens`, `account_security_events` and `identity_rate_buckets`. The original 34 tables, original schema file, initial migration, seed and financial constraints remain unchanged. The total is 37 application tables plus Prisma migration history. Prisma now loads the schema directory; additive models live in `identity.prisma`. Their user foreign keys are SQL-enforced rather than Prisma relations, preserving the original schema byte-for-byte. Future migration diffs must preserve those SQL-only foreign keys and CHECK constraints. Never use `db push` to replace reviewed migrations.

CI bootstrap accepts only a freshly migrated, empty, explicitly acknowledged isolated database. Runtime grants add SELECT/INSERT/UPDATE on reset and verification tokens, SELECT/INSERT on security events, and SELECT/INSERT/UPDATE/DELETE on rate buckets. Runtime cannot update/delete audit events, truncate tables or migrate schemas. Migration/admin credentials remain separate.

## Recovery and verification

Reset requests use 32 cryptographically random bytes, persist only a purpose-prefixed SHA-256 hash and expire after 15 minutes. Verification links expire after one hour. A new request invalidates previous unused links. User-row locks serialize consumption across independent connections. Successful password reset atomically changes the Argon2id hash, consumes outstanding links, revokes all sessions and writes security events. There is no automatic login.

Verification binds the token to the user, intended address and original address. It cannot be used as a reset token. Email changes require an authenticated session and current password before issuance, remain pending until proof, then atomically update the email, invalidate outstanding links and revoke sessions. Unique-email conflicts roll back. Password changes invalidate pending proof links. Existing unverified accounts retain their current financial access for compatibility; verification is displayed honestly, not silently fabricated. A future production policy must decide whether verified ownership is mandatory for financial access/invitations.

## Delivery boundary

`identity-mail.js` provides a small message transport interface. Only an explicitly injected in-process transport with `kind: test` in test configuration is accepted. No environment flag enables a mailbox, no HTTP endpoint exposes captured messages, and no provider is configured. The deployed/default request boundary returns the same 503 `DELIVERY_UNAVAILABLE` for known and unknown addresses, before looking up the account. It creates no reset token and claims no delivery.

Test-only configured requests return the same neutral shape for known and unknown accounts. That test implementation does not claim timing-equivalent provider delivery: an eventual real adapter requires durable asynchronous dispatch, uniform request timing, retry policy, secret management, sender/domain configuration and delivery monitoring. A reported transport failure invalidates the generated token and records only a fixed audit action. Password-change and old-address notification delivery also remain unavailable.

Tokens use a fixed configured application origin, never the incoming Host header. Links carry proof in the fragment; React removes it from the address bar, retains it only in component memory, and requires an explicit POST confirmation. No local/session storage is used. API responses use no-store and no-referrer; HTML has a no-referrer meta policy. Production static hosting must also configure no-store for identity HTML. Identity browser tests disable traces because traces could capture proof requests; no token artifacts are authorized for CI upload.

## Endpoints

All routes use `/api/v1`, strict bodies, consistent `{data}` / `{error}` envelopes and existing origin/JSON/custom-header CSRF enforcement.

| Method | Route                | Body                       | Authentication/result                                         |
| ------ | -------------------- | -------------------------- | ------------------------------------------------------------- |
| POST   | `/auth/recovery`     | `email`                    | Public; neutral request or explicit unavailable               |
| POST   | `/auth/reset`        | `token`, `password`        | Public bearer proof; changed boolean                          |
| POST   | `/auth/verify`       | `token`                    | Public bearer proof; verified and signInAgain                 |
| GET    | `/auth/identity`     | None                       | Session; own email, verified, pendingEmail, deliveryAvailable |
| GET    | `/auth/events`       | None                       | Session; latest 50 own events, no arbitrary user selector     |
| POST   | `/auth/verification` | Empty object               | Session; request proof for current email                      |
| POST   | `/auth/email-change` | `email`, `currentPassword` | Session and password; request target-email proof              |

Invalid, expired or reused links return generic `INVALID_LINK`. Existing login/logout/session/password endpoints retain their opaque-cookie architecture. Workspace authorization remains database-backed and independent of verification UI. Demo authentication cannot authorize these routes.

## Audit and abuse controls

Account events record UUID, timestamp, nullable user UUID and a constrained action only. Unknown-identity failures omit user identity. No email, password, raw token, request body, IP or provider exception is stored in events. Login success/failure, password change, logout, reset, verification, email change and unavailable/failed delivery are durable. Successful security mutations and audit writes share the transaction; audit failure cannot silently authorize a successful credential mutation. Operational logs retain only allowlisted action, request ID and status.

API startup requires `IDENTITY_RATE_SECRET`: 32 random bytes encoded as 64 lowercase hexadecimal characters, shared across instances and never exposed as VITE configuration. CI bootstrap creates and masks a fresh value. HMAC-derived bucket keys avoid storing account addresses, raw proof or IP. PostgreSQL advisory transaction locking makes count/cap enforcement shared across processes. Limits are 1,000 requests per source IP and 20 per action/subject per 15 minutes, in addition to the existing per-process 60/IP and 10/email limits. Proxy headers are untrusted. The shared store fails closed. At most 10,000 buckets are created; expired buckets are removed in bounded batches of 100 per request, and an expired key resets even if not included in that batch. Rotating the secret resets effective windows and must be coordinated.

Audit/token retention requires an operator policy before production: proposed audit retention is 90 days and expired/consumed proof retention seven days, using bounded administrative deletion jobs. No background purge job or runtime audit-delete grant is introduced here. Audit history therefore grows until administrative retention is deployed. Shared-counter cleanup is implemented now.

## React and visual scope

Forgot password distinguishes demo simulation from API delivery unavailability. Supporting `/reset-password`, `/verify-email` and authenticated `/account-security` reuse AuthLayout, inputs, password controls, validation announcements and buttons. Settings links to account security. The account view shows verified/pending state, request controls and the current user's recent security events. Existing 21 screens remain intact. No dedicated approved exports exist for these supporting states; their layout is a provisional reuse of the established auth design, not a pixel-perfect claim.

Screenshots are ignored local artifacts in `test-results/block10d-layouts`, with separate desktop 1440×900 and mobile 390×844 captures for reset, invalid/reused proof and account security. Browser workflows exercise real credential changes through an isolated in-process test transport, replay rejection, verified status, login/onboarding and unavailable delivery. No external email is sent.

## Validation and remaining gates

Final executed results are recorded below after the validation run. Hosted GitHub Actions has not run for these uncommitted changes. Production remains blocked on email delivery and notifications, retention automation, deployment HTTPS/static-header policy, monitoring and alerting, provider timing/queue review, verification enforcement policy and an independent security review. This is not a production-readiness declaration.

Design review reference: [OWASP Forgot Password guidance](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html), consulted for proof lifetime/single use, generic responses and session revocation. Provider timing and post-change notifications remain explicitly unfulfilled production requirements.

### Final executed results

| Check                                         | Result                                                                                  |
| --------------------------------------------- | --------------------------------------------------------------------------------------- |
| Vitest                                        | 241 passed, 17 files; 0 failed/skipped                                                  |
| Live API/security                             | 152 passed, including 18 identity cases; 0 failed/skipped                               |
| PostgreSQL integrity                          | 31 passed; 0 failed/skipped                                                             |
| Restored-copy integrity                       | 31 passed; 0 failed/skipped                                                             |
| Offline database                              | 14 passed; 0 failed/skipped                                                             |
| Infrastructure                                | 8 passed; 0 failed/skipped                                                              |
| Demo Playwright                               | 50 passed, 25 per viewport; 0 failed/skipped                                            |
| Real-API Playwright                           | 16 passed, eight per viewport; 0 failed/skipped                                         |
| Final identity screenshots/copy rerun         | 2 passed, one per viewport                                                              |
| ESLint / Prettier / backend syntax            | Passed                                                                                  |
| Demo and API production builds                | Passed; both bundle scans exclude React development markers and server-secret sentinels |
| Prisma validate / generate / migration status | Passed; two migrations current                                                          |
| API health/readiness/startup/shutdown         | Passed                                                                                  |
| npm audit                                     | 0 known vulnerabilities in all severity categories                                      |
| Preservation                                  | All 49 authoritative assets and five original database foundation files match baseline  |
| Git whitespace / changed-file secret scan     | Passed                                                                                  |

Live checks used a newly created PostgreSQL 18.7 cluster on loopback port 55432 with fresh random credentials and explicit disposable acknowledgements. The existing developer database on 5432 was not modified. An additional fresh-database upgrade rehearsal applied the original schema, loaded the unchanged fictional seed, then applied the new SQL: hashes of every original table's rows and all original constraint definitions remained identical. Backup/restore independently compared all table row hashes, constraints and triggers, then ran the 31 integrity tests on the restored copy. No database was reset or dropped.

Initial validation found a Prisma `void` result from the advisory-lock query (fixed by explicit text cast), an expiry test fixture violating the existing timestamp constraint (fixed by moving both timestamps), and stale React state when reopening proof links (fixed with explicit hash-navigation handling). Assertions were retained. Two existing auth UI tests timed out during simultaneous browser/unit execution; the subsequent complete isolated validation run passed all 241 without assertion or timeout changes. No failed or skipped check remains in the final runs. Local socket tests required sandbox escalation. Non-fatal Node/pg deprecation and terminal-color warnings remain; hosted CI, other browser engines and real devices were not exercised.

Six final identity captures were visually inspected for the established logo, neutral/orange palette, legible controls, errors, wrapping and scrollable account history. Mobile document overflow and browser page-error checks pass. The API-mode recovery panel accurately describes real proof handling and unavailable email delivery; demo wording is preserved in mock mode.

CI workflow YAML and action pins are unchanged. The existing database bootstrap now provisions only the additional reviewed grants and generates/masks the shared limiter secret through `GITHUB_ENV`; existing jobs discover the new suites and migration. No remote workflow result is claimed. Dependencies and lockfile are unchanged in this block. The work is ready for code review and a user-authorized commit followed by hosted CI, subject to the documented production blockers. Nothing was staged, committed, pushed or deployed; Block 10E was not started.
