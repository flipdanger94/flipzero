import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDatabase } from "@/db/client";
import { members, spaceNotificationSettings, spaces } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";

async function access(spaceId: string) {
  const user = await getCurrentUser();
  if (!user) return { error: NextResponse.json({ code: "UNAUTHENTICATED", message: "Требуется вход." }, { status: 401 }) };
  const database = getDatabase();
  const [space] = await database.select({ ownerId: spaces.ownerId }).from(spaces).where(eq(spaces.id, spaceId)).limit(1);
  if (!space) return { error: NextResponse.json({ code: "NOT_FOUND", message: "Сервер не найден." }, { status: 404 }) };
  if (space.ownerId !== user.id) {
    const [membership] = await database.select({ userId: members.userId }).from(members).where(and(eq(members.spaceId, spaceId), eq(members.userId, user.id))).limit(1);
    if (!membership) return { error: NextResponse.json({ code: "FORBIDDEN", message: "Вы не состоите в этом сервере." }, { status: 403 }) };
  }
  return { database, user };
}

export async function GET(_: Request, { params }: { params: Promise<{ spaceId: string }> }) {
  const { spaceId } = await params;
  const result = await access(spaceId);
  if ("error" in result) return result.error;
  const [setting] = await result.database.select({ mode: spaceNotificationSettings.mode }).from(spaceNotificationSettings).where(and(
    eq(spaceNotificationSettings.userId, result.user.id),
    eq(spaceNotificationSettings.spaceId, spaceId),
  )).limit(1);
  return NextResponse.json({ mode: setting?.mode ?? "mentions" });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ spaceId: string }> }) {
  const { spaceId } = await params;
  const result = await access(spaceId);
  if ("error" in result) return result.error;
  const body = await request.json().catch(() => null);
  const mode = body?.mode;
  if (!["all", "mentions", "off"].includes(mode)) return NextResponse.json({ code: "INVALID_MODE", message: "Неизвестный режим уведомлений." }, { status: 400 });

  await result.database.insert(spaceNotificationSettings).values({
    userId: result.user.id,
    spaceId,
    mode,
  }).onConflictDoUpdate({
    target: [spaceNotificationSettings.userId, spaceNotificationSettings.spaceId],
    set: { mode, updatedAt: new Date() },
  });
  return NextResponse.json({ mode });
}
