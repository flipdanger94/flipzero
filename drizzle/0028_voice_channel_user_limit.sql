ALTER TABLE channels
ADD COLUMN IF NOT EXISTS user_limit integer;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'channels_user_limit_check'
  ) THEN
    ALTER TABLE channels
    ADD CONSTRAINT channels_user_limit_check
    CHECK (user_limit IS NULL OR (user_limit >= 1 AND user_limit <= 99));
  END IF;
END $$;
