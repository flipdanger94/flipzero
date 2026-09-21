CREATE TABLE IF NOT EXISTS "voice_states" (
  "user_id" text PRIMARY KEY NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "channel_id" text NOT NULL REFERENCES "channels"("id") ON DELETE CASCADE,
  "self_muted" boolean DEFAULT false NOT NULL,
  "self_deafened" boolean DEFAULT false NOT NULL,
  "streaming" boolean DEFAULT false NOT NULL,
  "joined_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "voice_states_channel_idx" ON "voice_states" ("channel_id");
