import { and, asc, eq, gt, inArray, or, sql } from "drizzle-orm";
import { after, NextResponse } from "next/server";
import { getDatabase } from "@/db/client";
import { memberRoles, members, roles, spaces, users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { dispatchDeveloperEvent } from "@/lib/developer-webhooks";
import { hasPermission, Permission } from "@/lib/permissions";

async function requireMemberManager(spaceId: string, requiredPermission: number) {
  const user = await getCurrentUser();
  if (!user) return { error: NextResponse.json({ code: "UNAUTHENTICATED", message: "Требуется вход." }, { status: 401 }) };
  const database = getDatabase();
  const [space] = await database.select({ ownerId: spaces.ownerId }).from(spaces).where(eq(spaces.id, spaceId)).limit(1);
  if (!space) return { error: NextResponse.json({ code: "NOT_FOUND", message: "Пространство не найдено." }, { status: 404 }) };
  if (space.ownerId === user.id) return { database, space, user, owner: true, topPosition: Number.MAX_SAFE_INTEGER };
  const assigned = await database.select({ position: roles.position, permissions: roles.permissions }).from(memberRoles)
    .innerJoin(roles, eq(roles.id, memberRoles.roleId))
    .where(and(eq(memberRoles.spaceId, spaceId), eq(memberRoles.userId, user.id)));
  const permissions = assigned.reduce((value, role) => value | Number(role.permissions), 0);
  if (!hasPermission(permissions, requiredPermission)) return { error: NextResponse.json({ code: "FORBIDDEN", message: "Недостаточно прав." }, { status: 403 }) };
  return { database, space, user, owner: false, topPosition: Math.max(0, ...assigned.map((role) => role.position)) };
}


export async function GET(request: Request, { params }: { params: Promise<{ spaceId: string }> }) {
  const { spaceId } = await params;
  const viewer = await getCurrentUser();
  if (!viewer) return NextResponse.json({ code: "UNAUTHENTICATED", message: "Требуется вход." }, { status: 401 });

  const url = new URL(request.url);
  const requestedLimit = Number(url.searchParams.get("limit") ?? 100);
  const limit = Number.isFinite(requestedLimit) ? Math.min(100, Math.max(20, Math.trunc(requestedLimit))) : 100;
  const cursorValue = url.searchParams.get("cursor");
  let cursorDate: Date | null = null;
  let cursorUserId = "";
  if (cursorValue) {
    const separator = cursorValue.lastIndexOf("|");
    if (separator <= 0) return NextResponse.json({ code: "INVALID_CURSOR", message: "Некорректный cursor." }, { status: 400 });
    cursorDate = new Date(cursorValue.slice(0, separator));
    cursorUserId = cursorValue.slice(separator + 1);
    if (Number.isNaN(cursorDate.getTime()) || !cursorUserId) return NextResponse.json({ code: "INVALID_CURSOR", message: "Некорректный cursor." }, { status: 400 });
  }

  const database = getDatabase();
  const [space] = await database.select({ ownerId: spaces.ownerId }).from(spaces).where(eq(spaces.id, spaceId)).limit(1);
  if (!space) return NextResponse.json({ code: "NOT_FOUND", message: "Пространство не найдено." }, { status: 404 });
  const [viewerMembership] = await database.select({ userId: members.userId }).from(members).where(and(eq(members.spaceId, spaceId), eq(members.userId, viewer.id))).limit(1);
  if (space.ownerId !== viewer.id && !viewerMembership) return NextResponse.json({ code: "FORBIDDEN", message: "Вы не состоите в этом сообществе." }, { status: 403 });

  const memberConditions = [
    eq(members.spaceId, spaceId),
    ...(cursorDate ? [or(
      gt(members.joinedAt, cursorDate),
      and(eq(members.joinedAt, cursorDate), gt(members.userId, cursorUserId)),
    )!] : []),
  ];

  const [memberRows, spaceRoles, totalRow] = await Promise.all([
    database.select({
      userId: members.userId,
      nickname: members.nickname,
      level: members.level,
      joinedAt: members.joinedAt,
      username: users.username,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl,
      lastSeenAt: users.lastSeenAt,
    }).from(members)
      .innerJoin(users, eq(members.userId, users.id))
      .where(and(...memberConditions))
      .orderBy(asc(members.joinedAt), asc(members.userId))
      .limit(limit + 1),
    database.select().from(roles).where(eq(roles.spaceId, spaceId)).orderBy(asc(roles.position)),
    database.select({ count: sql<number>`count(*)::int` }).from(members).where(eq(members.spaceId, spaceId)).limit(1),
  ]);

  const hasMore = memberRows.length > limit;
  const page = memberRows.slice(0, limit);
  const userIds = page.map((member) => member.userId);
  const assignments = userIds.length
    ? await database.select().from(memberRoles).where(and(eq(memberRoles.spaceId, spaceId), inArray(memberRoles.userId, userIds)))
    : [];
  const last = page.at(-1);

  return NextResponse.json({
    ownerId: space.ownerId,
    roles: spaceRoles,
    members: page.map((member) => ({
      ...member,
      online: Boolean(member.lastSeenAt && member.lastSeenAt.getTime() > Date.now() - 90_000),
      lastSeenAt: undefined,
      roleIds: assignments.filter((item) => item.userId === member.userId).map((item) => item.roleId),
    })),
    total: totalRow[0]?.count ?? 0,
    hasMore,
    nextCursor: hasMore && last ? `${last.joinedAt.toISOString()}|${last.userId}` : null,
  });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ spaceId: string }> }) {
  const { spaceId } = await params;
  const access = await requireMemberManager(spaceId, Permission.ManageRoles);
  if ("error" in access) return access.error;
  const body = await request.json().catch(() => null);
  if (!body || typeof body.userId !== "string" || !Array.isArray(body.roleIds) || body.roleIds.some((id: unknown) => typeof id !== "string")) return NextResponse.json({ code: "INVALID_INPUT", message: "Проверьте список ролей." }, { status: 400 });
  if (body.userId === access.space.ownerId) return NextResponse.json({ code: "OWNER_PROTECTED", message: "Роли владельца защищены." }, { status: 409 });
  const requested = [...new Set(body.roleIds as string[])];
  const available = requested.length ? await access.database.select({ id: roles.id, position: roles.position }).from(roles).where(and(eq(roles.spaceId, spaceId), eq(roles.isManaged, false), inArray(roles.id, requested))) : [];
  if (!access.owner && available.some((role) => role.position >= access.topPosition)) return NextResponse.json({ code: "ROLE_HIERARCHY", message: "Нельзя назначать роль на уровне вашей высшей роли или выше." }, { status: 403 });
  if (available.length !== requested.length) return NextResponse.json({ code: "INVALID_ROLE", message: "Одна из ролей недоступна." }, { status: 400 });
  const [memberRole] = await access.database.select({ id: roles.id }).from(roles).where(and(eq(roles.spaceId, spaceId), eq(roles.name, "Участник"))).limit(1);
  await access.database.transaction(async (tx) => {
    await tx.delete(memberRoles).where(and(eq(memberRoles.userId, body.userId), eq(memberRoles.spaceId, spaceId)));
    const roleIds = [...(memberRole ? [memberRole.id] : []), ...requested];
    if (roleIds.length) await tx.insert(memberRoles).values(roleIds.map((roleId) => ({ userId: body.userId, spaceId, roleId })));
  });
  return NextResponse.json({ roleIds: [...(memberRole ? [memberRole.id] : []), ...requested] });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ spaceId: string }> }) {
  const { spaceId } = await params;
  const access = await requireMemberManager(spaceId, Permission.KickMembers);
  if ("error" in access) return access.error;
  const userId = new URL(request.url).searchParams.get("userId");
  if (!userId) return NextResponse.json({ code: "INVALID_INPUT", message: "Не указан участник." }, { status: 400 });
  if (userId === access.space.ownerId) return NextResponse.json({ code: "OWNER_PROTECTED", message: "Владельца нельзя исключить." }, { status: 409 });
  const targetRoles = await access.database.select({ position: roles.position }).from(memberRoles).innerJoin(roles, eq(roles.id, memberRoles.roleId)).where(and(eq(memberRoles.spaceId, spaceId), eq(memberRoles.userId, userId)));
  const targetTop = Math.max(0, ...targetRoles.map((role) => role.position));
  if (!access.owner && targetTop >= access.topPosition) return NextResponse.json({ code: "ROLE_HIERARCHY", message: "Нельзя исключить участника с равной или более высокой ролью." }, { status: 403 });
  await access.database.transaction(async (tx) => {
    await tx.delete(memberRoles).where(and(eq(memberRoles.userId, userId), eq(memberRoles.spaceId, spaceId)));
    await tx.delete(members).where(and(eq(members.userId, userId), eq(members.spaceId, spaceId)));
  });
  after(() => dispatchDeveloperEvent(spaceId, "member.left", { userId, reason: "removed", actorId: access.user.id }).catch(() => undefined));
  return NextResponse.json({ ok: true });
}
