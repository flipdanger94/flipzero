import { and, eq } from "drizzle-orm";
import { getDatabase } from "@/db/client";
import { clanMembers, clans } from "@/db/schema";

export const CLAN_MEMBER_LIMIT = 50;
export const CLAN_NAME_MIN = 3;
export const CLAN_NAME_MAX = 32;
export const CLAN_TAG_MIN = 2;
export const CLAN_TAG_MAX = 5;

export type ClanRole = "leader" | "officer" | "member";
export type ClanJoinType = "open" | "application" | "closed";
export type ClanAttachment = { type:"image"|"audio"|"file"; url:string; name:string; mimeType:string; size:number; duration?:number };

export function normalizeClanName(value: unknown) {
  if (typeof value !== "string") return null;
  const name = value.trim().replace(/\s+/g, " ");
  return name.length >= CLAN_NAME_MIN && name.length <= CLAN_NAME_MAX ? name : null;
}
export function normalizeClanTag(value: unknown) {
  if (typeof value !== "string") return null;
  const tag = value.trim().toUpperCase();
  return /^[A-Z0-9А-ЯЁ]{2,5}$/u.test(tag) ? tag : null;
}
export function normalizeClanDescription(value: unknown) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, 500);
}
export function normalizeClanJoinType(value: unknown): ClanJoinType | null {
  return value === "open" || value === "application" || value === "closed" ? value : null;
}
export function canModerateClan(role: ClanRole) { return role === "leader" || role === "officer"; }
export function canManageClan(role: ClanRole) { return role === "leader"; }

export function normalizeClanAttachments(value: unknown): ClanAttachment[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    const type = String(row.type ?? "");
    const url = String(row.url ?? "");
    const name = String(row.name ?? "").trim();
    const mimeType = String(row.mimeType ?? "");
    const size = Number(row.size ?? 0);
    const duration = row.duration === undefined ? undefined : Number(row.duration);
    if (!["image","audio","file"].includes(type)) return [];
    if (!/^\/api\/v1\/media\/[0-9a-f-]{36}$/i.test(url)) return [];
    if (!name || name.length > 180 || !mimeType || mimeType.length > 120) return [];
    if (!Number.isSafeInteger(size) || size <= 0 || size > 25 * 1024 * 1024) return [];
    if (duration !== undefined && (!Number.isFinite(duration) || duration <= 0 || duration > 300)) return [];
    return [{ type:type as ClanAttachment["type"], url, name, mimeType, size, ...(duration ? { duration } : {}) }];
  }).slice(0,4);
}

export async function getClanMembership(userId:string) {
  const [row] = await getDatabase().select({
    clanId: clanMembers.clanId,
    role: clanMembers.role,
    joinedAt: clanMembers.joinedAt,
    clanName: clans.name,
    clanTag: clans.tag,
  }).from(clanMembers).innerJoin(clans, eq(clans.id, clanMembers.clanId)).where(eq(clanMembers.userId, userId)).limit(1);
  return row ?? null;
}

export async function getClanRole(userId:string, clanId:string) {
  const [row] = await getDatabase().select({role:clanMembers.role}).from(clanMembers).where(and(eq(clanMembers.userId,userId),eq(clanMembers.clanId,clanId))).limit(1);
  return (row?.role as ClanRole | undefined) ?? null;
}
