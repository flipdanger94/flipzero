ALTER TABLE media_assets ADD COLUMN IF NOT EXISTS attached_at timestamptz;
CREATE INDEX IF NOT EXISTS media_assets_owner_idx ON media_assets(owner_id);
CREATE INDEX IF NOT EXISTS media_assets_pending_idx ON media_assets(purpose, attached_at, created_at);

CREATE TABLE IF NOT EXISTS media_attachment_links (
  asset_id text NOT NULL REFERENCES media_assets(id) ON DELETE CASCADE,
  context_type text NOT NULL CHECK (context_type IN ('direct', 'channel', 'clan')),
  context_id text NOT NULL,
  message_id text NOT NULL,
  PRIMARY KEY (asset_id, context_type, message_id)
);
CREATE INDEX IF NOT EXISTS media_attachment_links_context_idx ON media_attachment_links(context_type, context_id);

-- Malformed legacy envelopes must not abort migration of all remaining messages.
CREATE OR REPLACE FUNCTION pg_temp.fz_envelope(input text) RETURNS jsonb
LANGUAGE plpgsql AS $$
DECLARE result jsonb;
BEGIN
  IF left(input, 10) <> '__FZDM1__:' THEN RETURN '{}'::jsonb; END IF;
  result := substring(input FROM 11)::jsonb;
  IF jsonb_typeof(result) <> 'object' THEN RETURN '{}'::jsonb; END IF;
  RETURN result;
EXCEPTION WHEN invalid_text_representation THEN RETURN '{}'::jsonb;
END;
$$;

CREATE OR REPLACE FUNCTION pg_temp.fz_array(input jsonb) RETURNS jsonb
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN jsonb_typeof(input) = 'array' THEN input ELSE '[]'::jsonb END;
$$;

CREATE TEMP TABLE fz_legacy_attachments ON COMMIT DROP AS
SELECT 'channel'::text AS context_type, m.channel_id AS context_id, m.id AS message_id, m.author_id AS owner_id, item->>'url' AS url
FROM messages m CROSS JOIN LATERAL jsonb_array_elements(pg_temp.fz_array(m.attachments)) item
UNION ALL
SELECT 'clan', m.clan_id, m.id, m.author_id, item->>'url'
FROM clan_messages m CROSS JOIN LATERAL jsonb_array_elements(pg_temp.fz_array(m.attachments)) item
UNION ALL
SELECT 'direct', m.conversation_id, m.id, m.sender_id, item->>'url'
FROM direct_messages m CROSS JOIN LATERAL jsonb_array_elements(pg_temp.fz_array(pg_temp.fz_envelope(m.text)->'attachments')) item;

INSERT INTO media_attachment_links(asset_id, context_type, context_id, message_id)
SELECT a.id, r.context_type, r.context_id, r.message_id
FROM fz_legacy_attachments r JOIN media_assets a ON r.url = '/api/v1/media/' || a.id OR r.url = '/api/v1/attachments/' || a.id
WHERE a.purpose IS NULL OR a.purpose = 'attachment'
ON CONFLICT DO NOTHING;

UPDATE media_assets a SET purpose = 'attachment', owner_id = r.owner_id, attached_at = a.created_at
FROM (SELECT DISTINCT ON (url) url, owner_id FROM fz_legacy_attachments ORDER BY url, message_id) r
WHERE (r.url = '/api/v1/media/' || a.id OR r.url = '/api/v1/attachments/' || a.id)
  AND (a.purpose IS NULL OR a.purpose = 'attachment');

UPDATE media_assets a SET purpose = 'sound'
WHERE a.purpose IS NULL AND EXISTS (SELECT 1 FROM space_sounds s WHERE s.asset_id = a.id);
UPDATE media_assets a SET purpose = 'public'
WHERE a.purpose IS NULL AND (
  EXISTS (SELECT 1 FROM users u WHERE u.avatar_url = '/api/v1/media/' || a.id OR u.banner_url = '/api/v1/media/' || a.id)
  OR EXISTS (SELECT 1 FROM spaces s WHERE s.icon_url = '/api/v1/media/' || a.id OR s.banner_url = '/api/v1/media/' || a.id)
  OR EXISTS (SELECT 1 FROM clans c WHERE c.avatar_url = '/api/v1/media/' || a.id OR c.banner_url = '/api/v1/media/' || a.id)
);
-- Unknown legacy uploads remain private and are not guessed to be public.

CREATE OR REPLACE FUNCTION pg_temp.fz_private_urls(input jsonb) RETURNS jsonb
LANGUAGE sql AS $$
  SELECT coalesce(jsonb_agg(CASE WHEN item->>'url' ~ '^/api/v1/media/[0-9a-f-]{36}$'
    THEN jsonb_set(item, '{url}', to_jsonb(replace(item->>'url', '/api/v1/media/', '/api/v1/attachments/')))
    ELSE item END), '[]'::jsonb)
  FROM jsonb_array_elements(pg_temp.fz_array(input)) item;
$$;
UPDATE messages SET attachments = pg_temp.fz_private_urls(attachments)
WHERE jsonb_array_length(pg_temp.fz_array(attachments)) > 0;
UPDATE clan_messages SET attachments = pg_temp.fz_private_urls(attachments)
WHERE jsonb_array_length(pg_temp.fz_array(attachments)) > 0;
UPDATE direct_messages SET text = '__FZDM1__:' || jsonb_set(pg_temp.fz_envelope(text), '{attachments}',
  pg_temp.fz_private_urls(pg_temp.fz_envelope(text)->'attachments'))::text
WHERE jsonb_array_length(pg_temp.fz_array(pg_temp.fz_envelope(text)->'attachments')) > 0;
