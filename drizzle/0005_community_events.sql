CREATE TABLE IF NOT EXISTS "community_events" (
 "id" text PRIMARY KEY NOT NULL,
 "space_id" text NOT NULL REFERENCES "spaces"("id") ON DELETE cascade,
 "creator_id" text NOT NULL REFERENCES "users"("id") ON DELETE cascade,
 "title" text NOT NULL,
 "description" text,
 "location" text,
 "starts_at" timestamp with time zone NOT NULL,
 "ends_at" timestamp with time zone,
 "capacity" integer,
 "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "community_events_space_start_idx" ON "community_events" ("space_id","starts_at");
CREATE TABLE IF NOT EXISTS "event_attendees" (
 "event_id" text NOT NULL REFERENCES "community_events"("id") ON DELETE cascade,
 "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE cascade,
 "joined_at" timestamp with time zone DEFAULT now() NOT NULL,
 CONSTRAINT "event_attendees_event_id_user_id_pk" PRIMARY KEY("event_id","user_id")
);
CREATE INDEX IF NOT EXISTS "event_attendees_user_idx" ON "event_attendees" ("user_id");
