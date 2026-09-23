CREATE TABLE IF NOT EXISTS "password_reset_tokens" (
  "id" text PRIMARY KEY,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "token_hash" text NOT NULL,
  "expires_at" timestamptz NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "password_reset_user_created_idx" ON "password_reset_tokens" ("user_id", "created_at");
CREATE UNIQUE INDEX IF NOT EXISTS "password_reset_token_unique" ON "password_reset_tokens" ("token_hash");
CREATE TABLE IF NOT EXISTS "password_reset_attempts" (
  "id" text PRIMARY KEY,
  "ip_hash" text NOT NULL,
  "email_hash" text NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "password_reset_ip_created_idx" ON "password_reset_attempts" ("ip_hash", "created_at");
CREATE INDEX IF NOT EXISTS "password_reset_email_created_idx" ON "password_reset_attempts" ("email_hash", "created_at");
