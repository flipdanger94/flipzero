CREATE TABLE IF NOT EXISTS "channel_categories" (
  "id" text PRIMARY KEY,
  "space_id" text NOT NULL REFERENCES "spaces"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "position" integer DEFAULT 0 NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "channel_categories_space_position_idx" ON "channel_categories" ("space_id", "position");
ALTER TABLE "channels" ADD CONSTRAINT "channels_parent_id_channel_categories_id_fk" FOREIGN KEY ("parent_id") REFERENCES "channel_categories"("id") ON DELETE SET NULL;
