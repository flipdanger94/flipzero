BEGIN;

ALTER TABLE voice_states
  ADD COLUMN IF NOT EXISTS breakout text NOT NULL DEFAULT 'main',
  ADD COLUMN IF NOT EXISTS last_heartbeat_at timestamptz NOT NULL DEFAULT now();

DO $$ BEGIN
  ALTER TABLE voice_states
    ADD CONSTRAINT voice_states_breakout_check
    CHECK (breakout IN ('main', 'focus', 'social'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS voice_states_channel_breakout_idx
  ON voice_states(channel_id, breakout);

CREATE INDEX IF NOT EXISTS voice_states_heartbeat_idx
  ON voice_states(last_heartbeat_at);

CREATE TABLE IF NOT EXISTS livekit_webhook_events (
  id text PRIMARY KEY,
  event_type text NOT NULL,
  room_name text,
  received_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS livekit_webhook_events_received_idx
  ON livekit_webhook_events(received_at);

COMMIT;
