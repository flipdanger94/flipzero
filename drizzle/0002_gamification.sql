DO $$ BEGIN
 CREATE TYPE "progress_path" AS ENUM('social', 'voice', 'organizer', 'creator');
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "achievement_rarity" AS ENUM('common', 'rare', 'epic', 'legendary');
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "path_progress" (
 "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE cascade,
 "scope_id" text DEFAULT 'global' NOT NULL,
 "path" "progress_path" NOT NULL,
 "xp" bigint DEFAULT 0 NOT NULL,
 "level" integer DEFAULT 1 NOT NULL,
 "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
 CONSTRAINT "path_progress_user_id_scope_id_path_pk" PRIMARY KEY("user_id","scope_id","path")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "path_progress_user_idx" ON "path_progress" ("user_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "achievement_definitions" (
 "id" text PRIMARY KEY NOT NULL,
 "space_id" text REFERENCES "spaces"("id") ON DELETE cascade,
 "key" text NOT NULL,
 "name" text NOT NULL,
 "description" text NOT NULL,
 "icon" text DEFAULT '✦' NOT NULL,
 "rarity" "achievement_rarity" DEFAULT 'common' NOT NULL,
 "event_source" text NOT NULL,
 "target" integer NOT NULL,
 "xp_reward" integer DEFAULT 0 NOT NULL,
 "is_secret" boolean DEFAULT false NOT NULL,
 "created_by" text REFERENCES "users"("id") ON DELETE set null,
 "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "achievement_definitions_scope_key_unique" ON "achievement_definitions" ("space_id","key");
CREATE INDEX IF NOT EXISTS "achievement_definitions_space_idx" ON "achievement_definitions" ("space_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_achievements" (
 "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE cascade,
 "achievement_id" text NOT NULL REFERENCES "achievement_definitions"("id") ON DELETE cascade,
 "progress" integer DEFAULT 0 NOT NULL,
 "unlocked_at" timestamp with time zone,
 "is_showcased" boolean DEFAULT false NOT NULL,
 "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
 CONSTRAINT "user_achievements_user_id_achievement_id_pk" PRIMARY KEY("user_id","achievement_id")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_achievements_showcase_idx" ON "user_achievements" ("user_id","is_showcased");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "profile_cosmetics" (
 "user_id" text PRIMARY KEY NOT NULL REFERENCES "users"("id") ON DELETE cascade,
 "title" text DEFAULT 'Путешественник' NOT NULL,
 "avatar_frame" text DEFAULT 'coral' NOT NULL,
 "profile_effect" text DEFAULT 'glow' NOT NULL,
 "showcased_path" "progress_path" DEFAULT 'social' NOT NULL,
 "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
INSERT INTO "achievement_definitions" ("id","key","name","description","icon","rarity","event_source","target","xp_reward") VALUES
 ('global-first-message','first-message','Первый импульс','Отправьте первое сообщение','⚡','common','message',1,50),
 ('global-social-10','social-10','В центре разговора','Отправьте 10 сообщений','💬','rare','message',10,150),
 ('global-social-50','social-50','Голос сообщества','Отправьте 50 сообщений','✦','epic','message',50,400),
 ('global-level-5','level-5','Новая высота','Достигните 5 уровня','▲','rare','level',5,250)
ON CONFLICT DO NOTHING;
