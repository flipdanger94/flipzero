CREATE TABLE IF NOT EXISTS "developer_apps" (
 "id" text PRIMARY KEY NOT NULL,
 "owner_id" text NOT NULL REFERENCES "users"("id") ON DELETE cascade,
 "name" text NOT NULL,
 "description" text,
 "created_at" timestamp with time zone DEFAULT now() NOT NULL,
 "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "developer_apps_owner_idx" ON "developer_apps" ("owner_id");
CREATE TABLE IF NOT EXISTS "api_tokens" (
 "id" text PRIMARY KEY NOT NULL,
 "app_id" text NOT NULL REFERENCES "developer_apps"("id") ON DELETE cascade,
 "name" text NOT NULL,
 "token_hash" text NOT NULL,
 "prefix" text NOT NULL,
 "scopes" jsonb DEFAULT '["profile:read","spaces:read"]'::jsonb NOT NULL,
 "last_used_at" timestamp with time zone,
 "expires_at" timestamp with time zone,
 "revoked_at" timestamp with time zone,
 "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "api_tokens_hash_unique" ON "api_tokens" ("token_hash");
CREATE INDEX IF NOT EXISTS "api_tokens_app_idx" ON "api_tokens" ("app_id");
