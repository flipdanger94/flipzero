CREATE TABLE IF NOT EXISTS space_sounds (
  id text PRIMARY KEY,
  space_id text NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  asset_id text NOT NULL REFERENCES media_assets(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS space_sounds_space_idx ON space_sounds(space_id);
