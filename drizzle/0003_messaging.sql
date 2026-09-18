ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "thread_root_id" text;
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "pinned_at" timestamp with time zone;
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "pinned_by_id" text REFERENCES "users"("id") ON DELETE set null;
CREATE TABLE IF NOT EXISTS "channel_notification_settings" (
 "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE cascade,
 "channel_id" text NOT NULL REFERENCES "channels"("id") ON DELETE cascade,
 "mode" text DEFAULT 'mentions' NOT NULL,
 "muted_until" timestamp with time zone,
 "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
 CONSTRAINT "channel_notification_settings_user_id_channel_id_pk" PRIMARY KEY("user_id","channel_id")
);
