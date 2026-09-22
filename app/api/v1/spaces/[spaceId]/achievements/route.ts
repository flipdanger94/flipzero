import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDatabase } from "@/db/client";
import { achievementDefinitions, spaces } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { getSpacePermissions } from "@/lib/space-permissions";
import { hasPermission, Permission } from "@/lib/permissions";

async function requireAchievementManager(spaceId: string) {
  const user = await getCurrentUser();
  if (!user) return { error: NextResponse.json({ code: "UNAUTHENTICATED", message: "Требуется вход." }, { status: 401 }) };
  const database = getDatabase();
  const [space] = await database.select({ ownerId: spaces.ownerId }).from(spaces).where(eq(spaces.id, spaceId)).limit(1);
  if (!space) return { error: NextResponse.json({ code: "NOT_FOUND", message: "Пространство не найдено." }, { status: 404 }) };
  if (space.ownerId !== user.id) {
    const state = await getSpacePermissions(spaceId, user.id);
    if (!state.spaceId || !hasPermission(state.permissions, Permission.ManageSpace)) return { error: NextResponse.json({ code: "FORBIDDEN", message: "Недостаточно прав для управления достижениями." }, { status: 403 }) };
  }
  return { database, user };
}

export async function POST(request: Request, { params }: { params: Promise<{ spaceId: string }> }) {
  const { spaceId } = await params;
  const access = await requireAchievementManager(spaceId);
  if ("error" in access) return access.error;
  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim().slice(0, 50) : "";
  const description = typeof body?.description === "string" ? body.description.trim().slice(0, 160) : "";
  const target = Number(body?.target);
  const eventSource = ["message", "reaction_received", "voice_minute", "event_hosted", "invite_joined", "forum_post", "creative_post", "level"].includes(body?.eventSource) ? body.eventSource : "message";
  const rarity = ["common", "rare", "epic", "legendary"].includes(body?.rarity) ? body.rarity : "common";
  if (!name || !description || !Number.isInteger(target) || target < 1 || target > 100000) return NextResponse.json({ code: "INVALID_INPUT", message: "Проверьте название, описание и цель." }, { status: 400 });
  const id = randomUUID();
  const [achievement] = await access.database.insert(achievementDefinitions).values({ id, spaceId, key: `custom-${id}`, name, description, icon: typeof body.icon === "string" ? body.icon.slice(0, 8) : "✦", rarity, eventSource, target, xpReward: Math.min(5000, Math.max(0, Number(body.xpReward) || 0)), isSecret: Boolean(body.isSecret), createdBy: access.user.id }).returning();
  return NextResponse.json({ achievement }, { status: 201 });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ spaceId: string }> }) {
  const { spaceId } = await params;
  const access = await requireAchievementManager(spaceId);
  if ("error" in access) return access.error;
  const achievementId = new URL(request.url).searchParams.get("achievementId");
  if (!achievementId) return NextResponse.json({ code: "INVALID_INPUT", message: "Не указано достижение." }, { status: 400 });
  await access.database.delete(achievementDefinitions).where(and(eq(achievementDefinitions.id, achievementId), eq(achievementDefinitions.spaceId, spaceId)));
  return NextResponse.json({ ok: true });
}
