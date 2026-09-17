CREATE TYPE "presence_status" AS ENUM ('online', 'idle', 'dnd', 'offline');
CREATE TYPE "space_visibility" AS ENUM ('private', 'application', 'public', 'invite_only');
CREATE TYPE "channel_kind" AS ENUM ('text', 'forum', 'voice', 'stage', 'announcement', 'board');
CREATE TYPE "moderation_action" AS ENUM ('warn', 'timeout', 'kick', 'ban', 'unban');

CREATE TABLE "users" ("id" text PRIMARY KEY, "email" text NOT NULL, "username" text NOT NULL, "display_name" text NOT NULL, "password_hash" text, "avatar_url" text, "banner_url" text, "bio" text, "accent_color" text DEFAULT '#ff5c70' NOT NULL, "presence" presence_status DEFAULT 'offline' NOT NULL, "email_verified_at" timestamptz, "global_xp" bigint DEFAULT 0 NOT NULL, "global_level" integer DEFAULT 1 NOT NULL, "created_at" timestamptz DEFAULT now() NOT NULL, "updated_at" timestamptz DEFAULT now() NOT NULL);
CREATE UNIQUE INDEX "users_email_unique" ON "users" ("email");
CREATE UNIQUE INDEX "users_username_unique" ON "users" ("username");

CREATE TABLE "sessions" ("id" text PRIMARY KEY, "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE, "token_hash" text NOT NULL, "user_agent" text, "ip_hash" text, "expires_at" timestamptz NOT NULL, "created_at" timestamptz DEFAULT now() NOT NULL);
CREATE UNIQUE INDEX "sessions_token_hash_unique" ON "sessions" ("token_hash");
CREATE INDEX "sessions_user_idx" ON "sessions" ("user_id");

CREATE TABLE "spaces" ("id" text PRIMARY KEY, "owner_id" text NOT NULL REFERENCES "users"("id"), "name" text NOT NULL, "slug" text NOT NULL, "description" text, "icon_url" text, "banner_url" text, "visibility" space_visibility DEFAULT 'invite_only' NOT NULL, "accent_color" text DEFAULT '#ff5c70' NOT NULL, "created_at" timestamptz DEFAULT now() NOT NULL, "updated_at" timestamptz DEFAULT now() NOT NULL);
CREATE UNIQUE INDEX "spaces_slug_unique" ON "spaces" ("slug");

CREATE TABLE "roles" ("id" text PRIMARY KEY, "space_id" text NOT NULL REFERENCES "spaces"("id") ON DELETE CASCADE, "name" text NOT NULL, "color" text DEFAULT '#918d9d' NOT NULL, "position" integer DEFAULT 0 NOT NULL, "permissions" bigint DEFAULT 0 NOT NULL, "is_managed" boolean DEFAULT false NOT NULL, "created_at" timestamptz DEFAULT now() NOT NULL);
CREATE TABLE "members" ("user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE, "space_id" text NOT NULL REFERENCES "spaces"("id") ON DELETE CASCADE, "nickname" text, "xp" bigint DEFAULT 0 NOT NULL, "level" integer DEFAULT 1 NOT NULL, "joined_at" timestamptz DEFAULT now() NOT NULL, PRIMARY KEY ("user_id", "space_id"));
CREATE TABLE "member_roles" ("user_id" text NOT NULL, "space_id" text NOT NULL, "role_id" text NOT NULL REFERENCES "roles"("id") ON DELETE CASCADE, PRIMARY KEY ("user_id", "space_id", "role_id"));

CREATE TABLE "channels" ("id" text PRIMARY KEY, "space_id" text NOT NULL REFERENCES "spaces"("id") ON DELETE CASCADE, "parent_id" text, "name" text NOT NULL, "topic" text, "kind" channel_kind DEFAULT 'text' NOT NULL, "position" integer DEFAULT 0 NOT NULL, "is_nsfw" boolean DEFAULT false NOT NULL, "slowmode_seconds" integer DEFAULT 0 NOT NULL, "created_at" timestamptz DEFAULT now() NOT NULL);
CREATE INDEX "channels_space_position_idx" ON "channels" ("space_id", "position");
CREATE TABLE "channel_overrides" ("channel_id" text NOT NULL REFERENCES "channels"("id") ON DELETE CASCADE, "target_id" text NOT NULL, "target_type" text NOT NULL, "allow" bigint DEFAULT 0 NOT NULL, "deny" bigint DEFAULT 0 NOT NULL, PRIMARY KEY ("channel_id", "target_id"));

CREATE TABLE "messages" ("id" text PRIMARY KEY, "channel_id" text NOT NULL REFERENCES "channels"("id") ON DELETE CASCADE, "author_id" text NOT NULL REFERENCES "users"("id"), "reply_to_id" text, "content" text NOT NULL, "attachments" jsonb DEFAULT '[]'::jsonb NOT NULL, "edited_at" timestamptz, "deleted_at" timestamptz, "created_at" timestamptz DEFAULT now() NOT NULL);
CREATE INDEX "messages_channel_created_idx" ON "messages" ("channel_id", "created_at");
CREATE TABLE "reactions" ("message_id" text NOT NULL REFERENCES "messages"("id") ON DELETE CASCADE, "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE, "emoji" text NOT NULL, "created_at" timestamptz DEFAULT now() NOT NULL, PRIMARY KEY ("message_id", "user_id", "emoji"));

CREATE TABLE "invites" ("code" text PRIMARY KEY, "space_id" text NOT NULL REFERENCES "spaces"("id") ON DELETE CASCADE, "channel_id" text REFERENCES "channels"("id") ON DELETE SET NULL, "creator_id" text NOT NULL REFERENCES "users"("id"), "max_uses" integer, "uses" integer DEFAULT 0 NOT NULL, "expires_at" timestamptz, "created_at" timestamptz DEFAULT now() NOT NULL);
CREATE TABLE "moderation_cases" ("id" text PRIMARY KEY, "space_id" text NOT NULL REFERENCES "spaces"("id") ON DELETE CASCADE, "target_user_id" text NOT NULL REFERENCES "users"("id"), "moderator_id" text NOT NULL REFERENCES "users"("id"), "action" moderation_action NOT NULL, "reason" text, "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL, "expires_at" timestamptz, "created_at" timestamptz DEFAULT now() NOT NULL);
CREATE TABLE "xp_events" ("id" text PRIMARY KEY, "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE, "space_id" text REFERENCES "spaces"("id") ON DELETE CASCADE, "source" text NOT NULL, "amount" integer NOT NULL, "idempotency_key" text NOT NULL, "created_at" timestamptz DEFAULT now() NOT NULL);
CREATE UNIQUE INDEX "xp_events_idempotency_unique" ON "xp_events" ("idempotency_key");
