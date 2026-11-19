# Functional screen inventory

Exact functional scope from Draw.io page 08 and F01–F21. Every screen requires desktop and mobile support. F01–F03 have implemented mock frontend flows; F04 is implemented with provisional visuals. F05–F06 now have working sample-data frontends; F06 mobile visuals remain provisional. F07–F21 now have validated session-only frontends. All 21 planned screens are implemented; production integration and final visual approval remain separate.

| ID  | Screen                             |
| --- | ---------------------------------- |
| F01 | Login                              |
| F02 | Criar conta                        |
| F03 | Recuperar senha                    |
| F04 | Onboarding                         |
| F05 | Home IA + Histórico                |
| F06 | Dashboard financeiro               |
| F07 | Ganhos — Visão geral               |
| F08 | Ganhos — Lista de invoices         |
| F09 | Ganhos — Criar/editar invoice      |
| F10 | Ganhos — Detalhes e pagamentos     |
| F11 | Ganhos — Clientes/empregadores     |
| F12 | Gastos — Visão geral               |
| F13 | Gastos — Importar/revisar extrato  |
| F14 | Gastos — Transações/detalhes       |
| F15 | Gastos — Categorias/regras         |
| F16 | Investimentos — Dashboard          |
| F17 | Investimentos — Adicionar/editar   |
| F18 | Investimentos — Detalhes/histórico |
| F19 | Perfil e configurações             |
| F20 | Compartilhamento e permissões      |
| F21 | Automações e notificações          |

See [frame mappings](design/FRAME_INDEX.md) for actual files and missing references.

## Block 1 status

| ID  | Implementation                                                       | Design status                                                           |
| --- | -------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| F01 | Login, validation, visibility, demo session and navigation complete  | Desktop/mobile references used; exact font unconfirmed                  |
| F02 | Registration, consent, validation and onboarding transition complete | Desktop/mobile references used; prototype-only controls omitted         |
| F03 | Recovery request, loading, error and neutral confirmation complete   | Desktop/mobile references used; email/token/new-password flows deferred |
| F04 | Four-step profile, workspace, preferences and summary complete       | Both design exports missing; provisional auth-component composition     |

## Block 2 status

| ID  | Implementation                                                                           | Design status                                                               |
| --- | ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| F05 | Home assistant, composer, history, scoped sample responses and review affordances        | Desktop/mobile SVGs used; system font and extra states provisional          |
| F06 | Filtered KPIs, charts, calculated insights, reviews, recent transactions and data states | Desktop SVG used; mobile export missing, responsive composition provisional |

## Block 3 status

| ID  | Implementation                                                                              | Responsive validation |
| --- | ------------------------------------------------------------------------------------------- | --------------------- |
| F07 | Income Overview: scoped received/billed/outstanding/overdue metrics, charts and data states | 1440×900 and 390×844  |
| F08 | Invoice List: combined filters, pagination, selection CSV and lifecycle actions             | 1440×900 and 390×844  |
| F09 | Create/Edit Invoice: decimal item editor, client prefill, preview, draft and unsaved guard  | 1440×900 and 390×844  |
| F10 | Details & Payments: partial/full payment, reviewed bank allocation, history and document    | 1440×900 and 390×844  |
| F11 | Clients & Employers: create/edit/archive, historical billing and recurring review templates | 1440×900 and 390×844  |

All use the existing shell and shared session ledger. Ten local SVGs informed the layouts; exact font and missing dialog states remain unconfirmed. See [behavior](INCOME_INVOICES.md) and [visual review](design/BLOCK3_VISUAL_REVIEW.md). Production persistence, email, banks and scheduling are outside this block.

## Block 4 status

| ID  | Implementation                                                                                                                           | Responsive validation |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| F12 | Expense Overview: shared filters, KPIs, trend/category data, recurrence suggestions, review links and add expense                        | 1440×900 and 390×844  |
| F13 | Statement Import & Review: real CSV parsing/mapping, editable review, duplicate decisions, confirmation and recoverable batch exclusion  | 1440×900 and 390×844  |
| F14 | Transactions & Details: search/filter/pagination, CSV, edits, exact splits, transfers, exclusion/restoration and protected invoice links | 1440×900 and 390×844  |
| F15 | Categories & Rules: create/edit/archive, rule priorities, deterministic preview/simulator and explicit apply                             | 1440×900 and 390×844  |

All eight SVG references were available. Existing components and session ledger are reused; additional interaction states and exact typography remain provisional. See [behavior](EXPENSES.md) and [visual review](design/BLOCK4_VISUAL_REVIEW.md). No production bank/PDF extraction/AI integration exists in Block 4.

## Block 5 status

| Screen | Implementation                                                                                   | Desktop / mobile             |
| ------ | ------------------------------------------------------------------------------------------------ | ---------------------------- |
| F16    | Investment Dashboard: scoped KPIs, dated charts, allocation, holdings and activity               | Validated 1440×900 / 390×844 |
| F17    | Add/Edit: conditional asset fields, manual accounts, precise preview and unsaved-work protection | Validated 1440×900 / 390×844 |
| F18    | Details/History: movements, valuations, distributions, corrections and audit snapshots           | Validated 1440×900 / 390×844 |

All six SVG references were available. See [behavior](INVESTMENTS.md) and [visual review](design/BLOCK5_VISUAL_REVIEW.md). No live prices, cash linking or production investment integrations are claimed.

## Block 6 status

| Screen | Implementation                                                                                                         | Desktop / mobile             |
| ------ | ---------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| F19    | Profile/preferences, Owner workspace settings, honest security states and unsaved-change protection                    | Validated 1440×900 / 390×844 |
| F20    | Membership roles, invitation lifecycle, confirmation/revocation and permission matrix                                  | Validated 1440×900 / 390×844 |
| F21    | Automation configuration, explicit idempotent draft/reminder simulations, notification preferences/center and activity | Validated 1440×900 / 390×844 |

All six local SVG references were inspected. See [behavior](SETTINGS_COLLABORATION.md) and [visual review](design/BLOCK6_VISUAL_REVIEW.md) for unsupported integrations, scoped formatting and configuration-only notifications. Block 7 was not started.

## Block 7 cross-module review

All F01–F21 implementations were reviewed at 1440×900 and 390×844 (42 targets). See [per-screen evidence](design/BLOCK7_VISUAL_AUDIT.md). F04 desktop/mobile and F06 mobile remain provisional because references are still absent. Existing routes and shell are preserved; Home now opens the transaction editor and scoped review screen. Broader browser/device and final design approval remain pending.

### Block 9B.1 persistence update

F07 Income Overview, F08 Invoice List, F09 Create/Edit Invoice, F10 Invoice Details/Payments and F11 Clients now have explicit API-mode persistence alongside their preserved demos. Existing routes and shell remain. See BLOCK9B1_INVOICES_PAYMENTS.md for supported controls and desktop/mobile validation.
