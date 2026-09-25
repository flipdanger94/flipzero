ALTER TABLE cosmetic_items ADD COLUMN IF NOT EXISTS slug text;
UPDATE cosmetic_items SET slug=id WHERE slug IS NULL OR btrim(slug)='';
ALTER TABLE cosmetic_items ALTER COLUMN slug SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS cosmetic_items_slug_unique ON cosmetic_items(slug);

ALTER TABLE cosmetic_items ADD COLUMN IF NOT EXISTS type text;
UPDATE cosmetic_items SET type=category WHERE type IS NULL OR btrim(type)='';
ALTER TABLE cosmetic_items ALTER COLUMN type SET NOT NULL;

ALTER TABLE cosmetic_items ADD COLUMN IF NOT EXISTS slot text;
UPDATE cosmetic_items
SET slot=CASE category
  WHEN 'avatar_frame' THEN 'avatar_decoration'
  WHEN 'banner' THEN 'profile_banner'
  WHEN 'nickname' THEN 'nameplate'
  WHEN 'message_effect' THEN 'chat_style'
  WHEN 'badge' THEN 'badge'
  WHEN 'theme' THEN 'app_theme'
  ELSE category
END
WHERE slot IS NULL OR btrim(slot)='';
ALTER TABLE cosmetic_items ALTER COLUMN slot SET NOT NULL;

ALTER TABLE cosmetic_items ADD COLUMN IF NOT EXISTS price_money_cents integer;
ALTER TABLE cosmetic_items ADD COLUMN IF NOT EXISTS preview_image text;
UPDATE cosmetic_items SET preview_image=preview WHERE preview_image IS NULL;
ALTER TABLE cosmetic_items ADD COLUMN IF NOT EXISTS preview_animation text;
ALTER TABLE cosmetic_items ADD COLUMN IF NOT EXISTS is_bundle boolean NOT NULL DEFAULT false;
ALTER TABLE cosmetic_items ADD COLUMN IF NOT EXISTS is_animated boolean NOT NULL DEFAULT false;
ALTER TABLE cosmetic_items ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;
ALTER TABLE cosmetic_items ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE cosmetic_items ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE cosmetic_inventory ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'purchase';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='cosmetic_equipped' AND column_name='category'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='cosmetic_equipped' AND column_name='slot'
  ) THEN
    ALTER TABLE cosmetic_equipped RENAME COLUMN category TO slot;
  END IF;
END $$;

UPDATE cosmetic_equipped
SET slot=CASE slot
  WHEN 'avatar_frame' THEN 'avatar_decoration'
  WHEN 'banner' THEN 'profile_banner'
  WHEN 'nickname' THEN 'nameplate'
  WHEN 'message_effect' THEN 'chat_style'
  WHEN 'badge' THEN 'badge'
  WHEN 'theme' THEN 'app_theme'
  ELSE slot
END;

CREATE TABLE IF NOT EXISTS cosmetic_bundle_entries (
  bundle_id text NOT NULL REFERENCES cosmetic_items(id) ON DELETE RESTRICT,
  item_id text NOT NULL REFERENCES cosmetic_items(id) ON DELETE RESTRICT,
  PRIMARY KEY(bundle_id,item_id),
  CHECK (bundle_id <> item_id)
);

CREATE INDEX IF NOT EXISTS cosmetic_items_active_category_idx ON cosmetic_items(is_active,category,rarity);
CREATE INDEX IF NOT EXISTS cosmetic_inventory_user_acquired_idx ON cosmetic_inventory(user_id,acquired_at DESC);
