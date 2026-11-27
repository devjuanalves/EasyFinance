# Block 1 authentication frontend

## Routes and service boundary

- `/login`: validates email/password, supports show/hide and a nonpersistent remember-me demo preference. Only the exact documented demo credentials succeed.
- `/signup`: requires name, valid email, a minimum 12-character password, matching confirmation and unchecked-by-default demo acknowledgment. Successful simulated registration immediately enters onboarding. No record is created and that email/password cannot be used for a later login.
- `/forgot-password`: validates email and simulates a request with loading, failure and neutral confirmation. No real email is sent. The blueprint's token, new-password and expired-link states are intentionally outside this request-only mock implementation.
- `/onboarding`: requires a simulated registered user. Four steps collect profile/language, workspace name/type, currency/date format/timezone, then review. Back preserves edits. Defaults are centralized, editable development choices (AUD, DD/MM/YYYY, Australia/Sydney). Shared type is a preference only; invitations/permissions are deferred.
- `/`: existing development Home placeholder; requires a completed demo session. Shows selected preferences and the unchanged API liveness result. Sign out clears session state.

`features/auth/services/authService.js` owns all simulated decisions and an in-memory session. `useAuth` subscribes through React's external-store hook. Pages call signIn, signUp, requestPasswordReset and completeOnboarding; session access and signOut use the same boundary. A real API must replace these operations and enforce authentication/authorization on the server. Route guards provide navigation only.

Vite development enables the mock. Production builds disable it unless explicitly built with `VITE_AUTH_MODE=mock`. This flag is public and is not security. No credentials are sent to the health API. No passwords, tokens or user preferences are written to localStorage/sessionStorage, logs, cookies or a database. A full reload loses the session; remember-me records intent only.

## Deterministic scenarios

| Scenario             | Input                                                                                 | Result                                                                           |
| -------------------- | ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Login success        | `alex@example.com` / `EasyFinanceDemo!`                                               | Completed simulated session; Home placeholder                                    |
| Login failure        | Any other credentials                                                                 | Generic incorrect-credentials error                                              |
| Registration success | Valid fields, a different demo email, matching 12+ character password, acknowledgment | Ephemeral user; onboarding                                                       |
| Registration failure | `alex@example.com` or `error@example.com`                                             | Generic simulated registration failure                                           |
| Recovery success     | Any valid email except the error scenario                                             | Identical neutral confirmation for known/unknown email; explicitly no email sent |
| Recovery failure     | `error@example.com`                                                                   | Simulated service unavailable; retry allowed                                     |

Use fictitious data. The demo fixture is public test data, not a secret. The password policy is deliberately length-only (12 characters, taken from the signup reference); no arbitrary uppercase/number/symbol requirement is imposed.

## Shared components and accessibility

AuthLayout includes responsive branding, content and footer. InputField, PasswordField, PrimaryButton and FormError share styling and semantics. SessionRoute centralizes guest/completed/onboarding navigation. InfoDialog uses the native modal dialog for focus containment, Escape dismissal and focus restoration. Icons are decorative; form labels, errors, password toggles and loading states have accessible relationships. Invalid submission focuses the first invalid field; onboarding step changes focus the step title. Reduced motion is respected.

Google/Apple controls are intentionally disabled with a visible explanation because no OAuth backend exists. Support opens demo instructions. Terms/privacy controls open an honest unavailable-document notice; the consent checkbox acknowledges the demonstration rather than claiming acceptance of nonexistent production terms.

## Tests and preview

```sh
npm run dev
npm run check
npx playwright install chromium
npm run test:e2e
```

Open `http://localhost:5173/login`. Use localhost consistently with the default CORS configuration. The browser suite starts/stops both servers unless an existing server is already running. Stop any unrelated process on these ports before testing.

Vitest covers 28 checks across API, mock-service contract and UI interactions. Playwright runs two end-to-end scenarios at each required viewport (four tests), saving eight page images under ignored `test-results/auth-layouts/`. It checks real lifecycle/navigation, loading, visibility, modal keyboard behavior, refresh guards, empty local/session storage, API status, horizontal overflow, loaded images and browser errors. CI installs Chromium and runs both suites; remote CI execution has not been triggered by this task.

Onboarding screenshots are provisional visual evidence. See [reference comparison](design/BLOCK1_VISUAL_REVIEW.md). No final financial Home, database schema, email provider or real authorization was introduced.

## Block 10D identity extension

Block 10D adds password-reset and email-verification proof lifecycles, account security events, shared database throttling and supporting React forms. Real email delivery remains explicitly unavailable; only isolated in-process test transports are supported. The original 34-table foundation is preserved with three additive identity tables. API startup now requires the server-only `IDENTITY_RATE_SECRET`; fresh CI bootstrap generates it. See [Block 10D identity security](BLOCK10D_IDENTITY_SECURITY.md) for contracts, migration/grants, security boundaries, validation results and production blockers. Prior block reports are historical results, not evidence for this block.
