# Implementation plan

| Block                        | Scope                                                                   | Entry/exit expectations                                                                                                                                        |
| ---------------------------- | ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0 — Project Foundation       | Monorepo, preserved references, tooling, health endpoint, documentation | Install, lint, format, tests and build verified; no functional screens                                                                                         |
| 1 — Authentication           | F01–F04                                                                 | Completed frontend-only mock flow, validation and browser tests; onboarding visual approval pending. Schema and real auth explicitly deferred by Block 1 scope |
| 2 — AI Home & Dashboard      | F05–F06                                                                 | Completed sample-data F05–F06; shared calculations and responsive tests; mobile dashboard visual approval pending                                              |
| 3 — Income & Invoices        | F07–F11                                                                 | Completed F07–F11 frontend; reviewed decimal totals, shared-ledger payments and responsive browser tests                                                       |
| 4 — Expenses                 | F12–F15                                                                 | Completed F12–F15 session frontend; CSV review, duplicate decisions, exact splits, transfer/exclusion safeguards and category rules validated                  |
| 5 — Investments              | F16–F18                                                                 | Completed F16–F18 session frontend; precise positions, movements, dated valuations and history corrections validated                                           |
| 6 — Settings & Collaboration | F19–F21                                                                 | Completed F19–F21 session frontend; scoped roles, profile, reviewed automations and notifications validated                                                    |
| 7 — Integration & QA         | Cross-module                                                            | Completed frontend audit; 42 responsive targets, financial/security/accessibility review and backend-readiness assessment; no migrations or deployment         |

Resolve database design in a separately reviewed schema implementation step before persistence-dependent features. Expand shared components from approved references; do not implement all screens ahead of their blocks. Block 1 frontend implementation is complete. Block 2 frontend implementation is complete with deterministic data; production integration and missing mobile design approval remain pending. Block 3 frontend implementation is complete with session-only invoices, clients and payment allocation; production delivery, persistence and scheduling remain deferred. Real authentication and database work require separate scope approval.

Block 4 frontend validation is complete: 103 Vitest and 26 Playwright tests pass, with all eight desktop/mobile targets inspected. PDF/OCR, production banking, persistence and authorization remain deferred. See EXPENSES.md and design/BLOCK4_VISUAL_REVIEW.md. Block 5 was subsequently authorized and completed.

Block 5 frontend validation is complete: 144 Vitest and 34 Playwright tests pass, including prior regressions. Six desktop/mobile targets were inspected. See INVESTMENTS.md and design/BLOCK5_VISUAL_REVIEW.md for financial rules, references and limits. Block 6 was subsequently authorized and completed.

Block 6 frontend validation is complete: 196 Vitest and 42 Playwright tests pass, with all six desktop/mobile targets inspected. All 21 functional frontend screens are implemented. Production integration, final design approval and broader QA are separate. See SETTINGS_COLLABORATION.md and design/BLOCK6_VISUAL_REVIEW.md. Stop before Block 7.

## Block 7 completion

See [frontend audit](FRONTEND_AUDIT.md), [42-target visual audit](design/BLOCK7_VISUAL_AUDIT.md) and [backend readiness](FRONTEND_BACKEND_READINESS.md). Targeted fixes preserve the existing modules and design system. Production contracts/schema decisions and final visual approval remain pending. Stop before Block 8; no database or production integration work was performed.
