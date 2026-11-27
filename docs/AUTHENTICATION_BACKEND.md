# Block 9A authentication

18 November 2026. Real authentication is available only in explicit local API mode. Existing development mock authentication remains a separately labeled demonstration and never authorizes database operations.

## Passwords and registration

Node 24's native asynchronous `crypto.argon2` runs Argon2id with 19,456 KiB memory, two passes, parallelism one, 16 random salt bytes and a 32-byte result. PHC-style encoded hashes retain algorithm/version/parameters/salt. Verification uses constant-time digest comparison; an unknown or disabled identity still performs derivation. At most four derivations run simultaneously in a process. Passwords are 12–128 characters, without arbitrary composition rules. No plaintext password, token or hash is returned/logged.

The parameters follow the [OWASP password storage guidance](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html); the implementation uses the [Node 24 Argon2 API](https://nodejs.org/docs/latest-v24.x/api/crypto.html#cryptoargon2algorithm-parameters-callback), available in the installed Node 24.19.0. Review runtime API stability and parameter benchmarking when upgrading or deploying; no new password package or dependency was added.

Email is normalized to lowercase/trimmed. Registration returns the same neutral 200 response for new/existing email, performs password hashing in either case and does not create a session. The UI proceeds to sign-in. Login failure is generic. Email ownership is **not verified** in this local slice; do not expose registration publicly without the deployment controls below. Tests create fictional `example.test` identities with development-only credentials; the original disabled Block 8 seed remains unchanged.

## Sessions

Login creates 32 cryptographically random bytes encoded as hex. Only SHA-256(token) is persisted in `auth_sessions`. Browser delivery uses `ef_session`, HttpOnly, SameSite=Strict, Path=/api/v1, no Domain. Secure is mandatory in production configuration; HTTP development explicitly omits it. Remember-me sets a seven-day cookie/server lifetime. Otherwise the cookie is browser-session scoped and server expiration is twelve hours. Browser session restoration does not extend server expiration. There is no local/session storage token. Query caches are cleared when the real session ends or cannot be validated.

Current-user requests validate session expiration, revocation and active user status. Mutating or reading protected domains rechecks session validity in the operation transaction. Login issues a fresh token rather than accepting a caller token. Logout revokes the current session and clears its cookie; replay is unauthorized. Authenticated password change locks the user, verifies the current password, changes the hash and revokes **all** sessions in one transaction. The browser returns to login. A separate sessions-management screen is not implemented; revocation is available through logout/password change and the persisted session model.

## Browser defenses

All versioned mutation routes, including register/login, require exact configured Origin, JSON Content-Type and `X-EasyFinance-CSRF: 1`. The custom header forces cross-origin preflight; credentialed CORS grants only `WEB_ORIGIN`. SameSite=Strict adds defense in depth. Vite proxies `/api` to the local API so cookies are same-origin. No permissive Origin fallback, wildcard credentials or token in URL is used. Trust proxy remains off; production proxy hop/IP policy needs explicit review. GET requests do not mutate domain data.

Auth attempts share a 60-per-IP / 15-minute limit and 10-per-normalized-email / 15-minute limit (register/login/recovery); email keys are hashed, maps bounded to 10,000 live entries and expired entries removed. Password change uses the IP limiter. Capacity and limit errors return 429 with retry guidance. This process-local limiter is not a distributed defense and does not survive restart. Tests verify limits and clock-driven expiry without sleeps.

Errors use safe code/message/request-ID envelopes. Credential/SQL details never appear in client errors or application error logs. Unique conflicts, authorization, validation, data unavailability and unexpected errors are mapped centrally. Development health remains available independently of database readiness.

## Unavailable identity features

Recovery returns an explicit 503 `RECOVERY_UNAVAILABLE` and states that no email was sent; no reset credential/token is exposed. Google/Apple remain unavailable. No fictitious delivery, email verification, MFA, production terms acceptance, security-device history or password breach screening is claimed. Local development account consent remains a development acknowledgment. The profile dialog in API mode includes a real password-change form; other Settings controls remain labeled demonstration operations.

Before deployment: verify email/invitation ownership, recovery-token delivery and replay controls, TLS/secure cookie routing, content security policy, CSRF/CORS/proxy assumptions, distributed throttling, password/hash upgrade policy, MFA, security notifications, secret/session rotation and deletion/retention policies. Passing local tests is not production-security certification.

## Block 9B.4 invitation and membership review

Existing opaque session/CSRF/role mechanisms protect all collaboration endpoints. Invitations use 256-bit random tokens with SHA-256 hashes, seven-day expiry, normalized-email binding, single-use acceptance, workspace serialization and atomic audit. Pending invites confer no access; accepted-token replay cannot reactivate revoked membership. Only Owners manage invitations/members/shared automation settings; Owner removal is protected. Token handoff is explicitly local and displayed once, never sent as claimed email. Verified email ownership and production distributed abuse controls remain unresolved. No automation executes under a revoked identity because no execution endpoint or worker exists. See BLOCK9B4_COLLABORATION_AUTOMATIONS.md for tests and limits.

## Block 10C security review

Opaque sessions, Argon2id, strict cookies, CSRF and server-side membership checks are preserved. Authentication outcome logs now use a fixed action/status/request-ID allowlist, without account identifiers or credentials. Proxy trust is explicitly disabled. Recovery still returns the same unavailable response for known/unknown accounts and generates no token; no email provider or verification lifecycle was added. Existing reset-token fields alone do not establish a safe delivered and durably audited recovery flow. See [Block 10C](BLOCK10C_SECURITY_OPERATIONS.md) for lifecycle requirements, tested boundaries and production blockers.
