CREATE TABLE IF NOT EXISTS "space_notification_settings" (
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "space_id" text NOT NULL REFERENCES "spaces"("id") ON DELETE CASCADE,
  "mode" text DEFAULT 'mentions' NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  PRIMARY KEY ("user_id", "space_id")
);
