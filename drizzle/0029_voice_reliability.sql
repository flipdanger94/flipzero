BEGIN;

ALTER TABLE voice_states
  ADD COLUMN IF NOT EXISTS breakout text NOT NULL DEFAULT 'main';

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'voice_states_breakout_check'
  ) THEN
    ALTER TABLE voice_states
      ADD CONSTRAINT voice_states_breakout_check
      CHECK (breakout IN ('main', 'focus', 'social'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS voice_states_updated_idx
  ON voice_states(updated_at);

CREATE TABLE IF NOT EXISTS livekit_webhook_events (
  id text PRIMARY KEY,
  event text NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now()
);

COMMIT;
