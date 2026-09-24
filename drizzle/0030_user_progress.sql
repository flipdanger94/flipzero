BEGIN;

CREATE TABLE IF NOT EXISTS user_progress (
  user_id text PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  total_xp bigint NOT NULL DEFAULT 0 CHECK (total_xp >= 0),
  level integer NOT NULL DEFAULT 1 CHECK (level BETWEEN 1 AND 100),
  xp_updated_at timestamptz NOT NULL DEFAULT now(),
  last_level_up_at timestamptz
);

CREATE INDEX IF NOT EXISTS user_progress_leaderboard_idx
  ON user_progress(total_xp DESC, xp_updated_at ASC, user_id ASC);

ALTER TABLE xp_events ADD COLUMN IF NOT EXISTS dedupe_key text;
ALTER TABLE xp_events ADD COLUMN IF NOT EXISTS meta jsonb NOT NULL DEFAULT '{}'::jsonb;

UPDATE xp_events
SET dedupe_key = idempotency_key
WHERE dedupe_key IS NULL OR dedupe_key = '';

ALTER TABLE xp_events ALTER COLUMN dedupe_key SET NOT NULL;

CREATE TABLE IF NOT EXISTS xp_events_duplicates_archive (
  archived_id bigserial PRIMARY KEY,
  original_id text NOT NULL,
  user_id text NOT NULL,
  space_id text,
  source text NOT NULL,
  amount integer NOT NULL,
  idempotency_key text NOT NULL,
  dedupe_key text NOT NULL,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL,
  archived_at timestamptz NOT NULL DEFAULT now(),
  archive_reason text NOT NULL DEFAULT 'duplicate_user_source_dedupe'
);

WITH ranked AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY user_id, source, dedupe_key
           ORDER BY created_at ASC, id ASC
         ) AS rn
  FROM xp_events
),
dupes AS (
  SELECT e.*
  FROM xp_events e
  JOIN ranked r ON r.id = e.id
  WHERE r.rn > 1
)
INSERT INTO xp_events_duplicates_archive (
  original_id, user_id, space_id, source, amount,
  idempotency_key, dedupe_key, meta, created_at
)
SELECT id, user_id, space_id, source, amount,
       idempotency_key, dedupe_key, meta, created_at
FROM dupes
WHERE NOT EXISTS (
  SELECT 1
  FROM xp_events_duplicates_archive a
  WHERE a.original_id = dupes.id
);

DELETE FROM xp_events
WHERE id IN (
  SELECT id
  FROM (
    SELECT id,
           row_number() OVER (
             PARTITION BY user_id, source, dedupe_key
             ORDER BY created_at ASC, id ASC
           ) AS rn
    FROM xp_events
  ) ranked
  WHERE rn > 1
);

-- Before 0030, voice_minute rows stored minutes in amount instead of awarded XP.
-- Normalize the historical ledger once; the new award path writes one 3-XP row per minute bucket.
UPDATE xp_events
SET amount = amount * 3,
    meta = meta || jsonb_build_object('legacyVoiceMinutesNormalized', true)
WHERE source = 'voice_minute'
  AND COALESCE((meta->>'legacyVoiceMinutesNormalized')::boolean, false) = false;

CREATE UNIQUE INDEX IF NOT EXISTS xp_events_user_source_dedupe_unique
  ON xp_events(user_id, source, dedupe_key);

INSERT INTO user_progress (user_id, total_xp, level, xp_updated_at)
SELECT
  u.id,
  GREATEST(u.global_xp, COALESCE(e.event_xp, 0))::bigint,
  1,
  COALESCE(e.last_event_at, u.updated_at, now())
FROM users u
LEFT JOIN (
  SELECT user_id, COALESCE(sum(amount), 0)::bigint AS event_xp, max(created_at) AS last_event_at
  FROM xp_events
  GROUP BY user_id
) e ON e.user_id = u.id
ON CONFLICT (user_id) DO NOTHING;

-- If the legacy account total contains XP not represented by the ledger, record
-- the difference explicitly instead of silently replacing or losing it.
INSERT INTO xp_events (
  id, user_id, space_id, source, amount,
  idempotency_key, dedupe_key, meta, created_at
)
SELECT
  md5('legacy-adjustment:' || u.id),
  u.id,
  NULL,
  'legacy_adjustment',
  (u.global_xp - COALESCE(e.event_xp, 0))::integer,
  u.id || ':legacy_adjustment:0030',
  '0030',
  jsonb_build_object('reason', 'pre-user_progress balance'),
  now()
FROM users u
LEFT JOIN (
  SELECT user_id, COALESCE(sum(amount), 0)::bigint AS event_xp
  FROM xp_events
  GROUP BY user_id
) e ON e.user_id = u.id
WHERE u.global_xp > COALESCE(e.event_xp, 0)
ON CONFLICT DO NOTHING;

UPDATE user_progress p
SET total_xp = GREATEST(
      p.total_xp,
      COALESCE((SELECT sum(e.amount)::bigint FROM xp_events e WHERE e.user_id = p.user_id), 0)
    ),
    xp_updated_at = now();

UPDATE user_progress p
SET level = (
  SELECT max(candidate)
  FROM generate_series(1, 100) AS candidate
  WHERE p.total_xp >= floor(100 * power(candidate - 1, 1.5))
);

UPDATE users u
SET global_xp = p.total_xp,
    global_level = p.level,
    updated_at = GREATEST(u.updated_at, p.xp_updated_at)
FROM user_progress p
WHERE p.user_id = u.id
  AND (u.global_xp IS DISTINCT FROM p.total_xp OR u.global_level IS DISTINCT FROM p.level);

COMMIT;
