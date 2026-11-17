# Block 3 visual and interaction review

Reviewed 7 November 2026 (Australia/Sydney). This supplements the unchanged Block 1 and Block 2 reviews.

## Authoritative references

All exports below are in `frames/03-income-invoices/`. Each SVG was rendered and visually inspected before implementation. Figma MCP was unavailable; local exports and the Draw.io functional blueprint were used.

| Screen | Desktop SVG                                                       | Mobile SVG                                                         |
| ------ | ----------------------------------------------------------------- | ------------------------------------------------------------------ |
| F07    | `04. Ganhos e Invoices (home).svg` (1296×2245)                    | `04. Ganhos e Invoices (home)-1.svg` (414×2195)                    |
| F08    | `4. Visão geral de ganhos + Listagem de invoices.svg` (1296×1474) | `4. Visão geral de ganhos + Listagem de invoices-1.svg` (414×1554) |
| F09    | `4. editar invoice.svg` (1296×1803)                               | `4. editar invoice-1.svg` (406×1495)                               |
| F10    | `4. Detalhes da invoice e pagamentos-1.svg` (1296×1927)           | `4. Detalhes da invoice e pagamentos.svg` (466×1173)               |
| F11    | `4. empregadores-1.svg` (1296×1295)                               | `4. empregadores.svg` (414×1552)                                   |

Functional sources: Draw.io page 03 — Ganhos e Invoices, F07–F11 specifications, and database pages for clients, invoices, invoice_items, invoice_deliveries, payments, payment_allocations and recurring_invoice_rules. No source artwork was embedded as a page or changed.

## Structure and deliberate differences

The existing shell, logo, warm background, typography conventions, orange controls, white rounded cards, navigation, native dialogs and focus styles are reused. Desktop follows the three Income tabs, pastel KPIs, charts, invoice table, editor/live-preview columns, detail/client/timeline columns and client-list/profile hierarchy. Mobile uses the existing bottom navigation, two-column KPIs, wrapped actions and filters, invoice/client cards, stacked editor fields and a preview toggle. Invoice document line items use labeled mobile rows to keep monetary amounts readable; print retains the document table.

The F08 source combines overview/list content. F09 is named edit but shows creation content. Both are interpreted as shared responsive screens with appropriate lifecycle states. No principal desktop/mobile pair is missing. Exact font identity and separate payment, client, cancellation, preparation, validation and recurring-template interaction exports remain unavailable; those states are provisional compositions of existing controls. No pixel-perfect or final design approval is claimed.

Additional demo-state/filter controls, explicit financial definitions, accessible chart data and honest integration explanations increase page height compared with the artwork. Sample values replace inconsistent decorative totals. New emails are prepared, never marked delivered. Existing header Add Record/Export remain future-module feedback; invoice-specific CSV and print controls work separately. Prepared-not-sent is an additional truthful status. Mobile document rows and client profile stacking prioritize legibility. No external assets or chart/PDF dependencies were added.

## Captures and inspection

Chromium independently validated all ten targets at desktop **1440×900** and mobile **390×844**. Full-page captures are under ignored `test-results/block3-layouts/`; each also has an exact `-viewport.png` capture.

| Screen | Desktop capture                   | Mobile capture                   |
| ------ | --------------------------------- | -------------------------------- |
| F07    | `desktop-f07-income-overview.png` | `mobile-f07-income-overview.png` |
| F08    | `desktop-f08-invoice-list.png`    | `mobile-f08-invoice-list.png`    |
| F09    | `desktop-f09-invoice-editor.png`  | `mobile-f09-invoice-editor.png`  |
| F10    | `desktop-f10-invoice-details.png` | `mobile-f10-invoice-details.png` |
| F11    | `desktop-f11-clients.png`         | `mobile-f11-clients.png`         |

All five desktop and five mobile captures were visually inspected against the source hierarchy for logo, spacing, cards, table/card readability, editor usability and navigation. The F09 capture contains an edited fractional-quantity example with tax and discount. Full-page captures show fixed navigation at the current viewport position, not a static poster layout. Content scrolls past the bottom navigation with end padding. Browser checks verify document width, image loading and absence of page/console errors. A mobile document currency wrap was found in visual review and replaced with labeled rows; captures were refreshed and the full browser suite rerun.

## Executed validation

- `npm run check`: ESLint, Prettier, **67 Vitest/component/service/API tests**, production build pass.
- `npm run test:e2e`: **18 tests pass**, nine per viewport, including all eight prior auth/Home/Dashboard browser tests.
- New browser workflows cover overview filters and empty/partial/error recovery; invoice search/status/pagination/CSV/duplicate/cancel; editor validation, add/remove items, preview, unsaved navigation, save/preparation; partial/full payments, overpayment rejection and shared Home/Dashboard updates; reviewed bank match without duplicate income; clients add/edit/search/archive/prefill and recurring draft preparation.
- Service tests additionally cover workspace/role/currency restrictions, integer rounding, allocation capacity across invoices, client snapshots, cancellation restrictions, atomic failed writes and session isolation.
- Actual `/api/health` response: `{"status":"ok","service":"easyfinance-api"}`. Installed dependency tree verified; no dependency or lockfile changes in Block 3.
- All 49 authoritative source assets match manifest hashes. Prior authentication implementation, Block 1/2 visual reviews and dependency lockfile match the pre-Block-3 snapshot. Git diff whitespace checks pass.

Early tests found discount input/derived-cent mixing and a shared client snapshot reference; both were fixed. A concurrent unit/browser run caused one auth timeout, then sequential complete regression runs passed. Local API tests and Chromium needed sandbox permission for sockets/processes. No CI or alternate browser engine was exercised. Print testing verifies document content and invocation of the browser print path; the operating-system Save as PDF dialog was not automated.

## Remaining dependencies

Session memory resets on reload/sign-out. Fixed sample accounting date is 31 October 2026. Production database, API authorization, delivery, payments, banking and real background scheduling remain future work. Recurring 7/30/90-day preparation is a documented demo convention. Direct PDF binary generation, refunds/corrective invoices and calendar-aware scheduling are not implemented. Exact font and unexported interaction states still need design approval. See [financial architecture and behavior](../INCOME_INVOICES.md).
