ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "onboarding_step" integer DEFAULT 0 NOT NULL;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "onboarding_completed" boolean DEFAULT false NOT NULL;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "totp_enabled" boolean DEFAULT false NOT NULL;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "totp_secret_encrypted" text;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "backup_code_hashes" jsonb DEFAULT '[]'::jsonb NOT NULL;
UPDATE "users" SET "onboarding_completed" = true, "onboarding_step" = 4 WHERE "created_at" < now() - interval '1 minute' AND "onboarding_completed" = false;
CREATE TABLE IF NOT EXISTS "login_history" (
  "id" text PRIMARY KEY,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "user_agent" text,
  "ip_hash" text,
  "successful" boolean DEFAULT true NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "login_history_user_created_idx" ON "login_history" ("user_id", "created_at");
