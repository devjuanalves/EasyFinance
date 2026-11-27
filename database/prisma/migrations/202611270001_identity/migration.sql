-- Additive identity-only migration; original 34 tables and financial fences unchanged.
CREATE TABLE email_verification_tokens (
 id UUID PRIMARY KEY, created_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 token_hash TEXT NOT NULL UNIQUE CHECK (token_hash ~ '^[a-f0-9]{64}$'),
 user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
 email TEXT NOT NULL, original_email TEXT NOT NULL,
 purpose TEXT NOT NULL CHECK (purpose IN ('verify','change')),
 expires_at TIMESTAMPTZ(6) NOT NULL, used_at TIMESTAMPTZ(6),
 CHECK (expires_at > created_at)
);
CREATE INDEX email_verification_tokens_user_id_expires_at_idx ON email_verification_tokens(user_id,expires_at);
CREATE TABLE account_security_events (
 id UUID PRIMARY KEY, created_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 user_id UUID REFERENCES users(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
 action TEXT NOT NULL CHECK (action IN ('login_succeeded','login_failed','password_changed','session_revoked','reset_requested','reset_completed','verification_requested','verification_completed','email_change_requested','email_changed','delivery_unavailable','delivery_failed'))
);
CREATE INDEX account_security_events_user_id_created_at_idx ON account_security_events(user_id,created_at);
CREATE INDEX account_security_events_created_at_idx ON account_security_events(created_at);
CREATE TABLE identity_rate_buckets (
 key TEXT PRIMARY KEY CHECK (key ~ '^[a-f0-9]{64}$'),
 count INTEGER NOT NULL CHECK (count BETWEEN 1 AND 1000000),
 expires_at TIMESTAMPTZ(6) NOT NULL
);
CREATE INDEX identity_rate_buckets_expires_at_idx ON identity_rate_buckets(expires_at);
