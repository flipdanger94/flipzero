export type SuperFlipGrant = { expiresAt: Date | null; revokedAt: Date | null };
export type SuperFlipGiftPeriod = "month" | "year" | "forever";

export function parseSuperFlipGiftPeriod(value: unknown): SuperFlipGiftPeriod | null {
  return value === "month" || value === "year" || value === "forever" ? value : null;
}

export function normalizeSuperFlipGiftReason(value: unknown) {
  if (typeof value !== "string") return null;
  const reason = value.trim();
  return reason ? reason.slice(0, 500) : null;
}

export function superFlipGiftPeriodLabel(period: SuperFlipGiftPeriod) {
  if (period === "month") return "1 месяц";
  if (period === "year") return "1 год";
  return "навсегда";
}

export function superFlipGiftNotificationBody(period: SuperFlipGiftPeriod, reason: string) {
  return `Срок: ${superFlipGiftPeriodLabel(period)}. Причина: ${reason}`;
}

export const SUPERFLIP_CAPABILITIES = {
  profileBioLimit: 500,
  directMessageLimit: 1000,
  avatarUploadMb: 8,
  bannerUploadMb: 16,
  animatedProfileMedia: true,
} as const;

export const STANDARD_CAPABILITIES = {
  profileBioLimit: 190,
  directMessageLimit: 4000,
  avatarUploadMb: 2,
  bannerUploadMb: 4,
  animatedProfileMedia: false,
} as const;

export function isSuperFlipActive(grants: SuperFlipGrant[], now = new Date()) {
  return grants.some((grant) => !grant.revokedAt && (!grant.expiresAt || grant.expiresAt > now));
}

export function subscriptionExpiry(months = 1, from = new Date()) {
  const expiry = new Date(from);
  expiry.setUTCMonth(expiry.getUTCMonth() + Math.max(1, Math.min(months, 120)));
  return expiry;
}

export async function hasActiveSuperFlip(userId: string) {
  const [{ and, eq, gt, isNull, or }, { getDatabase }, { superflipPurchases }] = await Promise.all([
    import("drizzle-orm"),
    import("@/db/client"),
    import("@/db/schema"),
  ]);
  const [grant] = await getDatabase().select({ id: superflipPurchases.id }).from(superflipPurchases).where(and(eq(superflipPurchases.userId, userId), isNull(superflipPurchases.revokedAt), or(isNull(superflipPurchases.expiresAt), gt(superflipPurchases.expiresAt, new Date())))).limit(1);
  return Boolean(grant);
}

export async function getSuperFlipCapabilities(userId: string) {
  const active = await hasActiveSuperFlip(userId);
  return { active, capabilities: active ? SUPERFLIP_CAPABILITIES : STANDARD_CAPABILITIES };
}
