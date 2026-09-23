import { and, eq, gt, isNull, or, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDatabase } from "@/db/client";
import { members, spaces, spaceSuperupSupports, superflipPurchases, users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";

const thresholds = [2, 7, 14];
const levelFor = (count: number) => thresholds.filter((threshold) => count >= threshold).length;
const activeGrant = (now: Date) => and(isNull(superflipPurchases.revokedAt), or(isNull(superflipPurchases.expiresAt), gt(superflipPurchases.expiresAt, now)));

async function access(spaceId: string) {
  const user = await getCurrentUser();
  if (!user) return { error: NextResponse.json({ message: "Требуется вход." }, { status: 401 }) };
  const db = getDatabase();
  const [space] = await db.select({ ownerId: spaces.ownerId }).from(spaces).where(eq(spaces.id, spaceId)).limit(1);
  if (!space) return { error: NextResponse.json({ message: "Пространство не найдено." }, { status: 404 }) };
  const [member] = await db.select({ userId: members.userId }).from(members).where(and(eq(members.userId, user.id), eq(members.spaceId, spaceId))).limit(1);
  if (!member && space.ownerId !== user.id) return { error: NextResponse.json({ message: "Нужно вступить в пространство." }, { status: 403 }) };
  return { user, db };
}

export async function GET(_request: Request, { params }: { params: Promise<{ spaceId: string }> }) {
  const { spaceId } = await params;
  const result = await access(spaceId);
  if ("error" in result) return result.error;
  const { db, user } = result;
  const now = new Date();
  const graceStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const [allocation] = await db.select().from(spaceSuperupSupports).where(eq(spaceSuperupSupports.userId, user.id)).limit(1);
  const [entitlement] = await db.select({ id: superflipPurchases.id }).from(superflipPurchases).where(and(eq(superflipPurchases.userId, user.id), activeGrant(now))).limit(1);
  const supports = await db.select({ userId: spaceSuperupSupports.userId, displayName: users.displayName, expiresAt: sql<Date | null>`max(${superflipPurchases.expiresAt}) filter (where ${superflipPurchases.revokedAt} is null)`, active: sql<boolean>`coalesce(bool_or(${superflipPurchases.revokedAt} is null and (${superflipPurchases.expiresAt} is null or ${superflipPurchases.expiresAt} > ${now})), false)` })
    .from(spaceSuperupSupports).innerJoin(users, eq(users.id, spaceSuperupSupports.userId))
    .leftJoin(superflipPurchases, eq(superflipPurchases.userId, spaceSuperupSupports.userId))
    .where(eq(spaceSuperupSupports.spaceId, spaceId))
    .groupBy(spaceSuperupSupports.userId, users.displayName);
  const active = supports.filter((item) => item.active);
  const grace = supports.filter((item) => !item.active && item.expiresAt && item.expiresAt > graceStart && item.expiresAt <= now);
  const level = levelFor(active.length);
  const retainedLevel = levelFor(active.length + grace.length);
  return NextResponse.json({ count: active.length, level, retainedLevel, graceUntil: retainedLevel > level && grace.length ? new Date(Math.max(...grace.map((item) => item.expiresAt!.getTime())) + 7 * 86400000).toISOString() : null, supporters: active.map(({ userId, displayName }) => ({ userId, displayName })), mySpaceId: allocation?.spaceId ?? null, canSupport: Boolean(entitlement), thresholds });
}

export async function POST(request: Request, { params }: { params: Promise<{ spaceId: string }> }) {
  const { spaceId } = await params;
  const result = await access(spaceId);
  if ("error" in result) return result.error;
  const { db, user } = result;
  const [entitlement] = await db.select({ id: superflipPurchases.id }).from(superflipPurchases).where(and(eq(superflipPurchases.userId, user.id), activeGrant(new Date()))).limit(1);
  if (!entitlement) return NextResponse.json({ message: "Для поддержки нужен действующий SuperFlip." }, { status: 403 });
  const [existing] = await db.select().from(spaceSuperupSupports).where(eq(spaceSuperupSupports.userId, user.id)).limit(1);
  if (existing?.spaceId === spaceId) return NextResponse.json({ ok: true });
  if (existing) return NextResponse.json({ message: "Сначала отмените поддержку другого пространства." }, { status: 409 });
  await db.insert(spaceSuperupSupports).values({ userId: user.id, spaceId }).onConflictDoNothing();
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ spaceId: string }> }) {
  const { spaceId } = await params;
  const result = await access(spaceId);
  if ("error" in result) return result.error;
  await result.db.delete(spaceSuperupSupports).where(and(eq(spaceSuperupSupports.spaceId, spaceId), eq(spaceSuperupSupports.userId, result.user.id)));
  return NextResponse.json({ ok: true });
}
