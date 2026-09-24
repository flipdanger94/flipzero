ALTER TABLE voice_states
ADD COLUMN IF NOT EXISTS speaking boolean NOT NULL DEFAULT false;
