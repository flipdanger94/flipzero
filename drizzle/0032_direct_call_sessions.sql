BEGIN;

CREATE TABLE IF NOT EXISTS direct_call_sessions (
  id text PRIMARY KEY,
  room_name text NOT NULL,
  caller_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  receiver_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  video boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'ringing',
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  answered_at timestamptz,
  ended_at timestamptz
);

DO $$ BEGIN
  ALTER TABLE direct_call_sessions
    ADD CONSTRAINT direct_call_sessions_status_check
    CHECK (status IN ('ringing','accepted','declined','cancelled','missed','ended'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS direct_call_sessions_receiver_status_idx
  ON direct_call_sessions(receiver_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS direct_call_sessions_caller_status_idx
  ON direct_call_sessions(caller_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS direct_call_sessions_expires_idx
  ON direct_call_sessions(expires_at);

COMMIT;
