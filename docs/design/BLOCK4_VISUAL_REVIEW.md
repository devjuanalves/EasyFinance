# Block 4 visual and interaction review

Reviewed 11 November 2026 (Australia/Sydney). This supplements the preserved Block 1–3 reviews.

## Authoritative references

All eight principal local SVG references are available under `frames/04-expenses/`:

| Screen | Desktop                                                    | Mobile                                                  |
| ------ | ---------------------------------------------------------- | ------------------------------------------------------- |
| F12    | `05. Controle de Gastos (home).svg` — 1360×2216            | `05. Controle de Gastos (home)-1.svg` — 414×1790        |
| F13    | `5. Importar e revisar extrato bancário-1.svg` — 1292×1652 | `5. Importar e revisar extrato bancário.svg` — 414×1558 |
| F14    | `5. Lista e detalhes das transações.svg` — 1288×1314       | `5. Lista e detalhes das transações-1.svg` — 414×1251   |
| F15    | `5. Categorias e regras de gastos.svg` — 1296×1332         | `5. Categorias e regras de gastos-1.svg` — 414×1070     |

Functional references are Draw.io page 04, F12–F15 and the database dictionary covering transactions, splits, imports, attachments, categories and rules. Local exports were rendered for visual inspection; no Figma MCP or replacement artwork was used. Original logos, palette, blueprint and SVG bytes remain unchanged.

## Comparison and deliberate differences

All screens retain the established application shell, official runtime logo, warm neutral background, orange emphasis, rounded white cards, navigation, inputs and dialog conventions. F12 retains grouped metrics, trends, distribution, review content and recent activity. F13 retains a four-step review flow. F14 retains financial summary, filters and transaction detail/edit actions. F15 retains category cards, rules and a simulator. Mobile uses the existing compact header/bottom navigation, stacked content, readable transaction cards and scrollable dialogs.

The existing shell intentionally takes precedence over alternate logo/sidebar details drawn in these exports. System typography remains unconfirmed. These are functional responsive interpretations, not pixel-perfect approval:

- F12 uses actual daily fixture spending and category bars instead of the export's six-month trajectory and desktop donut. Recurrence and review summaries replace unsupported live AI, autopay and banking claims. Totals, transaction counts and previous-period comparisons reconcile to the shared ledger rather than the artwork.
- F13 exports show a PDF review state; the initial implemented state is CSV upload/mapping. Review uses editable cards on desktop and mobile rather than the dense desktop table. Explicit format controls and duplicate decisions add vertical space. Unsupported PDF extraction is clearly stated. There is no fictional AI confidence score or parser progress.
- F14 uses the existing native modal for details, rather than the desktop side pane/mobile bottom sheet in the export. It scrolls independently and exposes original values, exact splits and audit history. Additional filters and source labels make the page taller. The four KPI cards use a two-column mobile layout.
- F15 uses three desktop category columns and one mobile column, with readable action labels. Categories and rules share a page rather than the mobile export's segmented views. Existing icons are reused; no new icon set was introduced. Unsupported budget/automation success metrics are omitted.

No principal desktop/mobile pair is missing. Exact font identity, independent upload/mapping/error/editor/dialog exports and final visual approval remain dependencies. There was no redesign during final validation.

## Captures and inspection

Chromium captured each target independently at **1440×900** and **390×844**. Files are local ignored artifacts under `test-results/block4-layouts/`:

| Screen | Desktop full-page capture      | Mobile full-page capture      |
| ------ | ------------------------------ | ----------------------------- |
| F12    | `desktop-f12-overview.png`     | `mobile-f12-overview.png`     |
| F13    | `desktop-f13-import.png`       | `mobile-f13-import.png`       |
| F14    | `desktop-f14-transactions.png` | `mobile-f14-transactions.png` |
| F15    | `desktop-f15-categories.png`   | `mobile-f15-categories.png`   |

Each has a matching `-viewport.png`. Additional desktop/mobile captures cover `statement-review-duplicate`, `transaction-split`, `rule-editor` and `rule-preview`. All eight principal full-page captures were visually compared with the corresponding rendered exports; viewport and interaction captures were inspected for wrapping, controls, legible values, focus, modal scrolling and navigation. Full-page captures retain fixed navigation at its current viewport position; that does not indicate a fixed obstruction at that document location. Content remains scrollable above the bottom navigation.

No horizontal document overflow, missing images, page errors or console errors were reported by the Block 4 browser checks. All four workflows passed at both target sizes. Desktop/mobile authentication, Home/Dashboard and Income regression flows also passed.

## Executed validation

- Six targeted dialog tests passed. The original mobile transaction workflow passed separately, then passed with Escape/reopening coverage, and passed in the complete run.
- Complete Vitest suite: **103 passed**, nine test files; includes 30 expense parser/service cases and six dialog tests alongside earlier blocks and API coverage.
- Complete Playwright suite: **26 passed**, 13 per viewport, including all 18 prior regression tests. No tests were removed or skipped to obtain this result.
- Production build, ESLint, Prettier and installed dependency tree passed. Build retains a non-fatal approximately 551 kB main-chunk warning.
- API health returned `ok` with service `easyfinance-api`. Local sockets required sandbox escalation for browser/API checks.
- All **49 authoritative assets** matched manifest SHA-256. OS metadata is excluded from authoritative validation.

The mobile failure had a real duplicate-close callback path: the close button notified the owner and the later native event could notify it again, triggering another route update during search. The initial open-prop guard was strengthened with a synchronous per-open request guard after a delayed-parent test reproduced the remaining race. Escape uses the controlled close path and close/cancel events stop propagation. The browser test synchronizes on modal closure and the search value, without sleeps.

## Remaining limits

The application remains a session-only demonstration with fixed August–October 2026 fixture coverage. CSV parsing is real; PDF/OCR, live bank feeds, AI, persistent attachments, production authorization, background recurrence and production financial APIs are absent. Keep Both is an explicitly reviewed duplicate exception. Visual approval, other browser engines, real-device testing and CI execution remain pending. See [Expenses behavior](../EXPENSES.md) for financial rules and integration boundaries. Block 5 was not started.
