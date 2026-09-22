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
  "secret_prefix" text NOT NULL,
  "enabled" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "developer_webhooks_app_idx" ON "developer_webhooks" ("app_id");
