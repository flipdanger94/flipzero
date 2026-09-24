BEGIN;
LOCK TABLE xp_events, clan_members, clans IN SHARE ROW EXCLUSIVE MODE;
CREATE TABLE IF NOT EXISTS clan_xp_backfill (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  applied_at timestamptz NOT NULL DEFAULT now()
);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM clan_xp_backfill WHERE id = true) THEN
    UPDATE clan_members m SET contribution_xp = COALESCE((
      SELECT SUM(e.amount) FROM xp_events e
      WHERE e.user_id = m.user_id AND e.created_at >= m.joined_at
    ), 0);
    UPDATE clans c SET xp = COALESCE((
      SELECT SUM(m.contribution_xp) FROM clan_members m WHERE m.clan_id = c.id
    ), 0);
    INSERT INTO clan_xp_backfill (id) VALUES (true);
  END IF;
END $$;
COMMIT;
