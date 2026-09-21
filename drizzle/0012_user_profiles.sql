ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "profile_location" text;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "profile_status" text;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "profile_links" jsonb DEFAULT '[]'::jsonb NOT NULL;
