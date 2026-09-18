CREATE TABLE IF NOT EXISTS "board_items" (
 "id" text PRIMARY KEY NOT NULL,
 "channel_id" text NOT NULL REFERENCES "channels"("id") ON DELETE cascade,
 "author_id" text NOT NULL REFERENCES "users"("id") ON DELETE cascade,
 "title" text NOT NULL,
 "description" text,
 "status" text DEFAULT 'todo' NOT NULL,
 "position" integer DEFAULT 0 NOT NULL,
 "due_at" timestamp with time zone,
 "created_at" timestamp with time zone DEFAULT now() NOT NULL,
 "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "board_items_channel_status_idx" ON "board_items" ("channel_id","status","position");
