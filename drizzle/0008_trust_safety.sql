CREATE TABLE IF NOT EXISTS "moderation_flags" (
 "id" text PRIMARY KEY NOT NULL,
 "space_id" text NOT NULL REFERENCES "spaces"("id") ON DELETE cascade,
 "channel_id" text NOT NULL REFERENCES "channels"("id") ON DELETE cascade,
 "message_id" text NOT NULL REFERENCES "messages"("id") ON DELETE cascade,
 "author_id" text NOT NULL REFERENCES "users"("id") ON DELETE cascade,
 "category" text NOT NULL,
 "severity" text NOT NULL,
 "confidence" integer NOT NULL,
 "summary" text NOT NULL,
 "evidence" jsonb DEFAULT '[]'::jsonb NOT NULL,
 "status" text DEFAULT 'pending' NOT NULL,
 "auto_hidden" boolean DEFAULT false NOT NULL,
 "reviewed_by_id" text REFERENCES "users"("id") ON DELETE set null,
 "reviewed_at" timestamp with time zone,
 "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "moderation_flags_message_unique" ON "moderation_flags" ("message_id");
CREATE INDEX IF NOT EXISTS "moderation_flags_space_status_idx" ON "moderation_flags" ("space_id", "status", "created_at");
