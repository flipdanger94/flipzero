CREATE TABLE IF NOT EXISTS "space_placements" (
  "space_id" text PRIMARY KEY NOT NULL REFERENCES "spaces"("id") ON DELETE cascade,
  "shard_id" text DEFAULT 'primary' NOT NULL,
  "home_region" text DEFAULT 'global' NOT NULL,
  "state" text DEFAULT 'active' NOT NULL,
  "version" integer DEFAULT 1 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "space_placements_shard_state_idx" ON "space_placements" ("shard_id", "state");
INSERT INTO "space_placements" ("space_id", "shard_id", "home_region", "state", "version")
SELECT "id", 'primary', 'global', 'active', 1 FROM "spaces"
ON CONFLICT ("space_id") DO NOTHING;
