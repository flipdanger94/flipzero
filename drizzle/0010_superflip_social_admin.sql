DO $$ BEGIN
  CREATE TYPE platform_role AS ENUM ('user', 'admin');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE superflip_source AS ENUM ('purchase', 'gift');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE friend_request_status AS ENUM ('pending', 'accepted', 'declined');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE users ADD COLUMN IF NOT EXISTS platform_role platform_role NOT NULL DEFAULT 'user';
ALTER TABLE users ADD COLUMN IF NOT EXISTS banned_at timestamptz;
ALTER TABLE users ADD COLUMN IF NOT EXISTS ban_reason text;

CREATE TABLE IF NOT EXISTS superflip_purchases (
  id text PRIMARY KEY, user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  granted_by text REFERENCES users(id) ON DELETE SET NULL, granted_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz, source superflip_source NOT NULL, reason text, revoked_at timestamptz
);
CREATE INDEX IF NOT EXISTS superflip_user_status_idx ON superflip_purchases(user_id, expires_at, revoked_at);
CREATE TABLE IF NOT EXISTS superflip_waitlist (user_id text PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, joined_at timestamptz NOT NULL DEFAULT now());

CREATE TABLE IF NOT EXISTS direct_conversations (id text PRIMARY KEY, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS direct_conversation_members (
  conversation_id text NOT NULL REFERENCES direct_conversations(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE, joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (conversation_id, user_id)
);
CREATE INDEX IF NOT EXISTS direct_members_user_idx ON direct_conversation_members(user_id);
CREATE TABLE IF NOT EXISTS direct_messages (
  id text PRIMARY KEY, conversation_id text NOT NULL REFERENCES direct_conversations(id) ON DELETE CASCADE,
  sender_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE, receiver_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  text text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), read_at timestamptz, deleted_at timestamptz
);
CREATE INDEX IF NOT EXISTS direct_messages_conversation_idx ON direct_messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS direct_messages_receiver_unread_idx ON direct_messages(receiver_id, read_at);

CREATE TABLE IF NOT EXISTS friend_requests (
  id text PRIMARY KEY, from_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE, status friend_request_status NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(), responded_at timestamptz, UNIQUE(from_id, to_id), CHECK(from_id <> to_id)
);
CREATE INDEX IF NOT EXISTS friend_requests_to_status_idx ON friend_requests(to_id, status);
CREATE TABLE IF NOT EXISTS friends (
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE, friend_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(user_id, friend_id), CHECK(user_id <> friend_id)
);
CREATE INDEX IF NOT EXISTS friends_friend_idx ON friends(friend_id);

CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id text PRIMARY KEY, admin_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  action text NOT NULL, target_user_id text REFERENCES users(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS admin_audit_created_idx ON admin_audit_logs(created_at);
