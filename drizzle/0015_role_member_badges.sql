ALTER TABLE "roles" ADD COLUMN IF NOT EXISTS "show_in_member_list" boolean DEFAULT false NOT NULL;
