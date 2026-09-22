CREATE TABLE IF NOT EXISTS "space_audit_logs" (
  "id" text PRIMARY KEY NOT NULL,
  "space_id" text NOT NULL REFERENCES "spaces"("id") ON DELETE CASCADE,
  "actor_id" text REFERENCES "users"("id") ON DELETE SET NULL,
  "action" text NOT NULL,
  "target_type" text,
  "target_id" text,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "space_audit_space_created_idx"
  ON "space_audit_logs" ("space_id", "created_at");

CREATE INDEX IF NOT EXISTS "space_audit_actor_idx"
  ON "space_audit_logs" ("actor_id");
