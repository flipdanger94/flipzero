export type SuperFlipGrant = { expiresAt: Date | null; revokedAt: Date | null };

export function isSuperFlipActive(grants: SuperFlipGrant[], now = new Date()) {
  return grants.some((grant) => !grant.revokedAt && (!grant.expiresAt || grant.expiresAt > now));
}

export function subscriptionExpiry(months = 1, from = new Date()) {
  const expiry = new Date(from);
  expiry.setUTCMonth(expiry.getUTCMonth() + Math.max(1, Math.min(months, 120)));
  return expiry;
}
