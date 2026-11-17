# Block 6 visual and interaction review

Reviewed 15 November 2026 (Australia/Sydney). This supplements the preserved Block 1–5 reviews.

## Authoritative references

All six principal local exports are available in `frames/06-settings/`:

| Screen | Desktop                                                     | Mobile                                                       |
| ------ | ----------------------------------------------------------- | ------------------------------------------------------------ |
| F19    | `7. Perfil e configurações.svg` — 1296×1957                 | `7. Perfil e configurações-1.svg` — 414×1723                 |
| F20    | `7. Compartilhamento de conta e permissões.svg` — 1296×1669 | `7. Compartilhamento de conta e permissões-1.svg` — 414×1320 |
| F21    | `7. Automações e notificações-1.svg` — 1296×3364            | `7. Automações e notificações.svg` — 414×1577                |

Functional sources: Draw.io page 06, F19–F21, workspace/membership/invitation dictionaries, automation rules/runs, notifications/preferences, activity logs, ER map and screen-to-table mapping. All six source SVGs were rendered and inspected locally. No Figma connector was available; no assets were downloaded, generated or replaced.

## Comparison and deliberate differences

The existing official logo, warm-neutral shell, sidebar, header, bottom navigation, typography fallback, orange accents, rounded cards, inputs and native AppDialog are preserved. No alternate “Fiscal Engine” branding or new sidebar was adopted. The Settings link now aligns its existing icon/text and shows the established active navigation treatment. These rules target only the new Settings link; `workspace.css` is unchanged. Primary action sizing and spacing are scoped to Settings; notification positioning targets only the bell button.

- F19 retains desktop profile/preferences/workspace cards with a security/actions column; mobile stacks these sections. Initials replace avatar uploads. Real-device inventories, verified-email claims, enabled 2FA, automatic FX and tax configuration are omitted. Explicit preference scope and security limitations add text/height. Formatting is demonstrated where supported, not asserted across older modules.
- F20 retains the workspace summary, member table/cards, role overview and invitations. Three actual fictional memberships replace artwork metrics. Roles and actions follow the centralized mock model; no banking credentials, tax-report exports or cryptographic audit claims are shown. Mobile role cards stack rather than requiring horizontal swipes. Pending and expired sample invitations remain visibly labelled.
- F21 retains grouped metrics, workflows, reminders, classification navigation, notification preferences and execution history. One shared editor configures drafts/reminders/review alerts. Initial state has no fabricated executions. Captures show a user-created review alert. The original live bank/AI/scheduler/email claims are replaced by explicit manual simulation. Email is disabled and unsupported event producers/digest configuration are labelled. All preference groups remain readable on mobile, making the page longer than the compact export.

The six principal reference pairs are complete. Exact typography, independent editor/error/confirmation exports and final visual approval remain outstanding. Wrapped Settings tabs preserve access to all routes without horizontal page overflow. The existing bottom navigation remains intact; Settings is available through the drawer/profile entry points. This is a meaningful visual comparison, not pixel-perfect approval.

## Screenshots and interaction inspection

Chromium captured each principal target independently at **1440×900** and **390×844**. Ignored artifacts are under `test-results/block6-layouts/`:

| Screen | Desktop                       | Mobile                       |
| ------ | ----------------------------- | ---------------------------- |
| F19    | `desktop-f19-profile.png`     | `mobile-f19-profile.png`     |
| F20    | `desktop-f20-sharing.png`     | `mobile-f20-sharing.png`     |
| F21    | `desktop-f21-automations.png` | `mobile-f21-automations.png` |

Each has a matching `-viewport.png`. Additional paired captures cover `profile-editing`, `workspace-preferences`, `invite-member`, `role-change`, `remove-member`, `automation-editor`, `automation-activity`, `notification-preferences`, `notification-center` and `generated-draft`.

Full-page and viewport captures were inspected for shell consistency, active Settings alignment, action sizing, destructive warning treatment, financial form legibility, responsive member cards, dialog scrolling, focus and bottom-navigation clearance. Full-page captures retain fixed controls at their current viewport position, not as permanent obstructions at that document offset. Long dialogs scroll independently; a capture after filling a lower field can show the dialog scrolled away from its heading.

## Corrections and regression evidence

The first full unit run exposed an error-message compatibility failure in the existing Expenses permission test. That test remained unchanged. Final permission messages preserve “read-only” for read-only financial edits while separately identifying missing workspace access and Owner-only actions. New tests verify each case and reject forged Owner roles. The final review also restricted member summaries to identity/contact fields rather than including another member's personal preferences.

Previously unstyled destructive buttons now reuse secondary/text button geometry with the established red warning color, border and pale warning surface. Explicit action names and confirmation dialogs remain; color is not the sole signal. Sidebar icon alignment, active state, card spacing and overly wide Settings primary buttons were corrected without changing previous screen styles. Automation labels now select the client only for drafts, invoice only for reminders, and Workspace review for other types; missing/foreign entities have explicit fallbacks.

Targeted Settings/Expenses service tests passed **82 tests**, including permission and automation label regressions. All **eight new Playwright workflows** passed independently at both target sizes. Complete validation passed **196 Vitest tests in 11 files** and **42 Playwright tests**, 21 per viewport, including all 34 previous browser regressions. The six shared dialog tests and the mobile close/search regression remain intact. No tests were removed, weakened or skipped; no arbitrary synchronization delays were added.

ESLint, Prettier, production build and installed dependency integrity passed. API health returned HTTP 200 with `status: ok` and `service: easyfinance-api`. Browser error, image-loading and horizontal-overflow assertions passed. All **49 authoritative assets** match manifest SHA-256 hashes. Prior visual reviews, auth source, dependency lockfile, investment calculations and AppDialog are preserved. Local API/browser sockets required sandbox escalation. The main production chunk retains a non-fatal approximately 649 kB size warning.

## Remaining limitations

This is a session-only frontend demonstration. Authentication, memberships, invitations and automation execution are simulated; no invitation email, remote-session control, production authorization, database persistence or background scheduler exists. Some notification categories and daily/weekly digests are explicitly configuration-only. Language/full-app formatter integration remains limited as described in [Settings behavior](../SETTINGS_COLLABORATION.md). CI, other browser engines, real-device and final visual approval were not exercised. Block 7 was not started.
