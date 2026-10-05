-- The original managed member role predates ReadHistory (mask 3139).
-- Repair only that exact legacy default; leave custom roles and channel denies intact.
UPDATE roles
SET permissions = permissions | 131072
WHERE is_managed = true AND position = 0 AND permissions = 3139;
