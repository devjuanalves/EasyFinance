# Settings, collaboration and automations — Block 6

## Routes and shared architecture

- F19 `/settings`: personal profile/preferences, workspace configuration, truthful security controls and deletion confirmation.
- F20 `/settings/sharing`: members, role matrix, invitations and session activity.
- F21 `/settings/automations`: recurring draft/reminder/financial-review configuration, explicit simulations, notification preferences and execution history.

The existing AppShell, auth identity, financial store, invoice services, native AppDialog and navigation remain in use. Settings is accessible from the sidebar/mobile drawer and profile dialog. The header bell opens the shared notification center. The bottom navigation retains Home, Dashboard, Income, Expenses and Investments.

`settingsService.js` seeds session users, memberships, invitations, automation rules/runs, notification preferences/events and activity records alongside the existing financial snapshot. `createFinancialStore` dispatches `settings:*` commands and publishes validated snapshots. Financial edits continue through the existing Income, Expenses and Investments services. No second ledger, database, migration, dependency or financial endpoint was introduced.

The authenticated demo user owns the two existing demo workspaces. Sam is a fictional Editor and Casey a fictional Viewer of Personal Finance only. Open the profile menu and use **Demo identity (explicit simulation)** to inspect these identities and accepted invitees. This is a controlled test mechanism, not another authentication provider or verified login. Profile fields and preferences are keyed by user ID; financial context is keyed by workspace. Reload/sign-out clears everything.

## Personal and workspace settings

Personal name, language, primary currency, date/number format, time zone and financial-month start can be saved or cancelled. Name, supported options and month start (1–28) are validated. Email is read-only. Initials are used rather than avatar storage. Profile updates appear in the shell/profile menu and Settings for the same session identity. Router navigation, workspace/identity switches and sign-out respect unsaved changes; beforeunload also warns.

Exact display limitations: language is stored but the UI remains English. Date/number formats apply to the live preview and member/invitation dates; older financial modules retain their established formatters. Automation schedule dates remain explicit ISO calendar dates and activity timestamps retain ISO UTC. Personal time zone and month start are stored metadata and do not redefine the fixed sample reporting periods. The primary currency can explicitly select the existing AUD/EUR/USD native financial filter; other onboarding currencies are retained as preferences, without unsupported filtering or FX. No amounts or historical dates are rewritten.

Only the Owner can change workspace name, type, base currency or time zone. These settings are independent of personal preferences and do not convert accounts, invoices or holdings. The current workspace name updates the shared selector/breadcrumb. Sign-out uses the existing auth service. Password changes, 2FA and remote-session management show unavailable explanations. Only the current simulated identity is displayed; devices, locations and successful security operations are not invented. Account-deletion confirmation neither deletes records nor sends a request.

## Permissions and isolation

| Role   | Financial reads | Financial edits | Workspace, members and shared automations | Own preferences |
| ------ | --------------- | --------------- | ----------------------------------------- | --------------- |
| Owner  | Yes             | Yes             | Yes                                       | Yes             |
| Editor | Yes             | Yes             | No                                        | Yes             |
| Viewer | Yes             | No              | No                                        | Yes             |

`permissions.js` derives the role from active membership, ignoring caller-supplied role claims whenever memberships exist. Existing low-level financial services and the shared command entry point enforce this model. The legacy role-context fallback remains for earlier standalone fixtures without membership entities; the mounted application always seeds memberships. This is frontend/mock validation, not production security or protection against someone editing browser memory.

The workspace selector lists only authorized workspaces and rejects unauthorized selections. `scopedFinancialData` filters workspace entities and dependent invoice/payment/investment records before exposing the ledger to screens. Assistant histories also separate user and workspace. A removed identity sees No Workspace Access rather than stale financial content. Financial records, creator references, valuations and earlier activity survive revocation. The Owner cannot be removed, demoted or created through invitations; ownership transfer is outside scope.

The permission compatibility regression is fixed without changing old assertions: denied financial edits retain **read-only** in their error. Missing membership instead reports **workspace access is unavailable**, and owner-level actions report **Owner access is required**. Direct-service tests exercise spoofed owner roles, Viewer edits and revoked/foreign workspace access.

## Invitations and members

Email is trimmed/lowercased and validated; an existing active member or pending invitation prevents duplication. Invitations grant Editor or Viewer only. Pending records do not grant access. Explicit Owner-controlled **Simulate Acceptance** creates/reactivates a separate fictional identity and membership; it does not verify email ownership. Resend refreshes a pending/expired invitation without duplicate membership. Revoked invitations cannot be resent or accepted; a fresh invitation is required. Accepted invitations cannot be accepted twice. Expiration is evaluated against the fixed sample accounting date, 31 October 2026, not the review date.

Member role changes apply immediately to subsequent mock commands. Removal requires confirmation. Destructive controls reuse existing secondary/text buttons with the established red warning color and pale warning surface. Session activity logs contain actor/workspace/entity IDs, event type and timestamp; they contain no passwords or tokens and are not durable audit logs.

## Automation configuration and execution

Owner-only automation types are recurring invoice drafts, internal invoice reminders and reviewable financial alerts. Editors/Viewers can inspect configurations but cannot modify or execute them. Rules retain name, related client/template or invoice, weekly/fortnightly/monthly frequency, next occurrence, time zone, active/paused status and review mode. Custom schedules and client-facing delivery are not implemented. An active rule is Scheduled, not a completed execution. Empty configuration is the initial state; displayed counts derive from actual rules/runs.

The existing RecurringTemplateForm creates templates in the shared invoice store. Draft simulations use existing `blankInvoice`, `applyIncomeCommand('saveInvoice')`, item calculations and validation. They produce an ordinary draft visible in Income and update the template's prepared dates. When the template next date matches the executed occurrence it advances with the configured automation. A different rule cannot prepare the same template occurrence again. No payment, sent status or received income is created.

**Simulate Next Occurrence** requires explicit confirmation and a due date no later than the sample accounting date. Successful runs use `(automationId, scheduledDate)` idempotency, and Retry Same Occurrence reuses that result. Template prepared-date guards also prevent duplicates across rules or the existing manual template preparation flow. Paused/deleted rules cannot execute. Failed simulations record the error without reporting successful delivery; a corrected configuration can retry the due occurrence. Deleting a configuration preserves runs and invoices.

Weekly/fortnightly dates advance 7/14 calendar days. Monthly dates advance one calendar month and clamp to the target month's last day; the clamped day becomes the next cycle's day. Schedules are date-based in the displayed zone, without a clock-triggered worker, timezone conversion or DST scheduling. The existing Block 3 standalone template workflow retains its documented 7/30/90-day convention. Automation configuration is the schedule authority for its explicit simulations.

Before/on/after-due reminders validate the occurrence against the related billed, unpaid invoice. Paid/cancelled/draft invoices are rejected. Successful reminder simulations may produce an internal notification according to preferences; they never contact a client, reconcile a bank transaction or record payment. Financial alerts request review of the Dashboard. Manage Rules navigates to the existing Categories & Rules page without rewriting priorities or manual overrides.

## Notifications and preferences

The bell shows actual stored events for the selected user and authorized workspace, with unread count, Mark as Read, Mark All as Read and related-record navigation. Events use minimal descriptive text. Another identity cannot read/mark these notifications. Revoked workspace access hides that workspace's notifications as well as its finances.

Connected event producers: accepted demo invitations, role changes, explicit financial-alert/reminder/draft simulations, confirmed statement imports, invoice payment/bank-match commands, manually prepared recurring drafts, investment movements and valuation updates. A successful command creates only the matching event and never changes ledger calculations through the notification path. Recipient preferences can suppress each event.

Five categories are explicitly labelled **saved preference only; event generation is not connected in this demo**: transactions requiring review, potential duplicates, uncategorized transactions, portfolio review reminders and access-revocation notifications. Their options are retained for future integration; no automatic monitoring is claimed. Account security event generation is unavailable.

Email controls are disabled. Immediate delivery means adding an in-app record in this session. Daily/weekly schedules, preferred time and zone are stored configuration only: they suppress immediate delivery, and there is no queue, digest or background scheduler. No operation runs while the app is closed.

## Financial preservation and future integration

Preference, membership, reminder and notification changes do not modify ledger amounts, splits, exclusions, transfer handling, payments/allocations or investment formulas. Invoice preparation adds billed drafts only, not received money. The same Home/Dashboard selectors remain in use. Tests compare unchanged transactions, payments and valuations after settings changes, revocation and simulations.

A future backend must derive identity server-side, authorize every read/write, persist users and memberships, verify invitation acceptance with expiring hashed tokens, enforce atomic idempotency and invoice uniqueness, and provide real session/security operations, delivery providers and an audited scheduler. No production security, persistence, external messaging or background execution exists here. See [Block 6 visual review](design/BLOCK6_VISUAL_REVIEW.md) for responsive references, deviations and executed validation.
