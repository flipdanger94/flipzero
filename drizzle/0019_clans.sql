DO $$ BEGIN
  CREATE TYPE clan_join_type AS ENUM ('open','application','closed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE clan_role AS ENUM ('leader','officer','member');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE clan_request_kind AS ENUM ('application','invite');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE clan_request_status AS ENUM ('pending','accepted','declined','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS clans (
  id text PRIMARY KEY,
  name text NOT NULL,
  tag text NOT NULL,
  description text,
  avatar_url text,
  banner_url text,
  join_type clan_join_type NOT NULL DEFAULT 'open',
  member_count integer NOT NULL DEFAULT 1 CHECK (member_count >= 0 AND member_count <= 50),
  leader_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS clans_name_unique ON clans (lower(name));
CREATE UNIQUE INDEX IF NOT EXISTS clans_tag_unique ON clans (upper(tag));
CREATE INDEX IF NOT EXISTS clans_join_type_members_idx ON clans(join_type, member_count);

CREATE TABLE IF NOT EXISTS clan_members (
  clan_id text NOT NULL REFERENCES clans(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role clan_role NOT NULL DEFAULT 'member',
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (clan_id, user_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS clan_members_user_unique ON clan_members(user_id);
CREATE INDEX IF NOT EXISTS clan_members_clan_role_idx ON clan_members(clan_id, role);

CREATE TABLE IF NOT EXISTS clan_requests (
  id text PRIMARY KEY,
  clan_id text NOT NULL REFERENCES clans(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  actor_id text REFERENCES users(id) ON DELETE SET NULL,
  kind clan_request_kind NOT NULL,
  status clan_request_status NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz
);
CREATE INDEX IF NOT EXISTS clan_requests_clan_status_idx ON clan_requests(clan_id, status, created_at);
CREATE INDEX IF NOT EXISTS clan_requests_user_status_idx ON clan_requests(user_id, status, created_at);
CREATE UNIQUE INDEX IF NOT EXISTS clan_requests_pending_unique ON clan_requests(clan_id, user_id, kind) WHERE status='pending';

CREATE TABLE IF NOT EXISTS clan_messages (
  id text PRIMARY KEY,
  clan_id text NOT NULL REFERENCES clans(id) ON DELETE CASCADE,
  author_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content text NOT NULL,
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  edited_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS clan_messages_clan_created_idx ON clan_messages(clan_id, created_at);
CREATE INDEX IF NOT EXISTS clan_messages_author_idx ON clan_messages(author_id);
