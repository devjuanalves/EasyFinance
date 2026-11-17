# Blueprint database review

Authoritative supplied sources: `docs/blueprint/EasyFinance_V1_Blueprint_Complete.drawio` (42 pages) and its 42-page PDF. The Draw.io XML was inspected directly; the PDF text was extracted for corroboration. No database architecture is substituted here.

DB00 introduces the relational guide. DB01–DB09 define 34 proposed tables. DB10 maps principal relations and DB11 maps screens to data responsibilities:

- Identity: users, auth_sessions, password_reset_tokens.
- Collaboration: workspaces, workspace_members, workspace_invitations.
- Accounts/import: financial_accounts, import_batches, attachments.
- Financial core: transactions, transaction_splits, transaction_transfers, categories, category_rules.
- Income: clients, invoice_templates, invoices, invoice_items, invoice_deliveries, payments, payment_allocations, recurring_invoice_rules.
- Investments: investment_accounts, investments, investment_movements, investment_valuations.
- AI: conversations, conversation_messages, ai_suggestions.
- Automation: automation_rules, automation_runs, notifications, notification_preferences, activity_logs.

Important specified constraints include unique normalized email; workspace membership uniqueness; workspace invoice numbering; payment/invoice allocation uniqueness; exact `numeric` money; workspace isolation; hashed session tokens; and reviewed AI suggestions before financial mutation. UUID and citext handling, decimal serialization, nullable uniqueness, derived statuses and aggregate constraints need explicit SQL/Prisma review.

## Conflicts to resolve before models

Page 42 is a conceptual overview and introduces alternative names/additional concepts: `sessions` versus `auth_sessions`, `accounts` versus `financial_accounts`, `invoice_payments` versus `payments`/`payment_allocations`, asset positions versus `investments`, and `ai_conversations` versus `conversations`. It also lists preferences, queues, snapshots and audit concepts beyond the 34-table dictionary. Do not silently merge these into a larger schema or choose one without documenting the resolution. DB01–DB09 provide the detailed proposed dictionary, not a finalized implementation.

Database server version, infrastructure, retention, backup schedule, object storage, AI/email providers and production deployment remain decisions for later blocks. No live database verification has been attempted because no schema or database was requested in Block 0.

## Block 8 resolution record

The subsequent authorized schema block retains the 34 DB01–DB09 entities and names. See [current database architecture](../DATABASE_ARCHITECTURE.md) for explicit page-42 mappings, frontend refinements, types, SQL constraints and unresolved production decisions. These supersede the earlier no-schema status; original blueprint files and the historical review above are preserved. PostgreSQL 18.7 execution, seed reruns and live integrity/concurrency tests passed as documented in [setup](../DATABASE_SETUP.md).
