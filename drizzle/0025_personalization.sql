CREATE TABLE IF NOT EXISTS user_preferences (
 user_id text PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
 theme text NOT NULL DEFAULT 'midnight',
 accent_color text NOT NULL DEFAULT '#8f70ff',
 dnd_enabled boolean NOT NULL DEFAULT false,
 dnd_days jsonb NOT NULL DEFAULT '[]'::jsonb,
 dnd_start text NOT NULL DEFAULT '22:00',
 dnd_end text NOT NULL DEFAULT '08:00',
 dnd_timezone text NOT NULL DEFAULT 'UTC',
 dnd_favorite_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
 dnd_clan_exception boolean NOT NULL DEFAULT false,
 updated_at timestamptz NOT NULL DEFAULT now()
);
