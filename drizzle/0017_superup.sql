CREATE TABLE IF NOT EXISTS space_superup_supports (
  user_id text PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  space_id text NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS space_superup_supports_space_idx ON space_superup_supports(space_id);
