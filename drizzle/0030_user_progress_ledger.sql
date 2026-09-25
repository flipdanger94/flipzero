BEGIN;

CREATE TABLE IF NOT EXISTS user_progress (
  user_id text PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  total_xp bigint NOT NULL DEFAULT 0 CHECK (total_xp >= 0),
  level integer NOT NULL DEFAULT 1 CHECK (level BETWEEN 1 AND 100),
  xp_updated_at timestamptz NOT NULL DEFAULT now(),
  last_level_up_at timestamptz
);

CREATE INDEX IF NOT EXISTS user_progress_leaderboard_idx
  ON user_progress(total_xp DESC, xp_updated_at ASC);

ALTER TABLE xp_events
  ADD COLUMN IF NOT EXISTS dedupe_key text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS meta jsonb NOT NULL DEFAULT '{}'::jsonb;

UPDATE xp_events
SET dedupe_key = idempotency_key
WHERE dedupe_key = '';

CREATE OR REPLACE FUNCTION sync_xp_event_dedupe_key()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.dedupe_key IS NULL OR NEW.dedupe_key = '' THEN
    NEW.dedupe_key := NEW.idempotency_key;
  END IF;
  IF NEW.idempotency_key IS NULL OR NEW.idempotency_key = '' THEN
    NEW.idempotency_key := NEW.dedupe_key;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS xp_events_sync_dedupe_key ON xp_events;
CREATE TRIGGER xp_events_sync_dedupe_key
BEFORE INSERT OR UPDATE OF idempotency_key, dedupe_key ON xp_events
FOR EACH ROW
EXECUTE FUNCTION sync_xp_event_dedupe_key();

CREATE TABLE IF NOT EXISTS xp_events_duplicates_archive (
  archived_at timestamptz NOT NULL DEFAULT now(),
  id text PRIMARY KEY,
  user_id text NOT NULL,
  space_id text,
  source text NOT NULL,
  amount integer NOT NULL,
  idempotency_key text NOT NULL,
  dedupe_key text NOT NULL,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL
);

WITH ranked AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY user_id, source, dedupe_key
           ORDER BY created_at ASC, id ASC
         ) AS rn
  FROM xp_events
),
duplicates AS (
  SELECT e.*
  FROM xp_events e
  JOIN ranked r ON r.id = e.id
  WHERE r.rn > 1
)
INSERT INTO xp_events_duplicates_archive(id,user_id,space_id,source,amount,idempotency_key,dedupe_key,meta,created_at)
SELECT id,user_id,space_id,source,amount,idempotency_key,dedupe_key,meta,created_at
FROM duplicates
ON CONFLICT (id) DO NOTHING;

DELETE FROM xp_events e
USING (
  SELECT id FROM (
    SELECT id,
           row_number() OVER (
             PARTITION BY user_id, source, dedupe_key
             ORDER BY created_at ASC, id ASC
           ) AS rn
    FROM xp_events
  ) ranked
  WHERE rn > 1
) duplicate
WHERE e.id = duplicate.id;

DROP INDEX IF EXISTS xp_events_idempotency_unique;
CREATE UNIQUE INDEX IF NOT EXISTS xp_events_user_source_dedupe_unique
  ON xp_events(user_id, source, dedupe_key);
CREATE INDEX IF NOT EXISTS xp_events_user_source_created_idx
  ON xp_events(user_id, source, created_at);

INSERT INTO user_progress(user_id,total_xp,level,xp_updated_at)
SELECT id,GREATEST(global_xp,0),1,COALESCE(updated_at,now())
FROM users
ON CONFLICT (user_id) DO NOTHING;

WITH event_sums AS (
  SELECT user_id,COALESCE(sum(amount),0)::bigint AS event_xp
  FROM xp_events
  GROUP BY user_id
),
needs_adjustment AS (
  SELECT u.id AS user_id,
         GREATEST(u.global_xp,0)::bigint AS legacy_xp,
         COALESCE(s.event_xp,0)::bigint AS event_xp
  FROM users u
  LEFT JOIN event_sums s ON s.user_id=u.id
  WHERE GREATEST(u.global_xp,0) > COALESCE(s.event_xp,0)
)
INSERT INTO xp_events(id,user_id,space_id,source,amount,idempotency_key,dedupe_key,meta,created_at)
SELECT
  'legacy-adjustment-' || user_id,
  user_id,
  NULL,
  'legacy_adjustment',
  (legacy_xp-event_xp)::integer,
  'legacy:' || user_id || ':backfill',
  'legacy:' || user_id || ':backfill',
  jsonb_build_object('reason','user_progress backfill','legacyXp',legacy_xp,'ledgerXp',event_xp),
  now()
FROM needs_adjustment
WHERE legacy_xp-event_xp > 0
ON CONFLICT (user_id,source,dedupe_key) DO NOTHING;

WITH sums AS (
  SELECT u.id AS user_id,COALESCE(sum(e.amount),0)::bigint AS total_xp
  FROM users u
  LEFT JOIN xp_events e ON e.user_id=u.id
  GROUP BY u.id
)
UPDATE user_progress p
SET total_xp=GREATEST(s.total_xp,0),
    xp_updated_at=now()
FROM sums s
WHERE p.user_id=s.user_id;

UPDATE user_progress p
SET level = (
  SELECT max(candidate)
  FROM generate_series(1,100) AS candidate
  WHERE floor(100 * power(candidate - 1, 1.5)) <= p.total_xp
);

UPDATE users u
SET global_xp=p.total_xp,
    global_level=p.level,
    updated_at=now()
FROM user_progress p
WHERE p.user_id=u.id
  AND (u.global_xp<>p.total_xp OR u.global_level<>p.level);

COMMIT;
