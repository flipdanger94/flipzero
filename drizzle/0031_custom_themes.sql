BEGIN;

CREATE TABLE IF NOT EXISTS app_themes (
  id text PRIMARY KEY,
  label text NOT NULL,
  access text NOT NULL DEFAULT 'free',
  surface text NOT NULL,
  panel text NOT NULL,
  deep text NOT NULL,
  raised text NOT NULL,
  accent text NOT NULL,
  text_color text NOT NULL DEFAULT '#f7f4fb',
  muted text NOT NULL DEFAULT '#9aa1b6',
  created_by text REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS app_themes_updated_idx ON app_themes(updated_at DESC);

COMMIT;
