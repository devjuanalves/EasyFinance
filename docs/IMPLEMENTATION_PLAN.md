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

## Block 8 — PostgreSQL/Prisma persistence foundation

Authorized after Block 7. The existing 34-model schema, versioned migration, guarded seed and tests are prepared without replacing frontend services. See [database architecture](DATABASE_ARCHITECTURE.md), [setup and results](DATABASE_SETUP.md) and [future API mapping](DATABASE_FRONTEND_MAPPING.md). Prisma/offline validation is distinct from live PostgreSQL validation. Live PostgreSQL 18.7 migration application, seed reruns and all 31 integrity tests passed, including allocation races on independent connections. Production service authorization, deployment roles and performance validation remain required. No production API work or Block 9 has started.

## Block 9A — real backend and first persistent slice

Implemented real identity/session services, database membership authorization, scoped financial account/transaction reads and versioned manual ledger writes, plus authenticated Expense Overview. React API mode is separate from the preserved demo services. The 34-model schema and initial migration are unchanged. See [integration evidence and limits](BLOCK9A_INTEGRATION.md). Production security/deployment remains unapproved; stop before Block 9B domains.

### Block 9B.1 persistence slice

Income, invoices, clients and receipt allocation use existing models and the Block 9A security/data boundary. F07–F11 are connected in API mode; remaining demonstration modules are unchanged. Refer to BLOCK9B1_INVOICES_PAYMENTS.md for completion evidence and explicitly deferred delivery, corrections and recurring workflows. Block 9B.2 is not started.

## Block 9B.2 — 20 November 2026

Block 9B.2 CSV persistence and reviewed reconciliation extend existing contracts only. See BLOCK9B2_IMPORT_RECONCILIATION.md. Stop before Block 9B.3.

## Block 9B.3 — 23 November 2026

F16–F18 now use authenticated persistent InvestmentAccount, Investment, InvestmentMovement, InvestmentValuation and ActivityLog operations in API mode. Existing screens, charts and demo mode are preserved. Shared weighted-average calculations, dated valuation signatures, versioned corrections and idempotent transactional commands retain cash-ledger separation. No schema migration was required. See [Block 9B.3 implementation and verification](BLOCK9B3_INVESTMENTS.md) for executed checks, permissions, visual evidence and limits. Home/Dashboard remain separate demonstrations; Block 9B.4 has not started.

## Block 9B.4 delivery boundary

F19 Settings, F20 Sharing and F21 Automations now persist through authenticated APIs. Completed: profile/workspace preferences, invitation preparation/acceptance/revocation, protected membership changes, alert/reminder configuration and own notification preferences. Preserve the current configuration-only execution boundary; real scheduling, recurring invoice templates, delivery and notification producers need separate authorization/design. Regression evidence and remaining production dependencies: [Block 9B.4](BLOCK9B4_COLLABORATION_AUTOMATIONS.md). Block 9B.5 has not started.

## Block 9B.5 audit disposition

The system integration audit is documented in [BLOCK9B5_INTEGRATION_AUDIT.md](BLOCK9B5_INTEGRATION_AUDIT.md). Scope is validation and the minimal client-income attribution correction, not a new product module. Follow-up priorities require separate authorization: real Home/Dashboard reporting contracts; category/rule persistence; verified identity/recovery and production operations; bounded pagination/aggregation; explicit portfolio/cash and corrective financial workflows. Automation execution remains deferred.

## Block 10A completion — 26 November 2026

Implemented the read-only report adapter and category management against existing authorized services/tables, preserving demo screens. Cross-module receipt/import/investment reporting, date/currency/category scope, category races, revocation and refresh workflows are validated. See [executed validation and limitations](BLOCK10A_DASHBOARD_CATEGORIES.md). Historical balance trends, AI, rule execution and production deployment remain out of scope. Further work requires a separately authorized block; Block 10B has not begun.
