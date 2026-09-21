CREATE TABLE IF NOT EXISTS "reports" (
  "id" text PRIMARY KEY,
  "reporter_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "target_type" text NOT NULL,
  "target_id" text NOT NULL,
  "reason" text NOT NULL,
  "description" text,
  "status" text DEFAULT 'open' NOT NULL,
  "assigned_moderator_id" text REFERENCES "users"("id") ON DELETE SET NULL,
  "moderator_note" text,
  "resolved_at" timestamptz,
  "created_at" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "reports_status_created_idx" ON "reports" ("status","created_at");
CREATE INDEX IF NOT EXISTS "reports_target_idx" ON "reports" ("target_type","target_id");

CREATE TABLE IF NOT EXISTS "user_blocks" (
  "blocker_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "blocked_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "user_blocks_blocker_id_blocked_id_pk" PRIMARY KEY ("blocker_id","blocked_id")
);
CREATE INDEX IF NOT EXISTS "user_blocks_blocked_idx" ON "user_blocks" ("blocked_id");

CREATE TABLE IF NOT EXISTS "user_privacy_settings" (
  "user_id" text PRIMARY KEY REFERENCES "users"("id") ON DELETE CASCADE,
  "direct_messages" boolean DEFAULT true NOT NULL,
  "friend_requests" boolean DEFAULT true NOT NULL,
  "profile_discovery" boolean DEFAULT true NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "notifications" (
  "id" text PRIMARY KEY,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "actor_id" text REFERENCES "users"("id") ON DELETE SET NULL,
  "type" text NOT NULL,
  "title" text NOT NULL,
  "body" text,
  "entity_type" text,
  "entity_id" text,
  "read_at" timestamptz,
  "created_at" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "notifications_user_created_idx" ON "notifications" ("user_id","created_at");
CREATE INDEX IF NOT EXISTS "notifications_user_read_idx" ON "notifications" ("user_id","read_at");
