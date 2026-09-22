import { and, asc, eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDatabase } from "@/db/client";
import { memberRoles, members, roles, spaces, users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { expandPermissions, hasPermission, Permission } from "@/lib/permissions";

async function requireMemberManager(spaceId: string, requiredPermission: number) {
  const user = await getCurrentUser();
  if (!user) return { error: NextResponse.json({ code: "UNAUTHENTICATED", message: "Требуется вход." }, { status: 401 }) };
  const database = getDatabase();
  const [space] = await database.select({ ownerId: spaces.ownerId }).from(spaces).where(eq(spaces.id, spaceId)).limit(1);
  if (!space) return { error: NextResponse.json({ code: "NOT_FOUND", message: "Пространство не найдено." }, { status: 404 }) };
  if (space.ownerId === user.id) return { database, space, user, owner: true, topPosition: Number.MAX_SAFE_INTEGER, permissions: expandPermissions(Permission.Administrator) };
  const assigned = await database.select({ position: roles.position, permissions: roles.permissions }).from(memberRoles)
    .innerJoin(roles, eq(roles.id, memberRoles.roleId))
    .where(and(eq(memberRoles.spaceId, spaceId), eq(memberRoles.userId, user.id)));
  const permissions = expandPermissions(assigned.reduce((value, role) => value | Number(role.permissions), 0));
  if (!hasPermission(permissions, requiredPermission)) return { error: NextResponse.json({ code: "FORBIDDEN", message: "Недостаточно прав." }, { status: 403 }) };
  return { database, space, user, owner: false, topPosition: Math.max(0, ...assigned.map((role) => role.position)), permissions };
}


export async function GET(_: Request, { params }: { params: Promise<{ spaceId: string }> }) {
  const { spaceId } = await params;
  const viewer = await getCurrentUser();
  if (!viewer) return NextResponse.json({ code: "UNAUTHENTICATED", message: "Требуется вход." }, { status: 401 });
  const database = getDatabase();
  const [space] = await database.select({ ownerId: spaces.ownerId }).from(spaces).where(eq(spaces.id, spaceId)).limit(1);
  if (!space) return NextResponse.json({ code: "NOT_FOUND", message: "Пространство не найдено." }, { status: 404 });
  const [viewerMembership] = await database.select({ userId: members.userId }).from(members).where(and(eq(members.spaceId, spaceId), eq(members.userId, viewer.id))).limit(1);
  if (space.ownerId !== viewer.id && !viewerMembership) return NextResponse.json({ code: "FORBIDDEN", message: "Вы не состоите в этом сообществе." }, { status: 403 });
  const [spaceMembers, spaceRoles, assignments] = await Promise.all([
    database.select({ userId: members.userId, nickname: members.nickname, level: members.level, joinedAt: members.joinedAt, username: users.username, displayName: users.displayName, avatarUrl: users.avatarUrl }).from(members).innerJoin(users, eq(members.userId, users.id)).where(eq(members.spaceId, spaceId)).orderBy(asc(members.joinedAt)),
    database.select().from(roles).where(eq(roles.spaceId, spaceId)).orderBy(asc(roles.position)),
    database.select().from(memberRoles).where(eq(memberRoles.spaceId, spaceId)),
  ]);
  const roleMap = new Map(spaceRoles.map((role) => [role.id, role]));
  const viewerRoleIds = assignments.filter((item) => item.userId === viewer.id).map((item) => item.roleId);
  const viewerRoles = viewerRoleIds.map((id) => roleMap.get(id)).filter((role): role is NonNullable<typeof role> => Boolean(role));
  const viewerPermissions = space.ownerId === viewer.id ? expandPermissions(Permission.Administrator) : expandPermissions(viewerRoles.reduce((value, role) => value | Number(role.permissions), 0));
  const viewerTopPosition = space.ownerId === viewer.id ? Number.MAX_SAFE_INTEGER : Math.max(0, ...viewerRoles.map((role) => role.position));
  const canManageRoles = space.ownerId === viewer.id || hasPermission(viewerPermissions, Permission.ManageRoles);
  const canKickMembers = space.ownerId === viewer.id || hasPermission(viewerPermissions, Permission.KickMembers);
  return NextResponse.json({
    ownerId: space.ownerId,
    capabilities: { manageRoles: canManageRoles, kickMembers: canKickMembers },
    roles: spaceRoles.map((role) => ({
      ...role,
      assignable: !role.isManaged && (space.ownerId === viewer.id || (canManageRoles && role.position < viewerTopPosition && !hasPermission(Number(role.permissions), Permission.Administrator) && (Number(role.permissions) & ~viewerPermissions) === 0)),
    })),
    members: spaceMembers.map((member) => {
      const roleIds = assignments.filter((item) => item.userId === member.userId).map((item) => item.roleId);
      const memberTopPosition = Math.max(0, ...roleIds.map((id) => roleMap.get(id)?.position ?? 0));
      const hierarchyAllows = space.ownerId === viewer.id || memberTopPosition < viewerTopPosition;
      return {
        ...member,
        roleIds,
        canEditRoles: canManageRoles && member.userId !== viewer.id && member.userId !== space.ownerId && hierarchyAllows,
        canKick: canKickMembers && member.userId !== viewer.id && member.userId !== space.ownerId && hierarchyAllows,
      };
    }),
  });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ spaceId: string }> }) {
  const { spaceId } = await params;
  const access = await requireMemberManager(spaceId, Permission.ManageRoles);
  if ("error" in access) return access.error;
  const body = await request.json().catch(() => null);
  if (!body || typeof body.userId !== "string" || !Array.isArray(body.roleIds) || body.roleIds.some((id: unknown) => typeof id !== "string")) return NextResponse.json({ code: "INVALID_INPUT", message: "Проверьте список ролей." }, { status: 400 });
  const [targetMember] = await access.database.select({ userId: members.userId }).from(members).where(and(eq(members.spaceId, spaceId), eq(members.userId, body.userId))).limit(1);
  if (!targetMember) return NextResponse.json({ code: "NOT_FOUND", message: "Участник не найден." }, { status: 404 });
  if (!access.owner && body.userId === access.user.id) return NextResponse.json({ code: "SELF_ROLE_CHANGE", message: "Нельзя изменять собственные роли." }, { status: 403 });
  if (body.userId === access.space.ownerId) return NextResponse.json({ code: "OWNER_PROTECTED", message: "Роли владельца защищены." }, { status: 409 });
  const targetAssigned = await access.database.select({ id: roles.id, position: roles.position, permissions: roles.permissions, isManaged: roles.isManaged }).from(memberRoles).innerJoin(roles, eq(roles.id, memberRoles.roleId)).where(and(eq(memberRoles.spaceId, spaceId), eq(memberRoles.userId, body.userId)));
  const targetTop = Math.max(0, ...targetAssigned.map((role) => role.position));
  if (!access.owner && targetTop >= access.topPosition) return NextResponse.json({ code: "ROLE_HIERARCHY", message: "Нельзя изменять роли участника с равной или более высокой ролью." }, { status: 403 });
  const requested = [...new Set(body.roleIds as string[])];
  const available = requested.length ? await access.database.select({ id: roles.id, position: roles.position, permissions: roles.permissions }).from(roles).where(and(eq(roles.spaceId, spaceId), eq(roles.isManaged, false), inArray(roles.id, requested))) : [];
  if (!access.owner && targetAssigned.some((role) => hasPermission(Number(role.permissions), Permission.Administrator))) return NextResponse.json({ code: "ROLE_HIERARCHY", message: "Нельзя изменять роли участника с правами администратора." }, { status: 403 });
  const existingCustomRoleIds = new Set(targetAssigned.filter((role) => !role.isManaged).map((role) => role.id));
  const newlyAssigned = available.filter((role) => !existingCustomRoleIds.has(role.id));
  if (!access.owner && newlyAssigned.some((role) => hasPermission(Number(role.permissions), Permission.Administrator) || (Number(role.permissions) & ~access.permissions) !== 0)) return NextResponse.json({ code: "ROLE_ESCALATION", message: "Нельзя назначать роль с правами, которых нет у вас." }, { status: 403 });
  if (!access.owner && newlyAssigned.some((role) => role.position >= access.topPosition)) return NextResponse.json({ code: "ROLE_HIERARCHY", message: "Нельзя назначать роль на уровне вашей высшей роли или выше." }, { status: 403 });
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
  const [targetMember] = await access.database.select({ userId: members.userId }).from(members).where(and(eq(members.spaceId, spaceId), eq(members.userId, userId))).limit(1);
  if (!targetMember) return NextResponse.json({ code: "NOT_FOUND", message: "Участник не найден." }, { status: 404 });
  if (userId === access.user.id) return NextResponse.json({ code: "SELF_KICK", message: "Нельзя исключить самого себя этим действием." }, { status: 409 });
  if (userId === access.space.ownerId) return NextResponse.json({ code: "OWNER_PROTECTED", message: "Владельца нельзя исключить." }, { status: 409 });
  const targetRoles = await access.database.select({ position: roles.position }).from(memberRoles).innerJoin(roles, eq(roles.id, memberRoles.roleId)).where(and(eq(memberRoles.spaceId, spaceId), eq(memberRoles.userId, userId)));
  const targetTop = Math.max(0, ...targetRoles.map((role) => role.position));
  if (!access.owner && targetTop >= access.topPosition) return NextResponse.json({ code: "ROLE_HIERARCHY", message: "Нельзя исключить участника с равной или более высокой ролью." }, { status: 403 });
  await access.database.transaction(async (tx) => {
    await tx.delete(memberRoles).where(and(eq(memberRoles.userId, userId), eq(memberRoles.spaceId, spaceId)));
    await tx.delete(members).where(and(eq(members.userId, userId), eq(members.spaceId, spaceId)));
  });
  return NextResponse.json({ ok: true });
}
