BEGIN;

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "RecordStatus" AS ENUM ('active', 'archived', 'disabled');

-- CreateEnum
CREATE TYPE "MemberRole" AS ENUM ('owner', 'editor', 'viewer');

-- CreateEnum
CREATE TYPE "MembershipStatus" AS ENUM ('active', 'revoked');

-- CreateEnum
CREATE TYPE "InvitationStatus" AS ENUM ('pending', 'accepted', 'expired', 'revoked');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('income', 'expense', 'transfer');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('pending', 'reviewed');

-- CreateEnum
CREATE TYPE "TransactionSource" AS ENUM ('manual', 'import', 'payment');

-- CreateEnum
CREATE TYPE "ImportStatus" AS ENUM ('uploaded', 'parsing', 'review', 'confirmed', 'excluded', 'failed');

-- CreateEnum
CREATE TYPE "DuplicateDecision" AS ENUM ('unreviewed', 'keep_both', 'use_original', 'exclude');

-- CreateEnum
CREATE TYPE "ClientType" AS ENUM ('individual', 'business');

-- CreateEnum
CREATE TYPE "InvoiceLifecycle" AS ENUM ('draft', 'issued', 'cancelled');

-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('prepared', 'queued', 'sent', 'failed');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('pending', 'confirmed', 'reversed');

-- CreateEnum
CREATE TYPE "RuleStatus" AS ENUM ('active', 'paused', 'archived');

-- CreateEnum
CREATE TYPE "PreparationMode" AS ENUM ('draft', 'review');

-- CreateEnum
CREATE TYPE "Frequency" AS ENUM ('weekly', 'fortnightly', 'monthly', 'quarterly');

-- CreateEnum
CREATE TYPE "InvestmentMovementType" AS ENUM ('buy', 'sell', 'contribution', 'withdrawal', 'dividend', 'interest', 'fee');

-- CreateEnum
CREATE TYPE "MessageRole" AS ENUM ('user', 'assistant', 'system');

-- CreateEnum
CREATE TYPE "SuggestionStatus" AS ENUM ('pending', 'accepted', 'rejected');

-- CreateEnum
CREATE TYPE "RunStatus" AS ENUM ('scheduled', 'running', 'pending_review', 'completed', 'failed');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('unread', 'read');

-- CreateEnum
CREATE TYPE "Channel" AS ENUM ('in_app', 'email');

-- CreateEnum
CREATE TYPE "MatchOperator" AS ENUM ('contains', 'equals', 'starts_with');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "full_name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT,
    "locale" TEXT NOT NULL DEFAULT 'en-AU',
    "timezone" TEXT NOT NULL DEFAULT 'Australia/Sydney',
    "avatar_key" TEXT,
    "status" "RecordStatus" NOT NULL DEFAULT 'active',
    "preferences" JSONB NOT NULL DEFAULT '{}',
    "email_verified_at" TIMESTAMPTZ(6),
    "archived_at" TIMESTAMPTZ(6),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_sessions" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "revoked_at" TIMESTAMPTZ(6),
    "device_label" TEXT,
    "last_seen_at" TIMESTAMPTZ(6),
    "user_id" UUID NOT NULL,

    CONSTRAINT "auth_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_reset_tokens" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "used_at" TIMESTAMPTZ(6),
    "user_id" UUID NOT NULL,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workspaces" (
    "integrity_version" BIGINT NOT NULL DEFAULT 0,
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "name" TEXT NOT NULL,
    "base_currency" CHAR(3) NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Australia/Sydney',
    "status" "RecordStatus" NOT NULL DEFAULT 'active',
    "kind" TEXT NOT NULL DEFAULT 'personal',
    "archived_at" TIMESTAMPTZ(6),
    "owner_user_id" UUID NOT NULL,

    CONSTRAINT "workspaces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workspace_members" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "workspace_id" UUID NOT NULL,
    "role" "MemberRole" NOT NULL,
    "status" "MembershipStatus" NOT NULL DEFAULT 'active',
    "joined_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMPTZ(6),
    "user_id" UUID NOT NULL,

    CONSTRAINT "workspace_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workspace_invitations" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "workspace_id" UUID NOT NULL,
    "invited_email" TEXT NOT NULL,
    "role" "MemberRole" NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "status" "InvitationStatus" NOT NULL DEFAULT 'pending',
    "accepted_at" TIMESTAMPTZ(6),
    "revoked_at" TIMESTAMPTZ(6),
    "invited_by_id" UUID NOT NULL,
    "accepted_by_id" UUID,

    CONSTRAINT "workspace_invitations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financial_accounts" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "workspace_id" UUID NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "name" TEXT NOT NULL,
    "institution" TEXT,
    "type" TEXT NOT NULL DEFAULT 'manual',
    "opening_balance_minor" BIGINT NOT NULL DEFAULT 0,
    "opening_date" DATE NOT NULL,
    "archived_at" TIMESTAMPTZ(6),

    CONSTRAINT "financial_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_batches" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "workspace_id" UUID NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "period_start" DATE,
    "period_end" DATE,
    "status" "ImportStatus" NOT NULL DEFAULT 'uploaded',
    "row_count" INTEGER NOT NULL DEFAULT 0,
    "idempotency_key" TEXT NOT NULL,
    "mapping" JSONB NOT NULL DEFAULT '{}',
    "source_rows" JSONB NOT NULL DEFAULT '[]',
    "review_decisions" JSONB NOT NULL DEFAULT '[]',
    "parser_version" TEXT,
    "confirmed_at" TIMESTAMPTZ(6),
    "financial_account_id" UUID NOT NULL,
    "file_id" UUID,
    "created_by_id" UUID NOT NULL,

    CONSTRAINT "import_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attachments" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "workspace_id" UUID NOT NULL,
    "storage_key" TEXT NOT NULL,
    "original_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "byte_size" BIGINT NOT NULL,
    "checksum" TEXT NOT NULL,
    "archived_at" TIMESTAMPTZ(6),
    "uploaded_by_id" UUID NOT NULL,

    CONSTRAINT "attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "workspace_id" UUID NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "booking_date" DATE NOT NULL,
    "description" TEXT NOT NULL,
    "original_description" TEXT NOT NULL,
    "amount_minor" BIGINT NOT NULL,
    "original_amount_minor" BIGINT NOT NULL,
    "original_date" DATE NOT NULL,
    "type" "TransactionType" NOT NULL,
    "source" "TransactionSource" NOT NULL DEFAULT 'manual',
    "review_status" "ReviewStatus" NOT NULL DEFAULT 'pending',
    "manual_category_override" BOOLEAN NOT NULL DEFAULT false,
    "duplicate_decision" "DuplicateDecision" NOT NULL DEFAULT 'unreviewed',
    "source_reference" TEXT,
    "source_system" TEXT,
    "source_row" INTEGER,
    "source_data" JSONB NOT NULL DEFAULT '{}',
    "excluded_at" TIMESTAMPTZ(6),
    "version" INTEGER NOT NULL DEFAULT 1,
    "account_id" UUID NOT NULL,
    "import_batch_id" UUID,
    "category_id" UUID,
    "duplicate_of_id" UUID,
    "created_by_id" UUID NOT NULL,
    "participant_id" UUID,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transaction_splits" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "workspace_id" UUID NOT NULL,
    "amount_minor" BIGINT NOT NULL,
    "note" TEXT,
    "transaction_id" UUID NOT NULL,
    "category_id" UUID NOT NULL,

    CONSTRAINT "transaction_splits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transaction_transfers" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "workspace_id" UUID NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "linked_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "outgoing_transaction_id" UUID NOT NULL,
    "incoming_transaction_id" UUID NOT NULL,

    CONSTRAINT "transaction_transfers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "workspace_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "icon" TEXT,
    "color" TEXT,
    "kind" "TransactionType" NOT NULL,
    "archived_at" TIMESTAMPTZ(6),

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "category_rules" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "workspace_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "match_field" TEXT NOT NULL,
    "operator" "MatchOperator" NOT NULL,
    "match_value" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "category_id" UUID NOT NULL,
    "created_by_id" UUID NOT NULL,

    CONSTRAINT "category_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clients" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "workspace_id" UUID NOT NULL,
    "type" "ClientType" NOT NULL,
    "name" TEXT NOT NULL,
    "business_name" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "address_json" JSONB NOT NULL DEFAULT '{}',
    "tax_id" TEXT,
    "default_currency" CHAR(3) NOT NULL,
    "payment_terms_days" INTEGER NOT NULL DEFAULT 14,
    "notes" TEXT,
    "archived_at" TIMESTAMPTZ(6),

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_templates" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "workspace_id" UUID NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "title" TEXT NOT NULL,
    "notes" TEXT,
    "payment_instructions" TEXT,
    "default_items_json" JSONB NOT NULL,
    "payment_terms_days" INTEGER NOT NULL DEFAULT 14,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "client_id" UUID,

    CONSTRAINT "invoice_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "workspace_id" UUID NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "invoice_number" TEXT NOT NULL,
    "issue_date" DATE NOT NULL,
    "due_date" DATE NOT NULL,
    "lifecycle" "InvoiceLifecycle" NOT NULL DEFAULT 'draft',
    "subtotal_minor" BIGINT NOT NULL DEFAULT 0,
    "tax_minor" BIGINT NOT NULL DEFAULT 0,
    "discount_minor" BIGINT NOT NULL DEFAULT 0,
    "total_minor" BIGINT NOT NULL DEFAULT 0,
    "client_snapshot" JSONB NOT NULL,
    "notes" TEXT,
    "payment_instructions" TEXT,
    "payment_terms_days" INTEGER NOT NULL DEFAULT 14,
    "cancelled_at" TIMESTAMPTZ(6),
    "issued_at" TIMESTAMPTZ(6),
    "template_occurrence" DATE,
    "version" INTEGER NOT NULL DEFAULT 1,
    "client_id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "created_by_id" UUID NOT NULL,
    "template_id" UUID,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_items" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "workspace_id" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(18,4) NOT NULL,
    "unit" TEXT,
    "unit_price" DECIMAL(18,4) NOT NULL,
    "tax_rate" DECIMAL(8,4) NOT NULL DEFAULT 0,
    "base_minor" BIGINT NOT NULL,
    "discount_minor" BIGINT NOT NULL DEFAULT 0,
    "tax_minor" BIGINT NOT NULL DEFAULT 0,
    "line_total_minor" BIGINT NOT NULL,
    "invoice_id" UUID NOT NULL,

    CONSTRAINT "invoice_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_deliveries" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "workspace_id" UUID NOT NULL,
    "recipient_email" TEXT NOT NULL,
    "channel" "Channel" NOT NULL DEFAULT 'email',
    "status" "DeliveryStatus" NOT NULL DEFAULT 'prepared',
    "sent_at" TIMESTAMPTZ(6),
    "provider_message_id" TEXT,
    "error_message" TEXT,
    "request_key" TEXT NOT NULL,
    "invoice_id" UUID NOT NULL,

    CONSTRAINT "invoice_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "workspace_id" UUID NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "paid_at" DATE NOT NULL,
    "amount_minor" BIGINT NOT NULL,
    "method" TEXT NOT NULL,
    "reference" TEXT,
    "status" "PaymentStatus" NOT NULL DEFAULT 'confirmed',
    "idempotency_key" TEXT NOT NULL,
    "transaction_id" UUID,
    "created_by_id" UUID NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_allocations" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "workspace_id" UUID NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "amount_minor" BIGINT NOT NULL,
    "payment_id" UUID NOT NULL,
    "invoice_id" UUID NOT NULL,

    CONSTRAINT "payment_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recurring_invoice_rules" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "workspace_id" UUID NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "frequency" "Frequency" NOT NULL,
    "next_run_at" TIMESTAMPTZ(6) NOT NULL,
    "timezone" TEXT NOT NULL,
    "mode" "PreparationMode" NOT NULL DEFAULT 'review',
    "status" "RuleStatus" NOT NULL DEFAULT 'active',
    "client_id" UUID NOT NULL,
    "template_id" UUID NOT NULL,
    "created_by_id" UUID NOT NULL,

    CONSTRAINT "recurring_invoice_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "investment_accounts" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "workspace_id" UUID NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "name" TEXT NOT NULL,
    "institution" TEXT,
    "archived_at" TIMESTAMPTZ(6),

    CONSTRAINT "investment_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "investments" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "workspace_id" UUID NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "name" TEXT NOT NULL,
    "asset_type" TEXT NOT NULL,
    "symbol" TEXT,
    "custom_category" TEXT,
    "opened_at" DATE NOT NULL,
    "notes" TEXT,
    "tags" JSONB NOT NULL DEFAULT '[]',
    "archived_at" TIMESTAMPTZ(6),
    "version" INTEGER NOT NULL DEFAULT 1,
    "investment_account_id" UUID,

    CONSTRAINT "investments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "investment_movements" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "workspace_id" UUID NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "date" DATE NOT NULL,
    "type" "InvestmentMovementType" NOT NULL,
    "sequence" INTEGER NOT NULL,
    "quantity" DECIMAL(18,8),
    "unit_price" DECIMAL(18,8),
    "amount_minor" BIGINT NOT NULL,
    "fee_minor" BIGINT NOT NULL DEFAULT 0,
    "notes" TEXT,
    "deleted_at" TIMESTAMPTZ(6),
    "correction_reason" TEXT,
    "investment_id" UUID NOT NULL,
    "created_by_id" UUID NOT NULL,

    CONSTRAINT "investment_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "investment_valuations" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "workspace_id" UUID NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "valued_at" DATE NOT NULL,
    "estimated_value_minor" BIGINT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "position_signature" TEXT NOT NULL,
    "notes" TEXT,
    "deleted_at" TIMESTAMPTZ(6),
    "investment_id" UUID NOT NULL,
    "created_by_id" UUID NOT NULL,

    CONSTRAINT "investment_valuations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversations" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "workspace_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "archived_at" TIMESTAMPTZ(6),
    "created_by_id" UUID NOT NULL,

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversation_messages" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "workspace_id" UUID NOT NULL,
    "role" "MessageRole" NOT NULL,
    "content" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'completed',
    "model_name" TEXT,
    "conversation_id" UUID NOT NULL,

    CONSTRAINT "conversation_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_suggestions" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "workspace_id" UUID NOT NULL,
    "target_type" TEXT NOT NULL,
    "target_id" UUID,
    "suggestion_json" JSONB NOT NULL,
    "status" "SuggestionStatus" NOT NULL DEFAULT 'pending',
    "reviewed_at" TIMESTAMPTZ(6),
    "message_id" UUID,
    "reviewed_by_id" UUID,

    CONSTRAINT "ai_suggestions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "automation_rules" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "workspace_id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "config_json" JSONB NOT NULL,
    "schedule" TEXT,
    "frequency" "Frequency",
    "next_scheduled_at" TIMESTAMPTZ(6),
    "timezone" TEXT NOT NULL,
    "mode" "PreparationMode" NOT NULL DEFAULT 'review',
    "status" "RuleStatus" NOT NULL DEFAULT 'active',
    "created_by_id" UUID NOT NULL,
    "recurring_invoice_rule_id" UUID,

    CONSTRAINT "automation_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "automation_runs" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "workspace_id" UUID NOT NULL,
    "scheduled_for" TIMESTAMPTZ(6) NOT NULL,
    "started_at" TIMESTAMPTZ(6),
    "finished_at" TIMESTAMPTZ(6),
    "status" "RunStatus" NOT NULL DEFAULT 'scheduled',
    "result_json" JSONB NOT NULL DEFAULT '{}',
    "error_message" TEXT,
    "idempotency_key" TEXT NOT NULL,
    "automation_rule_id" UUID NOT NULL,
    "invoice_id" UUID,

    CONSTRAINT "automation_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "workspace_id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "target_type" TEXT,
    "target_id" UUID,
    "channel" "Channel" NOT NULL DEFAULT 'in_app',
    "status" "NotificationStatus" NOT NULL DEFAULT 'unread',
    "read_at" TIMESTAMPTZ(6),
    "recipient_user_id" UUID NOT NULL,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_preferences" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "event_type" TEXT NOT NULL,
    "channel" "Channel" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "digest_frequency" TEXT NOT NULL DEFAULT 'immediate',
    "preferred_time" TEXT,
    "workspace_id" UUID,
    "user_id" UUID NOT NULL,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_logs" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "workspace_id" UUID NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" UUID,
    "action" TEXT NOT NULL,
    "metadata_json" JSONB NOT NULL DEFAULT '{}',
    "actor_user_id" UUID,

    CONSTRAINT "activity_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "auth_sessions_token_hash_key" ON "auth_sessions"("token_hash");

-- CreateIndex
CREATE INDEX "auth_sessions_user_id_idx" ON "auth_sessions"("user_id");

-- CreateIndex
CREATE INDEX "auth_sessions_user_id_expires_at_idx" ON "auth_sessions"("user_id", "expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_tokens_token_hash_key" ON "password_reset_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "password_reset_tokens_user_id_idx" ON "password_reset_tokens"("user_id");

-- CreateIndex
CREATE INDEX "workspaces_owner_user_id_idx" ON "workspaces"("owner_user_id");

-- CreateIndex
CREATE INDEX "workspace_members_workspace_id_created_at_idx" ON "workspace_members"("workspace_id", "created_at");

-- CreateIndex
CREATE INDEX "workspace_members_user_id_idx" ON "workspace_members"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "workspace_members_id_workspace_id_key" ON "workspace_members"("id", "workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "workspace_members_workspace_id_user_id_key" ON "workspace_members"("workspace_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "workspace_invitations_token_hash_key" ON "workspace_invitations"("token_hash");

-- CreateIndex
CREATE INDEX "workspace_invitations_workspace_id_created_at_idx" ON "workspace_invitations"("workspace_id", "created_at");

-- CreateIndex
CREATE INDEX "workspace_invitations_invited_by_id_idx" ON "workspace_invitations"("invited_by_id");

-- CreateIndex
CREATE INDEX "workspace_invitations_accepted_by_id_idx" ON "workspace_invitations"("accepted_by_id");

-- CreateIndex
CREATE INDEX "workspace_invitations_workspace_id_invited_email_status_idx" ON "workspace_invitations"("workspace_id", "invited_email", "status");

-- CreateIndex
CREATE UNIQUE INDEX "workspace_invitations_id_workspace_id_key" ON "workspace_invitations"("id", "workspace_id");

-- CreateIndex
CREATE INDEX "financial_accounts_workspace_id_created_at_idx" ON "financial_accounts"("workspace_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "financial_accounts_id_workspace_id_key" ON "financial_accounts"("id", "workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "financial_accounts_id_workspace_id_currency_key" ON "financial_accounts"("id", "workspace_id", "currency");

-- CreateIndex
CREATE INDEX "import_batches_workspace_id_created_at_idx" ON "import_batches"("workspace_id", "created_at");

-- CreateIndex
CREATE INDEX "import_batches_financial_account_id_workspace_id_currency_idx" ON "import_batches"("financial_account_id", "workspace_id", "currency");

-- CreateIndex
CREATE INDEX "import_batches_file_id_workspace_id_idx" ON "import_batches"("file_id", "workspace_id");

-- CreateIndex
CREATE INDEX "import_batches_created_by_id_idx" ON "import_batches"("created_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "import_batches_id_workspace_id_key" ON "import_batches"("id", "workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "import_batches_id_workspace_id_currency_key" ON "import_batches"("id", "workspace_id", "currency");

-- CreateIndex
CREATE UNIQUE INDEX "import_batches_workspace_id_idempotency_key_key" ON "import_batches"("workspace_id", "idempotency_key");

-- CreateIndex
CREATE UNIQUE INDEX "attachments_storage_key_key" ON "attachments"("storage_key");

-- CreateIndex
CREATE INDEX "attachments_workspace_id_created_at_idx" ON "attachments"("workspace_id", "created_at");

-- CreateIndex
CREATE INDEX "attachments_uploaded_by_id_idx" ON "attachments"("uploaded_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "attachments_id_workspace_id_key" ON "attachments"("id", "workspace_id");

-- CreateIndex
CREATE INDEX "transactions_workspace_id_created_at_idx" ON "transactions"("workspace_id", "created_at");

-- CreateIndex
CREATE INDEX "transactions_account_id_workspace_id_currency_idx" ON "transactions"("account_id", "workspace_id", "currency");

-- CreateIndex
CREATE INDEX "transactions_import_batch_id_workspace_id_currency_idx" ON "transactions"("import_batch_id", "workspace_id", "currency");

-- CreateIndex
CREATE INDEX "transactions_category_id_workspace_id_idx" ON "transactions"("category_id", "workspace_id");

-- CreateIndex
CREATE INDEX "transactions_duplicate_of_id_workspace_id_currency_idx" ON "transactions"("duplicate_of_id", "workspace_id", "currency");

-- CreateIndex
CREATE INDEX "transactions_created_by_id_idx" ON "transactions"("created_by_id");

-- CreateIndex
CREATE INDEX "transactions_participant_id_idx" ON "transactions"("participant_id");

-- CreateIndex
CREATE INDEX "transactions_workspace_id_booking_date_idx" ON "transactions"("workspace_id", "booking_date");

-- CreateIndex
CREATE INDEX "transactions_account_id_booking_date_idx" ON "transactions"("account_id", "booking_date");

-- CreateIndex
CREATE UNIQUE INDEX "transactions_id_workspace_id_key" ON "transactions"("id", "workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "transactions_id_workspace_id_currency_key" ON "transactions"("id", "workspace_id", "currency");

-- CreateIndex
CREATE UNIQUE INDEX "transactions_import_batch_id_source_row_key" ON "transactions"("import_batch_id", "source_row");

-- CreateIndex
CREATE UNIQUE INDEX "transactions_account_id_source_system_source_reference_key" ON "transactions"("account_id", "source_system", "source_reference");

-- CreateIndex
CREATE INDEX "transaction_splits_workspace_id_created_at_idx" ON "transaction_splits"("workspace_id", "created_at");

-- CreateIndex
CREATE INDEX "transaction_splits_transaction_id_workspace_id_idx" ON "transaction_splits"("transaction_id", "workspace_id");

-- CreateIndex
CREATE INDEX "transaction_splits_category_id_workspace_id_idx" ON "transaction_splits"("category_id", "workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "transaction_splits_id_workspace_id_key" ON "transaction_splits"("id", "workspace_id");

-- CreateIndex
CREATE INDEX "transaction_transfers_workspace_id_created_at_idx" ON "transaction_transfers"("workspace_id", "created_at");

-- CreateIndex
CREATE INDEX "transaction_transfers_outgoing_transaction_id_workspace_id__idx" ON "transaction_transfers"("outgoing_transaction_id", "workspace_id", "currency");

-- CreateIndex
CREATE INDEX "transaction_transfers_incoming_transaction_id_workspace_id__idx" ON "transaction_transfers"("incoming_transaction_id", "workspace_id", "currency");

-- CreateIndex
CREATE UNIQUE INDEX "transaction_transfers_id_workspace_id_key" ON "transaction_transfers"("id", "workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "transaction_transfers_id_workspace_id_currency_key" ON "transaction_transfers"("id", "workspace_id", "currency");

-- CreateIndex
CREATE UNIQUE INDEX "transaction_transfers_outgoing_transaction_id_key" ON "transaction_transfers"("outgoing_transaction_id");

-- CreateIndex
CREATE UNIQUE INDEX "transaction_transfers_incoming_transaction_id_key" ON "transaction_transfers"("incoming_transaction_id");

-- CreateIndex
CREATE INDEX "categories_workspace_id_created_at_idx" ON "categories"("workspace_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "categories_id_workspace_id_key" ON "categories"("id", "workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "categories_workspace_id_kind_name_key" ON "categories"("workspace_id", "kind", "name");

-- CreateIndex
CREATE INDEX "category_rules_workspace_id_created_at_idx" ON "category_rules"("workspace_id", "created_at");

-- CreateIndex
CREATE INDEX "category_rules_category_id_workspace_id_idx" ON "category_rules"("category_id", "workspace_id");

-- CreateIndex
CREATE INDEX "category_rules_created_by_id_idx" ON "category_rules"("created_by_id");

-- CreateIndex
CREATE INDEX "category_rules_workspace_id_is_active_priority_idx" ON "category_rules"("workspace_id", "is_active", "priority");

-- CreateIndex
CREATE UNIQUE INDEX "category_rules_id_workspace_id_key" ON "category_rules"("id", "workspace_id");

-- CreateIndex
CREATE INDEX "clients_workspace_id_created_at_idx" ON "clients"("workspace_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "clients_id_workspace_id_key" ON "clients"("id", "workspace_id");

-- CreateIndex
CREATE INDEX "invoice_templates_workspace_id_created_at_idx" ON "invoice_templates"("workspace_id", "created_at");

-- CreateIndex
CREATE INDEX "invoice_templates_client_id_workspace_id_idx" ON "invoice_templates"("client_id", "workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "invoice_templates_id_workspace_id_key" ON "invoice_templates"("id", "workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "invoice_templates_id_workspace_id_currency_key" ON "invoice_templates"("id", "workspace_id", "currency");

-- CreateIndex
CREATE INDEX "invoices_workspace_id_created_at_idx" ON "invoices"("workspace_id", "created_at");

-- CreateIndex
CREATE INDEX "invoices_client_id_workspace_id_idx" ON "invoices"("client_id", "workspace_id");

-- CreateIndex
CREATE INDEX "invoices_account_id_workspace_id_currency_idx" ON "invoices"("account_id", "workspace_id", "currency");

-- CreateIndex
CREATE INDEX "invoices_created_by_id_idx" ON "invoices"("created_by_id");

-- CreateIndex
CREATE INDEX "invoices_template_id_workspace_id_currency_idx" ON "invoices"("template_id", "workspace_id", "currency");

-- CreateIndex
CREATE INDEX "invoices_workspace_id_client_id_lifecycle_due_date_idx" ON "invoices"("workspace_id", "client_id", "lifecycle", "due_date");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_id_workspace_id_key" ON "invoices"("id", "workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_id_workspace_id_currency_key" ON "invoices"("id", "workspace_id", "currency");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_workspace_id_invoice_number_key" ON "invoices"("workspace_id", "invoice_number");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_template_id_template_occurrence_key" ON "invoices"("template_id", "template_occurrence");

-- CreateIndex
CREATE INDEX "invoice_items_workspace_id_created_at_idx" ON "invoice_items"("workspace_id", "created_at");

-- CreateIndex
CREATE INDEX "invoice_items_invoice_id_workspace_id_idx" ON "invoice_items"("invoice_id", "workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "invoice_items_id_workspace_id_key" ON "invoice_items"("id", "workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "invoice_items_invoice_id_position_key" ON "invoice_items"("invoice_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "invoice_deliveries_provider_message_id_key" ON "invoice_deliveries"("provider_message_id");

-- CreateIndex
CREATE INDEX "invoice_deliveries_workspace_id_created_at_idx" ON "invoice_deliveries"("workspace_id", "created_at");

-- CreateIndex
CREATE INDEX "invoice_deliveries_invoice_id_workspace_id_idx" ON "invoice_deliveries"("invoice_id", "workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "invoice_deliveries_id_workspace_id_key" ON "invoice_deliveries"("id", "workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "invoice_deliveries_invoice_id_request_key_key" ON "invoice_deliveries"("invoice_id", "request_key");

-- CreateIndex
CREATE INDEX "payments_workspace_id_created_at_idx" ON "payments"("workspace_id", "created_at");

-- CreateIndex
CREATE INDEX "payments_transaction_id_workspace_id_currency_idx" ON "payments"("transaction_id", "workspace_id", "currency");

-- CreateIndex
CREATE INDEX "payments_created_by_id_idx" ON "payments"("created_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "payments_id_workspace_id_key" ON "payments"("id", "workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "payments_id_workspace_id_currency_key" ON "payments"("id", "workspace_id", "currency");

-- CreateIndex
CREATE UNIQUE INDEX "payments_transaction_id_key" ON "payments"("transaction_id");

-- CreateIndex
CREATE UNIQUE INDEX "payments_workspace_id_idempotency_key_key" ON "payments"("workspace_id", "idempotency_key");

-- CreateIndex
CREATE INDEX "payment_allocations_workspace_id_created_at_idx" ON "payment_allocations"("workspace_id", "created_at");

-- CreateIndex
CREATE INDEX "payment_allocations_payment_id_workspace_id_currency_idx" ON "payment_allocations"("payment_id", "workspace_id", "currency");

-- CreateIndex
CREATE INDEX "payment_allocations_invoice_id_workspace_id_currency_idx" ON "payment_allocations"("invoice_id", "workspace_id", "currency");

-- CreateIndex
CREATE UNIQUE INDEX "payment_allocations_id_workspace_id_key" ON "payment_allocations"("id", "workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "payment_allocations_id_workspace_id_currency_key" ON "payment_allocations"("id", "workspace_id", "currency");

-- CreateIndex
CREATE UNIQUE INDEX "payment_allocations_payment_id_invoice_id_key" ON "payment_allocations"("payment_id", "invoice_id");

-- CreateIndex
CREATE INDEX "recurring_invoice_rules_workspace_id_created_at_idx" ON "recurring_invoice_rules"("workspace_id", "created_at");

-- CreateIndex
CREATE INDEX "recurring_invoice_rules_client_id_workspace_id_idx" ON "recurring_invoice_rules"("client_id", "workspace_id");

-- CreateIndex
CREATE INDEX "recurring_invoice_rules_template_id_workspace_id_currency_idx" ON "recurring_invoice_rules"("template_id", "workspace_id", "currency");

-- CreateIndex
CREATE INDEX "recurring_invoice_rules_created_by_id_idx" ON "recurring_invoice_rules"("created_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "recurring_invoice_rules_id_workspace_id_key" ON "recurring_invoice_rules"("id", "workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "recurring_invoice_rules_id_workspace_id_currency_key" ON "recurring_invoice_rules"("id", "workspace_id", "currency");

-- CreateIndex
CREATE INDEX "investment_accounts_workspace_id_created_at_idx" ON "investment_accounts"("workspace_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "investment_accounts_id_workspace_id_key" ON "investment_accounts"("id", "workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "investment_accounts_id_workspace_id_currency_key" ON "investment_accounts"("id", "workspace_id", "currency");

-- CreateIndex
CREATE INDEX "investments_workspace_id_created_at_idx" ON "investments"("workspace_id", "created_at");

-- CreateIndex
CREATE INDEX "investments_investment_account_id_workspace_id_currency_idx" ON "investments"("investment_account_id", "workspace_id", "currency");

-- CreateIndex
CREATE UNIQUE INDEX "investments_id_workspace_id_key" ON "investments"("id", "workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "investments_id_workspace_id_currency_key" ON "investments"("id", "workspace_id", "currency");

-- CreateIndex
CREATE INDEX "investment_movements_workspace_id_created_at_idx" ON "investment_movements"("workspace_id", "created_at");

-- CreateIndex
CREATE INDEX "investment_movements_investment_id_workspace_id_currency_idx" ON "investment_movements"("investment_id", "workspace_id", "currency");

-- CreateIndex
CREATE INDEX "investment_movements_created_by_id_idx" ON "investment_movements"("created_by_id");

-- CreateIndex
CREATE INDEX "investment_movements_investment_id_date_sequence_idx" ON "investment_movements"("investment_id", "date", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "investment_movements_id_workspace_id_key" ON "investment_movements"("id", "workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "investment_movements_id_workspace_id_currency_key" ON "investment_movements"("id", "workspace_id", "currency");

-- CreateIndex
CREATE UNIQUE INDEX "investment_movements_investment_id_sequence_key" ON "investment_movements"("investment_id", "sequence");

-- CreateIndex
CREATE INDEX "investment_valuations_workspace_id_created_at_idx" ON "investment_valuations"("workspace_id", "created_at");

-- CreateIndex
CREATE INDEX "investment_valuations_investment_id_workspace_id_currency_idx" ON "investment_valuations"("investment_id", "workspace_id", "currency");

-- CreateIndex
CREATE INDEX "investment_valuations_created_by_id_idx" ON "investment_valuations"("created_by_id");

-- CreateIndex
CREATE INDEX "investment_valuations_investment_id_valued_at_idx" ON "investment_valuations"("investment_id", "valued_at");

-- CreateIndex
CREATE UNIQUE INDEX "investment_valuations_id_workspace_id_key" ON "investment_valuations"("id", "workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "investment_valuations_id_workspace_id_currency_key" ON "investment_valuations"("id", "workspace_id", "currency");

-- CreateIndex
CREATE INDEX "conversations_workspace_id_created_at_idx" ON "conversations"("workspace_id", "created_at");

-- CreateIndex
CREATE INDEX "conversations_created_by_id_idx" ON "conversations"("created_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "conversations_id_workspace_id_key" ON "conversations"("id", "workspace_id");

-- CreateIndex
CREATE INDEX "conversation_messages_workspace_id_created_at_idx" ON "conversation_messages"("workspace_id", "created_at");

-- CreateIndex
CREATE INDEX "conversation_messages_conversation_id_workspace_id_idx" ON "conversation_messages"("conversation_id", "workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "conversation_messages_id_workspace_id_key" ON "conversation_messages"("id", "workspace_id");

-- CreateIndex
CREATE INDEX "ai_suggestions_workspace_id_created_at_idx" ON "ai_suggestions"("workspace_id", "created_at");

-- CreateIndex
CREATE INDEX "ai_suggestions_message_id_workspace_id_idx" ON "ai_suggestions"("message_id", "workspace_id");

-- CreateIndex
CREATE INDEX "ai_suggestions_reviewed_by_id_idx" ON "ai_suggestions"("reviewed_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "ai_suggestions_id_workspace_id_key" ON "ai_suggestions"("id", "workspace_id");

-- CreateIndex
CREATE INDEX "automation_rules_workspace_id_created_at_idx" ON "automation_rules"("workspace_id", "created_at");

-- CreateIndex
CREATE INDEX "automation_rules_created_by_id_idx" ON "automation_rules"("created_by_id");

-- CreateIndex
CREATE INDEX "automation_rules_recurring_invoice_rule_id_workspace_id_idx" ON "automation_rules"("recurring_invoice_rule_id", "workspace_id");

-- CreateIndex
CREATE INDEX "automation_rules_status_next_scheduled_at_idx" ON "automation_rules"("status", "next_scheduled_at");

-- CreateIndex
CREATE UNIQUE INDEX "automation_rules_id_workspace_id_key" ON "automation_rules"("id", "workspace_id");

-- CreateIndex
CREATE INDEX "automation_runs_workspace_id_created_at_idx" ON "automation_runs"("workspace_id", "created_at");

-- CreateIndex
CREATE INDEX "automation_runs_automation_rule_id_workspace_id_idx" ON "automation_runs"("automation_rule_id", "workspace_id");

-- CreateIndex
CREATE INDEX "automation_runs_invoice_id_workspace_id_idx" ON "automation_runs"("invoice_id", "workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "automation_runs_id_workspace_id_key" ON "automation_runs"("id", "workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "automation_runs_automation_rule_id_scheduled_for_key" ON "automation_runs"("automation_rule_id", "scheduled_for");

-- CreateIndex
CREATE UNIQUE INDEX "automation_runs_workspace_id_idempotency_key_key" ON "automation_runs"("workspace_id", "idempotency_key");

-- CreateIndex
CREATE INDEX "notifications_workspace_id_created_at_idx" ON "notifications"("workspace_id", "created_at");

-- CreateIndex
CREATE INDEX "notifications_recipient_user_id_idx" ON "notifications"("recipient_user_id");

-- CreateIndex
CREATE INDEX "notifications_recipient_user_id_workspace_id_status_created_idx" ON "notifications"("recipient_user_id", "workspace_id", "status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "notifications_id_workspace_id_key" ON "notifications"("id", "workspace_id");

-- CreateIndex
CREATE INDEX "notification_preferences_workspace_id_idx" ON "notification_preferences"("workspace_id");

-- CreateIndex
CREATE INDEX "notification_preferences_user_id_idx" ON "notification_preferences"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "notification_preferences_user_id_workspace_id_event_type_ch_key" ON "notification_preferences"("user_id", "workspace_id", "event_type", "channel");

-- CreateIndex
CREATE INDEX "activity_logs_workspace_id_created_at_idx" ON "activity_logs"("workspace_id", "created_at");

-- CreateIndex
CREATE INDEX "activity_logs_actor_user_id_idx" ON "activity_logs"("actor_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "activity_logs_id_workspace_id_key" ON "activity_logs"("id", "workspace_id");

-- AddForeignKey
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "workspace_invitations" ADD CONSTRAINT "workspace_invitations_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "workspace_invitations" ADD CONSTRAINT "workspace_invitations_invited_by_id_fkey" FOREIGN KEY ("invited_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "workspace_invitations" ADD CONSTRAINT "workspace_invitations_accepted_by_id_fkey" FOREIGN KEY ("accepted_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "financial_accounts" ADD CONSTRAINT "financial_accounts_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "import_batches" ADD CONSTRAINT "import_batches_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "import_batches" ADD CONSTRAINT "import_batches_financial_account_id_workspace_id_currency_fkey" FOREIGN KEY ("financial_account_id", "workspace_id", "currency") REFERENCES "financial_accounts"("id", "workspace_id", "currency") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "import_batches" ADD CONSTRAINT "import_batches_file_id_workspace_id_fkey" FOREIGN KEY ("file_id", "workspace_id") REFERENCES "attachments"("id", "workspace_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "import_batches" ADD CONSTRAINT "import_batches_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_account_id_workspace_id_currency_fkey" FOREIGN KEY ("account_id", "workspace_id", "currency") REFERENCES "financial_accounts"("id", "workspace_id", "currency") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_import_batch_id_workspace_id_currency_fkey" FOREIGN KEY ("import_batch_id", "workspace_id", "currency") REFERENCES "import_batches"("id", "workspace_id", "currency") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_category_id_workspace_id_fkey" FOREIGN KEY ("category_id", "workspace_id") REFERENCES "categories"("id", "workspace_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_duplicate_of_id_workspace_id_currency_fkey" FOREIGN KEY ("duplicate_of_id", "workspace_id", "currency") REFERENCES "transactions"("id", "workspace_id", "currency") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_participant_id_fkey" FOREIGN KEY ("participant_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "transaction_splits" ADD CONSTRAINT "transaction_splits_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "transaction_splits" ADD CONSTRAINT "transaction_splits_transaction_id_workspace_id_fkey" FOREIGN KEY ("transaction_id", "workspace_id") REFERENCES "transactions"("id", "workspace_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "transaction_splits" ADD CONSTRAINT "transaction_splits_category_id_workspace_id_fkey" FOREIGN KEY ("category_id", "workspace_id") REFERENCES "categories"("id", "workspace_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "transaction_transfers" ADD CONSTRAINT "transaction_transfers_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "transaction_transfers" ADD CONSTRAINT "transaction_transfers_outgoing_transaction_id_workspace_id_fkey" FOREIGN KEY ("outgoing_transaction_id", "workspace_id", "currency") REFERENCES "transactions"("id", "workspace_id", "currency") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "transaction_transfers" ADD CONSTRAINT "transaction_transfers_incoming_transaction_id_workspace_id_fkey" FOREIGN KEY ("incoming_transaction_id", "workspace_id", "currency") REFERENCES "transactions"("id", "workspace_id", "currency") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "category_rules" ADD CONSTRAINT "category_rules_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "category_rules" ADD CONSTRAINT "category_rules_category_id_workspace_id_fkey" FOREIGN KEY ("category_id", "workspace_id") REFERENCES "categories"("id", "workspace_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "category_rules" ADD CONSTRAINT "category_rules_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "clients" ADD CONSTRAINT "clients_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "invoice_templates" ADD CONSTRAINT "invoice_templates_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "invoice_templates" ADD CONSTRAINT "invoice_templates_client_id_workspace_id_fkey" FOREIGN KEY ("client_id", "workspace_id") REFERENCES "clients"("id", "workspace_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_client_id_workspace_id_fkey" FOREIGN KEY ("client_id", "workspace_id") REFERENCES "clients"("id", "workspace_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_account_id_workspace_id_currency_fkey" FOREIGN KEY ("account_id", "workspace_id", "currency") REFERENCES "financial_accounts"("id", "workspace_id", "currency") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_template_id_workspace_id_currency_fkey" FOREIGN KEY ("template_id", "workspace_id", "currency") REFERENCES "invoice_templates"("id", "workspace_id", "currency") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_invoice_id_workspace_id_fkey" FOREIGN KEY ("invoice_id", "workspace_id") REFERENCES "invoices"("id", "workspace_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "invoice_deliveries" ADD CONSTRAINT "invoice_deliveries_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "invoice_deliveries" ADD CONSTRAINT "invoice_deliveries_invoice_id_workspace_id_fkey" FOREIGN KEY ("invoice_id", "workspace_id") REFERENCES "invoices"("id", "workspace_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_transaction_id_workspace_id_currency_fkey" FOREIGN KEY ("transaction_id", "workspace_id", "currency") REFERENCES "transactions"("id", "workspace_id", "currency") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_payment_id_workspace_id_currency_fkey" FOREIGN KEY ("payment_id", "workspace_id", "currency") REFERENCES "payments"("id", "workspace_id", "currency") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_invoice_id_workspace_id_currency_fkey" FOREIGN KEY ("invoice_id", "workspace_id", "currency") REFERENCES "invoices"("id", "workspace_id", "currency") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "recurring_invoice_rules" ADD CONSTRAINT "recurring_invoice_rules_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "recurring_invoice_rules" ADD CONSTRAINT "recurring_invoice_rules_client_id_workspace_id_fkey" FOREIGN KEY ("client_id", "workspace_id") REFERENCES "clients"("id", "workspace_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "recurring_invoice_rules" ADD CONSTRAINT "recurring_invoice_rules_template_id_workspace_id_currency_fkey" FOREIGN KEY ("template_id", "workspace_id", "currency") REFERENCES "invoice_templates"("id", "workspace_id", "currency") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "recurring_invoice_rules" ADD CONSTRAINT "recurring_invoice_rules_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "investment_accounts" ADD CONSTRAINT "investment_accounts_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "investments" ADD CONSTRAINT "investments_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "investments" ADD CONSTRAINT "investments_investment_account_id_workspace_id_currency_fkey" FOREIGN KEY ("investment_account_id", "workspace_id", "currency") REFERENCES "investment_accounts"("id", "workspace_id", "currency") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "investment_movements" ADD CONSTRAINT "investment_movements_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "investment_movements" ADD CONSTRAINT "investment_movements_investment_id_workspace_id_currency_fkey" FOREIGN KEY ("investment_id", "workspace_id", "currency") REFERENCES "investments"("id", "workspace_id", "currency") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "investment_movements" ADD CONSTRAINT "investment_movements_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "investment_valuations" ADD CONSTRAINT "investment_valuations_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "investment_valuations" ADD CONSTRAINT "investment_valuations_investment_id_workspace_id_currency_fkey" FOREIGN KEY ("investment_id", "workspace_id", "currency") REFERENCES "investments"("id", "workspace_id", "currency") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "investment_valuations" ADD CONSTRAINT "investment_valuations_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "conversation_messages" ADD CONSTRAINT "conversation_messages_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "conversation_messages" ADD CONSTRAINT "conversation_messages_conversation_id_workspace_id_fkey" FOREIGN KEY ("conversation_id", "workspace_id") REFERENCES "conversations"("id", "workspace_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "ai_suggestions" ADD CONSTRAINT "ai_suggestions_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "ai_suggestions" ADD CONSTRAINT "ai_suggestions_message_id_workspace_id_fkey" FOREIGN KEY ("message_id", "workspace_id") REFERENCES "conversation_messages"("id", "workspace_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "ai_suggestions" ADD CONSTRAINT "ai_suggestions_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "automation_rules" ADD CONSTRAINT "automation_rules_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "automation_rules" ADD CONSTRAINT "automation_rules_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "automation_rules" ADD CONSTRAINT "automation_rules_recurring_invoice_rule_id_workspace_id_fkey" FOREIGN KEY ("recurring_invoice_rule_id", "workspace_id") REFERENCES "recurring_invoice_rules"("id", "workspace_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "automation_runs" ADD CONSTRAINT "automation_runs_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "automation_runs" ADD CONSTRAINT "automation_runs_automation_rule_id_workspace_id_fkey" FOREIGN KEY ("automation_rule_id", "workspace_id") REFERENCES "automation_rules"("id", "workspace_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "automation_runs" ADD CONSTRAINT "automation_runs_invoice_id_workspace_id_fkey" FOREIGN KEY ("invoice_id", "workspace_id") REFERENCES "invoices"("id", "workspace_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipient_user_id_fkey" FOREIGN KEY ("recipient_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;


-- Reviewed PostgreSQL additions: see docs/DATABASE_ARCHITECTURE.md.
ALTER TABLE "users" ADD CONSTRAINT "users_normalized_email" CHECK (email = lower(btrim(email)) AND email ~ '^[^[:space:]@]+@[^[:space:]@]+$');
ALTER TABLE "workspace_invitations" ADD CONSTRAINT "workspace_invitations_normalized_email" CHECK (invited_email = lower(btrim(invited_email)) AND invited_email ~ '^[^[:space:]@]+@[^[:space:]@]+$');
ALTER TABLE "users" ADD CONSTRAINT "users_credential_state" CHECK (status <> 'active' OR (password_hash IS NOT NULL AND length(password_hash) > 0));
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_token_hash" CHECK (token_hash ~ '^[0-9a-f]{64}$');
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_expiry" CHECK (expires_at > created_at);
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_token_hash" CHECK (token_hash ~ '^[0-9a-f]{64}$');
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_expiry" CHECK (expires_at > created_at);
ALTER TABLE "workspace_invitations" ADD CONSTRAINT "workspace_invitations_token_hash" CHECK (token_hash ~ '^[0-9a-f]{64}$');
ALTER TABLE "workspace_invitations" ADD CONSTRAINT "workspace_invitations_expiry" CHECK (expires_at > created_at);
ALTER TABLE "workspace_members" ADD CONSTRAINT "membership_state" CHECK ((status = 'active' AND revoked_at IS NULL) OR (status = 'revoked' AND revoked_at IS NOT NULL));
ALTER TABLE "workspace_invitations" ADD CONSTRAINT "invitation_role" CHECK (role <> 'owner');
ALTER TABLE "workspace_invitations" ADD CONSTRAINT "invitation_state" CHECK ((status = 'accepted') = (accepted_at IS NOT NULL AND accepted_by_id IS NOT NULL));
ALTER TABLE "workspace_invitations" ADD CONSTRAINT "invitation_revocation" CHECK ((status = 'revoked') = (revoked_at IS NOT NULL));
ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_base_currency_code" CHECK (base_currency ~ '^[A-Z]{3}$');
ALTER TABLE "financial_accounts" ADD CONSTRAINT "financial_accounts_currency_code" CHECK (currency IN ('AUD', 'EUR', 'USD'));
ALTER TABLE "import_batches" ADD CONSTRAINT "import_batches_currency_code" CHECK (currency IN ('AUD', 'EUR', 'USD'));
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_currency_code" CHECK (currency IN ('AUD', 'EUR', 'USD'));
ALTER TABLE "transaction_transfers" ADD CONSTRAINT "transaction_transfers_currency_code" CHECK (currency IN ('AUD', 'EUR', 'USD'));
ALTER TABLE "clients" ADD CONSTRAINT "clients_default_currency_code" CHECK (default_currency IN ('AUD', 'EUR', 'USD'));
ALTER TABLE "invoice_templates" ADD CONSTRAINT "invoice_templates_currency_code" CHECK (currency IN ('AUD', 'EUR', 'USD'));
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_currency_code" CHECK (currency IN ('AUD', 'EUR', 'USD'));
ALTER TABLE "payments" ADD CONSTRAINT "payments_currency_code" CHECK (currency IN ('AUD', 'EUR', 'USD'));
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_currency_code" CHECK (currency IN ('AUD', 'EUR', 'USD'));
ALTER TABLE "recurring_invoice_rules" ADD CONSTRAINT "recurring_invoice_rules_currency_code" CHECK (currency IN ('AUD', 'EUR', 'USD'));
ALTER TABLE "investment_accounts" ADD CONSTRAINT "investment_accounts_currency_code" CHECK (currency IN ('AUD', 'EUR', 'USD'));
ALTER TABLE "investments" ADD CONSTRAINT "investments_currency_code" CHECK (currency IN ('AUD', 'EUR', 'USD'));
ALTER TABLE "investment_movements" ADD CONSTRAINT "investment_movements_currency_code" CHECK (currency IN ('AUD', 'EUR', 'USD'));
ALTER TABLE "investment_valuations" ADD CONSTRAINT "investment_valuations_currency_code" CHECK (currency IN ('AUD', 'EUR', 'USD'));
ALTER TABLE "attachments" ADD CONSTRAINT "attachment_size" CHECK (byte_size >= 0);
ALTER TABLE "import_batches" ADD CONSTRAINT "import_period" CHECK (period_end IS NULL OR period_start IS NULL OR period_end >= period_start);
ALTER TABLE "import_batches" ADD CONSTRAINT "import_row_count" CHECK (row_count >= 0 AND row_count <= 500);
ALTER TABLE "import_batches" ADD CONSTRAINT "import_json" CHECK (jsonb_typeof(source_rows) = 'array' AND jsonb_typeof(review_decisions) = 'array');
ALTER TABLE "import_batches" ADD CONSTRAINT "import_confirmed" CHECK (status <> 'confirmed' OR confirmed_at IS NOT NULL);
ALTER TABLE "transactions" ADD CONSTRAINT "transaction_sign" CHECK ((type = 'income' AND amount_minor > 0) OR (type = 'expense' AND amount_minor < 0) OR (type = 'transfer' AND amount_minor <> 0));
ALTER TABLE "transactions" ADD CONSTRAINT "transaction_duplicate_self" CHECK (duplicate_of_id IS NULL OR duplicate_of_id <> id);
ALTER TABLE "transactions" ADD CONSTRAINT "transaction_source_row" CHECK (source_row IS NULL OR (import_batch_id IS NOT NULL AND source_row >= 1));
ALTER TABLE "transaction_splits" ADD CONSTRAINT "split_amount" CHECK (amount_minor > 0);
ALTER TABLE "transaction_transfers" ADD CONSTRAINT "transfer_distinct" CHECK (outgoing_transaction_id <> incoming_transaction_id);
ALTER TABLE "categories" ADD CONSTRAINT "category_kind" CHECK (kind IN ('income', 'expense'));
ALTER TABLE "category_rules" ADD CONSTRAINT "rule_priority" CHECK (priority >= 0);
ALTER TABLE "category_rules" ADD CONSTRAINT "rule_field" CHECK (match_field IN ('description','merchant','reference'));
ALTER TABLE "clients" ADD CONSTRAINT "clients_terms" CHECK (payment_terms_days BETWEEN 0 AND 3650);
ALTER TABLE "invoice_templates" ADD CONSTRAINT "invoice_templates_terms" CHECK (payment_terms_days BETWEEN 0 AND 3650);
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_terms" CHECK (payment_terms_days BETWEEN 0 AND 3650);
ALTER TABLE "clients" ADD CONSTRAINT "client_business" CHECK (type <> 'business' OR nullif(btrim(business_name), '') IS NOT NULL);
ALTER TABLE "invoice_templates" ADD CONSTRAINT "template_items" CHECK (jsonb_typeof(default_items_json) = 'array');
ALTER TABLE "invoices" ADD CONSTRAINT "invoice_dates" CHECK (due_date >= issue_date);
ALTER TABLE "invoices" ADD CONSTRAINT "invoice_totals" CHECK (subtotal_minor >= 0 AND tax_minor >= 0 AND discount_minor BETWEEN 0 AND subtotal_minor AND total_minor = subtotal_minor - discount_minor + tax_minor);
ALTER TABLE "invoices" ADD CONSTRAINT "invoice_cancelled" CHECK ((lifecycle = 'cancelled') = (cancelled_at IS NOT NULL));
ALTER TABLE "invoice_items" ADD CONSTRAINT "item_values" CHECK (position >= 0 AND quantity > 0 AND unit_price >= 0 AND tax_rate BETWEEN 0 AND 100 AND base_minor >= 0 AND discount_minor BETWEEN 0 AND base_minor AND tax_minor >= 0 AND line_total_minor = base_minor - discount_minor + tax_minor);
ALTER TABLE "invoice_items" ADD CONSTRAINT "item_rounding" CHECK (base_minor = round(quantity * unit_price * 100) AND tax_minor = round((base_minor - discount_minor) * tax_rate / 100));
ALTER TABLE "payments" ADD CONSTRAINT "payment_positive" CHECK (amount_minor > 0);
ALTER TABLE "payments" ADD CONSTRAINT "confirmed_payment_link" CHECK (status <> 'confirmed' OR transaction_id IS NOT NULL);
ALTER TABLE "payment_allocations" ADD CONSTRAINT "allocation_positive" CHECK (amount_minor > 0);
ALTER TABLE "investment_movements" ADD CONSTRAINT "movement_values" CHECK (amount_minor >= 0 AND fee_minor >= 0 AND (quantity IS NULL OR quantity > 0) AND (unit_price IS NULL OR unit_price >= 0));
ALTER TABLE "investment_movements" ADD CONSTRAINT "movement_kind" CHECK ((type NOT IN ('buy','sell') OR (quantity IS NOT NULL AND unit_price IS NOT NULL)) AND (type <> 'fee' OR fee_minor = 0) AND (type NOT IN ('sell','dividend','interest') OR fee_minor <= amount_minor));
ALTER TABLE "investment_valuations" ADD CONSTRAINT "valuation_values" CHECK (estimated_value_minor >= 0 AND source = 'manual');
ALTER TABLE "automation_runs" ADD CONSTRAINT "run_dates" CHECK (finished_at IS NULL OR (started_at IS NOT NULL AND finished_at >= started_at));
ALTER TABLE "notifications" ADD CONSTRAINT "notification_read" CHECK ((status = 'read') = (read_at IS NOT NULL));
ALTER TABLE "notification_preferences" ADD CONSTRAINT "preference_time" CHECK (preferred_time IS NULL OR preferred_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');

-- NULL workspace denotes a personal/global preference; PostgreSQL ordinary
-- nullable uniqueness alone does not enforce this scope.
CREATE UNIQUE INDEX notification_preferences_global_unique
ON notification_preferences(user_id, event_type, channel) WHERE workspace_id IS NULL;
CREATE UNIQUE INDEX workspace_invitations_pending_unique
ON workspace_invitations(workspace_id, invited_email) WHERE status = 'pending';
CREATE UNIQUE INDEX workspace_members_one_active_owner
ON workspace_members(workspace_id) WHERE role = 'owner' AND status = 'active';

-- A write fence serializes accounting mutations per workspace. Incrementing
-- a row version (rather than a bare advisory lock) also forces stale snapshot
-- transactions at REPEATABLE READ/SERIALIZABLE to abort instead of write skew.
CREATE FUNCTION ef_financial_fence() RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE wid uuid;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.workspace_id <> OLD.workspace_id THEN
    RAISE EXCEPTION 'Financial ownership is immutable' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'DELETE' THEN wid := OLD.workspace_id; ELSE wid := NEW.workspace_id; END IF;
  UPDATE workspaces SET integrity_version = integrity_version + 1 WHERE id = wid;
  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END $$;

-- Aggregate constraints run against the final transaction state, allowing
-- invoice/items, receipt/allocation and split replacement to commit atomically.
CREATE FUNCTION ef_check_financial_state() RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE wid uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN wid := OLD.workspace_id; ELSE wid := NEW.workspace_id; END IF;
  IF EXISTS (
    SELECT 1 FROM invoices i LEFT JOIN invoice_items x ON x.invoice_id = i.id
    WHERE i.workspace_id = wid GROUP BY i.id
    HAVING i.subtotal_minor <> COALESCE(sum(x.base_minor),0)
      OR i.discount_minor <> COALESCE(sum(x.discount_minor),0)
      OR i.tax_minor <> COALESCE(sum(x.tax_minor),0)
      OR i.total_minor <> COALESCE(sum(x.line_total_minor),0)
      OR (i.lifecycle = 'issued' AND (count(x.id) = 0 OR i.total_minor <= 0))
  ) THEN RAISE EXCEPTION 'Invoice items must reconcile' USING ERRCODE = '23514'; END IF;
  IF EXISTS (
    SELECT 1 FROM payment_allocations a JOIN invoices i ON i.id=a.invoice_id
    JOIN payments p ON p.id=a.payment_id WHERE a.workspace_id=wid
      AND (i.lifecycle <> 'issued' OR p.status <> 'confirmed')
  ) OR EXISTS (
    SELECT 1 FROM payment_allocations a JOIN invoices i ON i.id=a.invoice_id
    WHERE a.workspace_id=wid GROUP BY i.id HAVING sum(a.amount_minor)>i.total_minor
  ) OR EXISTS (
    SELECT 1 FROM payment_allocations a JOIN payments p ON p.id=a.payment_id
    WHERE a.workspace_id=wid GROUP BY p.id HAVING sum(a.amount_minor)>p.amount_minor
  ) THEN RAISE EXCEPTION 'Invalid or excessive allocation' USING ERRCODE = '23514'; END IF;
  IF EXISTS (
    SELECT 1 FROM payments p JOIN transactions t ON t.id=p.transaction_id
    WHERE p.workspace_id=wid AND p.status='confirmed' AND
      (t.type <> 'income' OR t.excluded_at IS NOT NULL OR t.amount_minor<>p.amount_minor OR t.booking_date<>p.paid_at)
  ) THEN RAISE EXCEPTION 'Payment must reuse one compatible receipt' USING ERRCODE = '23514'; END IF;
  IF EXISTS (
    SELECT 1 FROM transactions t JOIN import_batches b ON b.id=t.import_batch_id
    WHERE t.workspace_id=wid AND t.account_id<>b.financial_account_id
  ) THEN RAISE EXCEPTION 'Imported account must match batch account' USING ERRCODE = '23514'; END IF;
  IF EXISTS (
    SELECT 1 FROM transaction_splits s JOIN transactions t ON t.id=s.transaction_id
    WHERE s.workspace_id=wid GROUP BY t.id
    HAVING count(s.id)<2 OR sum(s.amount_minor)<>-t.amount_minor OR t.type<>'expense'
  ) OR EXISTS (
    SELECT 1 FROM transaction_splits s JOIN categories c ON c.id=s.category_id
    WHERE s.workspace_id=wid AND c.kind<>'expense'
  ) THEN RAISE EXCEPTION 'Expense splits must reconcile exactly' USING ERRCODE = '23514'; END IF;
  IF EXISTS (
    SELECT 1 FROM transaction_transfers p
    JOIN transactions o ON o.id=p.outgoing_transaction_id
    JOIN transactions i ON i.id=p.incoming_transaction_id
    WHERE p.workspace_id=wid AND (o.type<>'transfer' OR i.type<>'transfer' OR
      o.amount_minor>=0 OR i.amount_minor<>-o.amount_minor OR o.account_id=i.account_id OR
      (o.excluded_at IS NULL)<>(i.excluded_at IS NULL))
  ) OR EXISTS (
    SELECT 1 FROM (SELECT outgoing_transaction_id AS id FROM transaction_transfers WHERE workspace_id=wid
      UNION ALL SELECT incoming_transaction_id FROM transaction_transfers WHERE workspace_id=wid) t
    GROUP BY id HAVING count(*)>1
  ) THEN RAISE EXCEPTION 'Invalid internal transfer pair' USING ERRCODE = '23514'; END IF;
  RETURN NULL;
END $$;
CREATE TRIGGER invoices_fence BEFORE INSERT OR UPDATE OR DELETE ON invoices FOR EACH ROW EXECUTE FUNCTION ef_financial_fence();
CREATE CONSTRAINT TRIGGER invoices_financial_check AFTER INSERT OR UPDATE OR DELETE ON invoices DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION ef_check_financial_state();
CREATE TRIGGER invoice_items_fence BEFORE INSERT OR UPDATE OR DELETE ON invoice_items FOR EACH ROW EXECUTE FUNCTION ef_financial_fence();
CREATE CONSTRAINT TRIGGER invoice_items_financial_check AFTER INSERT OR UPDATE OR DELETE ON invoice_items DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION ef_check_financial_state();
CREATE TRIGGER payments_fence BEFORE INSERT OR UPDATE OR DELETE ON payments FOR EACH ROW EXECUTE FUNCTION ef_financial_fence();
CREATE CONSTRAINT TRIGGER payments_financial_check AFTER INSERT OR UPDATE OR DELETE ON payments DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION ef_check_financial_state();
CREATE TRIGGER payment_allocations_fence BEFORE INSERT OR UPDATE OR DELETE ON payment_allocations FOR EACH ROW EXECUTE FUNCTION ef_financial_fence();
CREATE CONSTRAINT TRIGGER payment_allocations_financial_check AFTER INSERT OR UPDATE OR DELETE ON payment_allocations DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION ef_check_financial_state();
CREATE TRIGGER transactions_fence BEFORE INSERT OR UPDATE OR DELETE ON transactions FOR EACH ROW EXECUTE FUNCTION ef_financial_fence();
CREATE CONSTRAINT TRIGGER transactions_financial_check AFTER INSERT OR UPDATE OR DELETE ON transactions DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION ef_check_financial_state();
CREATE TRIGGER transaction_splits_fence BEFORE INSERT OR UPDATE OR DELETE ON transaction_splits FOR EACH ROW EXECUTE FUNCTION ef_financial_fence();
CREATE CONSTRAINT TRIGGER transaction_splits_financial_check AFTER INSERT OR UPDATE OR DELETE ON transaction_splits DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION ef_check_financial_state();
CREATE TRIGGER transaction_transfers_fence BEFORE INSERT OR UPDATE OR DELETE ON transaction_transfers FOR EACH ROW EXECUTE FUNCTION ef_financial_fence();
CREATE CONSTRAINT TRIGGER transaction_transfers_financial_check AFTER INSERT OR UPDATE OR DELETE ON transaction_transfers DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION ef_check_financial_state();
CREATE TRIGGER categories_fence BEFORE INSERT OR UPDATE OR DELETE ON categories FOR EACH ROW EXECUTE FUNCTION ef_financial_fence();
CREATE CONSTRAINT TRIGGER categories_financial_check AFTER INSERT OR UPDATE OR DELETE ON categories DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION ef_check_financial_state();

-- Ownership must be established in the same transaction as workspace creation.
CREATE FUNCTION ef_check_owner() RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE wid uuid;
BEGIN
  IF TG_TABLE_NAME='workspaces' THEN wid:=NEW.id;
  ELSIF TG_OP='DELETE' THEN wid:=OLD.workspace_id;
  ELSE wid:=NEW.workspace_id; END IF;
  IF EXISTS(SELECT 1 FROM workspaces w WHERE w.id=wid AND NOT EXISTS
    (SELECT 1 FROM workspace_members m WHERE m.workspace_id=w.id
      AND m.user_id=w.owner_user_id AND m.role='owner' AND m.status='active'))
  THEN RAISE EXCEPTION 'Workspace requires its active owner membership' USING ERRCODE='23514'; END IF;
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER workspace_owner_check AFTER INSERT OR UPDATE ON workspaces
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION ef_check_owner();
CREATE CONSTRAINT TRIGGER member_owner_check AFTER INSERT OR UPDATE OR DELETE ON workspace_members
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION ef_check_owner();

-- Serialize membership changes with owner-pointer updates as well.
CREATE TRIGGER workspace_members_fence BEFORE INSERT OR UPDATE OR DELETE ON workspace_members
FOR EACH ROW EXECUTE FUNCTION ef_financial_fence();
-- Batch remapping must not invalidate already-linked transactions.
CREATE TRIGGER import_batches_fence BEFORE INSERT OR UPDATE OR DELETE ON import_batches
FOR EACH ROW EXECUTE FUNCTION ef_financial_fence();
CREATE CONSTRAINT TRIGGER import_batches_financial_check AFTER INSERT OR UPDATE OR DELETE ON import_batches
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION ef_check_financial_state();

-- Existing client-source and participant filters need independent attribution.
ALTER TABLE transactions ADD COLUMN client_id UUID;
ALTER TABLE transactions ADD CONSTRAINT transactions_client_id_workspace_id_fkey
FOREIGN KEY (client_id, workspace_id) REFERENCES clients(id, workspace_id) ON DELETE RESTRICT ON UPDATE RESTRICT;
CREATE INDEX transactions_client_id_workspace_id_idx ON transactions(client_id, workspace_id);
ALTER TABLE invoices ADD COLUMN participant_id UUID;
ALTER TABLE invoices ADD CONSTRAINT invoices_participant_id_fkey
FOREIGN KEY (participant_id) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE RESTRICT;
CREATE INDEX invoices_participant_id_idx ON invoices(participant_id);
COMMIT;
