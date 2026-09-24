BEGIN;

CREATE TABLE IF NOT EXISTS direct_call_sessions (
  id text PRIMARY KEY,
  caller_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  receiver_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  room text NOT NULL,
  video boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'ringing'
    CHECK (status IN ('ringing','accepted','declined','cancelled','ended')),
  expires_at timestamptz NOT NULL,
  answered_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS direct_call_receiver_status_idx
  ON direct_call_sessions(receiver_id,status,expires_at);
CREATE INDEX IF NOT EXISTS direct_call_caller_status_idx
  ON direct_call_sessions(caller_id,status,expires_at);

COMMIT;
