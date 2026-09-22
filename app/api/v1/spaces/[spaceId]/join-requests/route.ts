import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, or } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDatabase } from "@/db/client";
import { memberRoles, members, moderationCases, notifications, roles, spaceJoinRequests, spaces, userBlocks, users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { getSpacePermissions } from "@/lib/space-permissions";
import { hasPermission, Permission } from "@/lib/permissions";
import { writeSpaceAuditLog } from "@/lib/space-audit";

async function requireJoinRequestManager(spaceId: string) {
  const user = await getCurrentUser();
  if (!user) return { error: NextResponse.json({ code: "UNAUTHENTICATED", message: "Требуется вход." }, { status: 401 }) };
  const database = getDatabase();
  const [space] = await database.select({ id: spaces.id, ownerId: spaces.ownerId, name: spaces.name }).from(spaces).where(eq(spaces.id, spaceId)).limit(1);
  if (!space) return { error: NextResponse.json({ code: "NOT_FOUND", message: "Сервер не найден." }, { status: 404 }) };
  if (space.ownerId !== user.id) {
    const state = await getSpacePermissions(spaceId, user.id);
    if (!state.spaceId || !hasPermission(state.permissions, Permission.ManageSpace)) return { error: NextResponse.json({ code: "FORBIDDEN", message: "Недостаточно прав для рассмотрения заявок." }, { status: 403 }) };
  }
  return { database, user, space };
}

export async function GET(_: Request, { params }: { params: Promise<{ spaceId: string }> }) {
  const { spaceId } = await params;
  const access = await requireJoinRequestManager(spaceId);
  if ("error" in access) return access.error;

  const requests = await access.database.select({
    id: spaceJoinRequests.id,
    userId: spaceJoinRequests.userId,
    message: spaceJoinRequests.message,
    status: spaceJoinRequests.status,
    createdAt: spaceJoinRequests.createdAt,
    displayName: users.displayName,
    username: users.username,
    avatarUrl: users.avatarUrl,
  }).from(spaceJoinRequests)
    .innerJoin(users, eq(users.id, spaceJoinRequests.userId))
    .where(and(eq(spaceJoinRequests.spaceId, spaceId), eq(spaceJoinRequests.status, "pending")))
    .orderBy(asc(spaceJoinRequests.createdAt));

  return NextResponse.json({ requests });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ spaceId: string }> }) {
  const { spaceId } = await params;
  const access = await requireJoinRequestManager(spaceId);
  if ("error" in access) return access.error;

  const body = await request.json().catch(() => null);
  const requestId = typeof body?.requestId === "string" ? body.requestId : "";
  const status = body?.status === "approved" || body?.status === "rejected" ? body.status : null;
  if (!requestId || !status) return NextResponse.json({ code: "INVALID_INPUT", message: "Некорректное решение по заявке." }, { status: 400 });

  const [joinRequest] = await access.database.select({
    id: spaceJoinRequests.id,
    userId: spaceJoinRequests.userId,
    status: spaceJoinRequests.status,
  }).from(spaceJoinRequests).where(and(eq(spaceJoinRequests.id, requestId), eq(spaceJoinRequests.spaceId, spaceId))).limit(1);
  if (!joinRequest) return NextResponse.json({ code: "NOT_FOUND", message: "Заявка не найдена." }, { status: 404 });
  if (joinRequest.status !== "pending") return NextResponse.json({ code: "ALREADY_REVIEWED", message: "Заявка уже рассмотрена." }, { status: 409 });

  if (status === "approved") {
    const [[ownerBlock], [latestBanAction], [memberRole]] = await Promise.all([
      access.database.select({ blockerId: userBlocks.blockerId }).from(userBlocks).where(or(
        and(eq(userBlocks.blockerId, joinRequest.userId), eq(userBlocks.blockedId, access.space.ownerId)),
        and(eq(userBlocks.blockerId, access.space.ownerId), eq(userBlocks.blockedId, joinRequest.userId)),
      )).limit(1),
      access.database.select({ action: moderationCases.action }).from(moderationCases).where(and(
        eq(moderationCases.spaceId, spaceId),
        eq(moderationCases.targetUserId, joinRequest.userId),
        or(eq(moderationCases.action, "ban"), eq(moderationCases.action, "unban")),
      )).orderBy(desc(moderationCases.createdAt)).limit(1),
      access.database.select({ id: roles.id }).from(roles).where(and(eq(roles.spaceId, spaceId), eq(roles.name, "Участник"), eq(roles.isManaged, true))).limit(1),
    ]);
    if (ownerBlock) return NextResponse.json({ code: "BLOCKED", message: "Нельзя принять заявку из-за настроек блокировки." }, { status: 409 });
    if (latestBanAction?.action === "ban") return NextResponse.json({ code: "BANNED", message: "Пользователь заблокирован на этом сервере." }, { status: 409 });
    if (!memberRole) return NextResponse.json({ code: "ROLE_CONFIGURATION", message: "Системная роль участника не найдена." }, { status: 409 });

    const approved = await access.database.transaction(async (tx) => {
      const [updated] = await tx.update(spaceJoinRequests).set({ status: "approved", reviewedById: access.user.id, reviewedAt: new Date() }).where(and(
        eq(spaceJoinRequests.id, requestId),
        eq(spaceJoinRequests.status, "pending"),
      )).returning({ id: spaceJoinRequests.id });
      if (!updated) return false;
      await tx.insert(members).values({ userId: joinRequest.userId, spaceId }).onConflictDoNothing();
      await tx.insert(memberRoles).values({ userId: joinRequest.userId, spaceId, roleId: memberRole.id }).onConflictDoNothing();
      await tx.insert(notifications).values({
        id: randomUUID(),
        userId: joinRequest.userId,
        actorId: access.user.id,
        type: "space_join_approved",
        title: "Заявка одобрена",
        body: "Вы приняты в " + access.space.name + ".",
        entityType: "space",
        entityId: spaceId,
      });
      return true;
    });
    if (!approved) return NextResponse.json({ code: "ALREADY_REVIEWED", message: "Заявка уже рассмотрена." }, { status: 409 });
    await writeSpaceAuditLog({ spaceId, actorId: access.user.id, action: "join_request.approve", targetType: "user", targetId: joinRequest.userId, metadata: { requestId } });
    return NextResponse.json({ ok: true, status: "approved", userId: joinRequest.userId });
  }

  const [updated] = await access.database.update(spaceJoinRequests).set({ status: "rejected", reviewedById: access.user.id, reviewedAt: new Date() }).where(and(
    eq(spaceJoinRequests.id, requestId),
    eq(spaceJoinRequests.status, "pending"),
  )).returning({ id: spaceJoinRequests.id });
  if (!updated) return NextResponse.json({ code: "ALREADY_REVIEWED", message: "Заявка уже рассмотрена." }, { status: 409 });

  await access.database.insert(notifications).values({
    id: randomUUID(),
    userId: joinRequest.userId,
    actorId: access.user.id,
    type: "space_join_rejected",
    title: "Заявка отклонена",
    body: "Заявка в " + access.space.name + " отклонена.",
    entityType: "space",
    entityId: spaceId,
  });

  await writeSpaceAuditLog({ spaceId, actorId: access.user.id, action: "join_request.reject", targetType: "user", targetId: joinRequest.userId, metadata: { requestId } });
  return NextResponse.json({ ok: true, status: "rejected", userId: joinRequest.userId });
}
