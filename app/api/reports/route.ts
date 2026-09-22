import { randomUUID } from "node:crypto";
import { and, eq, gt, isNull, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDatabase } from "@/db/client";
import { messages, reports, users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { getChannelPermissions, hasPermission, SpacePermission } from "@/lib/space-permissions";

const targetTypes = new Set(["user", "message", "server", "channel", "profile", "media"]);
const reasons = new Set(["spam", "abuse", "harassment", "fraud", "unwanted_content", "impersonation", "other"]);

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ message: "Требуется вход." }, { status: 401 });

  const body = await request.json().catch(() => null);
  const targetType = String(body?.targetType ?? "");
  const targetId = String(body?.targetId ?? "").trim().slice(0, 200);
  const reason = String(body?.reason ?? "").trim().toLowerCase();
  const description = String(body?.description ?? "").trim().slice(0, 2000);

  if (!targetTypes.has(targetType) || !targetId || !reasons.has(reason)) {
    return NextResponse.json({ message: "Некорректная жалоба." }, { status: 400 });
  }

  const database = getDatabase();

  if (targetType === "user" || targetType === "profile") {
    if (targetId === user.id) return NextResponse.json({ message: "Нельзя пожаловаться на себя." }, { status: 400 });
    const [target] = await database.select({ id: users.id }).from(users).where(eq(users.id, targetId)).limit(1);
    if (!target) return NextResponse.json({ message: "Пользователь не найден." }, { status: 404 });
  }

  if (targetType === "message") {
    const [target] = await database
      .select({ id: messages.id, authorId: messages.authorId, channelId: messages.channelId })
      .from(messages)
      .where(and(eq(messages.id, targetId), isNull(messages.deletedAt)))
      .limit(1);

    if (!target) return NextResponse.json({ message: "Сообщение не найдено." }, { status: 404 });
    if (target.authorId === user.id) return NextResponse.json({ message: "Нельзя пожаловаться на своё сообщение." }, { status: 400 });

    const permissionState = await getChannelPermissions(target.channelId, user.id);
    if (!permissionState.spaceId || (!permissionState.owner && !hasPermission(permissionState.permissions, SpacePermission.ViewChannels))) {
      return NextResponse.json({ message: "Сообщение недоступно." }, { status: 403 });
    }
  }

  const [existing] = await database
    .select({ id: reports.id, status: reports.status })
    .from(reports)
    .where(and(
      eq(reports.reporterId, user.id),
      eq(reports.targetType, targetType),
      eq(reports.targetId, targetId),
      eq(reports.status, "open"),
    ))
    .limit(1);

  if (existing) return NextResponse.json({ id: existing.id, status: existing.status, duplicate: true });

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const [{ count: recentCount }] = await database
    .select({ count: sql<number>`count(*)::int` })
    .from(reports)
    .where(and(eq(reports.reporterId, user.id), gt(reports.createdAt, oneHourAgo)));

  if (recentCount >= 20) {
    return NextResponse.json({ message: "Слишком много жалоб за короткое время. Попробуйте позже." }, { status: 429 });
  }

  const id = randomUUID();
  await database.insert(reports).values({
    id,
    reporterId: user.id,
    targetType,
    targetId,
    reason,
    description: description || null,
  });

  return NextResponse.json({ id, status: "open" }, { status: 201 });
}
