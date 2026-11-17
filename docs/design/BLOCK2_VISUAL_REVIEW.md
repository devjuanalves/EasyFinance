# Block 2 visual and interaction review

Reviewed 6 November 2026. This file supplements, and does not replace, BLOCK1_VISUAL_REVIEW.md.

## Authoritative references

- `frames/02-home-dashboard/Home com IA.svg` — desktop Home (1296 × 1470).
- `frames/02-home-dashboard/Home com IA-1.svg` — mobile Home (406 × 1263).
- `frames/02-home-dashboard/3. Dashboard financeiro com insights.svg` — desktop Dashboard (1296 × 2678).
- Draw.io pages `02 - Home e Dashboard`, F05 and F06: conversation history, assistant interaction, financial overview and review flow.
- Preserved official color logo and palette. No external asset downloads, generated replacement artwork or added chart dependency.

The mobile Dashboard export is missing. Its one-column charts, two-column KPI cards, wrapped filters and transaction cards are a provisional adaptation of the desktop hierarchy and the mobile Home shell. Exact font family and all interactive states are unconfirmed. These are documented limitations, not claims of pixel-perfect approval.

## Implemented visual structure

Desktop retains the warm neutral background, left workspace/navigation/history sidebar, official logo, top breadcrumb/actions, rounded white response and Dashboard cards, orange accents, metric groups, category distribution and suggestion panel. Dashboard follows the reference hierarchy: KPIs; cash-flow/category charts; insights/reviews; balance; activity table.

Mobile retains the compact top controls, dark user bubble, full-width response, mobile history drawer, bottom navigation and composer. Desktop sidebar is hidden. Dashboard cards stack and activity rows become readable cards. Native controls, visible keyboard focus, accessible names, native modal focus behavior and chart tables support interaction.

Deliberate differences: sample-data/source labels replace any implication of live AI or bank access; fabricated artwork totals are replaced by one reconciled ledger; additional filters expose scope and demonstration states. Net cash flow and actual balance are separately labeled. The equal-length prior comparison is explicitly dated. Charts use real fixture values and accessible tables. Future-module actions explain their unavailability instead of pretending to write financial records. The welcome state and interactive dialogs use existing component conventions because exports show only selected static states. Long sample explanations and accessibility text increase page height.

## Captures and inspection

Playwright ran Chromium at **1440 × 900** and **390 × 844**, separately. Screenshots are generated locally under `test-results/block2-layouts/` (ignored test artifacts):

| State                  | Desktop                         | Mobile                         |
| ---------------------- | ------------------------------- | ------------------------------ |
| Home welcome           | `desktop-home-welcome.png`      | `mobile-home-welcome.png`      |
| Home spending response | `desktop-home-response.png`     | `mobile-home-response.png`     |
| Dashboard normal       | `desktop-dashboard.png`         | `mobile-dashboard.png`         |
| Dashboard partial      | `desktop-dashboard-partial.png` | `mobile-dashboard-partial.png` |

Each also has a `-viewport.png` capture showing the exact viewport. Full-page captures naturally show sticky/fixed controls at their current viewport position; they are not static poster layouts. The Home content remains scrollable above the composer. Screenshots were visually inspected for card hierarchy, logo, spacing, metric legibility, chart labels, mobile wrapping and navigation/composer positioning. Desktop and mobile width checks pass with no document overflow. Auth screen captures were regenerated separately under `test-results/auth-layouts/`.

## Executed validation

- **37 Vitest/component/API tests pass**, including Block 1 regression coverage and new calculation/composer tests.
- **8 Playwright tests pass**, four per viewport: two auth flows, assistant/history workflow, and Dashboard data/filter workflow.
- Auth lifecycle includes registration/onboarding, sign-in/sign-out, reload behavior, API health `ok` and no local/session storage.
- Assistant browser coverage includes opening history, review/dismiss, CSV selection/removal and invalid file, Shift+Enter/Enter, unsupported response, simulated error/retry, rename/search, delete cancel/confirm, new chat and session isolation.
- Dashboard browser coverage includes period/account/currency/participant/workspace changes, reconciled values, partial/empty/error and recovery.
- Browser page-error checks pass. Existing auth flows also verify console errors and image loading. Document width checks pass at both sizes.
- ESLint, Prettier, production build and installed dependency tree check pass. No dependency additions in Block 2.
- All **49 authoritative source assets** match manifest SHA-256 hashes. Original Block 1 review unchanged. OS metadata is excluded from authoritative asset validation.

Initial test failures identified a negative-zero empty expense display, implicit-label lookup ambiguity, and nested dialog close-event propagation closing mobile history. All were fixed and rerun successfully. The first sandbox API test run could not bind a temporary port; the authorized local-socket run passed. No CI run, other browser engine, real backend, real AI or live financial data was exercised.

## Remaining limits

Mobile Dashboard visual approval, final font identification and missing interaction-state exports remain pending. Attachments are selection-only; review does not mutate data; invoices use a fixed status snapshot; history is in-memory only. Production sessions, financial authorization, persistence, processing and integrations remain future blocks. No automatic categorization or payment execution exists.
