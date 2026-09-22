CREATE TABLE IF NOT EXISTS "developer_oauth_clients" (
  "app_id" text PRIMARY KEY NOT NULL REFERENCES "developer_apps"("id") ON DELETE cascade,
  "client_id" text NOT NULL,
  "client_secret_hash" text NOT NULL,
  "secret_prefix" text NOT NULL,
  "redirect_uris" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "scopes" jsonb DEFAULT '["identify"]'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "developer_oauth_client_id_unique" ON "developer_oauth_clients" ("client_id");

CREATE TABLE IF NOT EXISTS "developer_webhooks" (
  "id" text PRIMARY KEY NOT NULL,
  "app_id" text NOT NULL REFERENCES "developer_apps"("id") ON DELETE cascade,
  "name" text NOT NULL,
  "url" text NOT NULL,
  "event_types" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "secret_hash" text NOT NULL,
  "secret_ciphertext" text NOT NULL,
  "secret_prefix" text NOT NULL,
  "enabled" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "developer_webhooks_app_idx" ON "developer_webhooks" ("app_id");

CREATE TABLE IF NOT EXISTS "developer_oauth_authorization_codes" (
  "id" text PRIMARY KEY NOT NULL,
  "code_hash" text NOT NULL,
  "app_id" text NOT NULL REFERENCES "developer_apps"("id") ON DELETE cascade,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "redirect_uri" text NOT NULL,
  "scopes" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "code_challenge" text,
  "expires_at" timestamp with time zone NOT NULL,
  "consumed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "developer_oauth_code_hash_unique" ON "developer_oauth_authorization_codes" ("code_hash");
CREATE INDEX IF NOT EXISTS "developer_oauth_code_app_idx" ON "developer_oauth_authorization_codes" ("app_id", "expires_at");

CREATE TABLE IF NOT EXISTS "developer_oauth_access_tokens" (
  "id" text PRIMARY KEY NOT NULL,
  "app_id" text NOT NULL REFERENCES "developer_apps"("id") ON DELETE cascade,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "token_hash" text NOT NULL,
  "prefix" text NOT NULL,
  "scopes" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "last_used_at" timestamp with time zone,
  "expires_at" timestamp with time zone NOT NULL,
  "revoked_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "developer_oauth_access_token_hash_unique" ON "developer_oauth_access_tokens" ("token_hash");
CREATE INDEX IF NOT EXISTS "developer_oauth_access_token_app_user_idx" ON "developer_oauth_access_tokens" ("app_id", "user_id");

CREATE TABLE IF NOT EXISTS "developer_app_installations" (
  "app_id" text NOT NULL REFERENCES "developer_apps"("id") ON DELETE cascade,
  "space_id" text NOT NULL REFERENCES "spaces"("id") ON DELETE cascade,
  "installed_by_id" text NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "permissions" jsonb DEFAULT '["events:read"]'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "developer_app_installation_unique" ON "developer_app_installations" ("app_id", "space_id");
CREATE INDEX IF NOT EXISTS "developer_app_installations_space_idx" ON "developer_app_installations" ("space_id");

CREATE TABLE IF NOT EXISTS "developer_webhook_deliveries" (
  "id" text PRIMARY KEY NOT NULL,
  "webhook_id" text NOT NULL REFERENCES "developer_webhooks"("id") ON DELETE cascade,
  "event_id" text NOT NULL,
  "event_type" text NOT NULL,
  "status" text DEFAULT 'pending' NOT NULL,
  "attempt" integer DEFAULT 1 NOT NULL,
  "response_status" integer,
  "duration_ms" integer,
  "error" text,
  "completed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "developer_webhook_deliveries_webhook_created_idx" ON "developer_webhook_deliveries" ("webhook_id", "created_at");
CREATE INDEX IF NOT EXISTS "developer_webhook_deliveries_event_idx" ON "developer_webhook_deliveries" ("event_id");
