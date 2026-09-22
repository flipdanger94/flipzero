CREATE TABLE IF NOT EXISTS "space_join_requests" (
  "id" text PRIMARY KEY NOT NULL,
  "space_id" text NOT NULL REFERENCES "spaces"("id") ON DELETE CASCADE,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "message" text,
  "status" text DEFAULT 'pending' NOT NULL,
  "reviewed_by_id" text REFERENCES "users"("id") ON DELETE SET NULL,
  "reviewed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "space_join_requests_space_user_unique"
  ON "space_join_requests" ("space_id", "user_id");

CREATE INDEX IF NOT EXISTS "space_join_requests_space_status_idx"
  ON "space_join_requests" ("space_id", "status", "created_at");

CREATE INDEX IF NOT EXISTS "space_join_requests_user_status_idx"
  ON "space_join_requests" ("user_id", "status");
