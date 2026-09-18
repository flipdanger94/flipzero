import { and, asc, eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDatabase } from "@/db/client";
import { memberRoles, members, roles, spaces, users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";

async function requireOwner(spaceId: string) {
  const user = await getCurrentUser();
  if (!user) return { error: NextResponse.json({ code: "UNAUTHENTICATED", message: "Требуется вход." }, { status: 401 }) };
  const database = getDatabase();
  const [space] = await database.select({ ownerId: spaces.ownerId }).from(spaces).where(eq(spaces.id, spaceId)).limit(1);
  if (!space) return { error: NextResponse.json({ code: "NOT_FOUND", message: "Пространство не найдено." }, { status: 404 }) };
  if (space.ownerId !== user.id) return { error: NextResponse.json({ code: "FORBIDDEN", message: "Участниками может управлять только владелец." }, { status: 403 }) };
  return { database, space };
}

export async function GET(_: Request, { params }: { params: Promise<{ spaceId: string }> }) {
  const { spaceId } = await params;
  const access = await requireOwner(spaceId);
  if ("error" in access) return access.error;
  const [spaceMembers, spaceRoles, assignments] = await Promise.all([
    access.database.select({ userId: members.userId, nickname: members.nickname, level: members.level, joinedAt: members.joinedAt, username: users.username, displayName: users.displayName, avatarUrl: users.avatarUrl }).from(members).innerJoin(users, eq(members.userId, users.id)).where(eq(members.spaceId, spaceId)).orderBy(asc(members.joinedAt)),
    access.database.select().from(roles).where(eq(roles.spaceId, spaceId)).orderBy(asc(roles.position)),
    access.database.select().from(memberRoles).where(eq(memberRoles.spaceId, spaceId)),
  ]);
  return NextResponse.json({ ownerId: access.space.ownerId, roles: spaceRoles, members: spaceMembers.map((member) => ({ ...member, roleIds: assignments.filter((item) => item.userId === member.userId).map((item) => item.roleId) })) });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ spaceId: string }> }) {
  const { spaceId } = await params;
  const access = await requireOwner(spaceId);
  if ("error" in access) return access.error;
  const body = await request.json().catch(() => null);
  if (!body || typeof body.userId !== "string" || !Array.isArray(body.roleIds) || body.roleIds.some((id: unknown) => typeof id !== "string")) return NextResponse.json({ code: "INVALID_INPUT", message: "Проверьте список ролей." }, { status: 400 });
  if (body.userId === access.space.ownerId) return NextResponse.json({ code: "OWNER_PROTECTED", message: "Роли владельца защищены." }, { status: 409 });
  const requested = [...new Set(body.roleIds as string[])];
  const available = requested.length ? await access.database.select({ id: roles.id }).from(roles).where(and(eq(roles.spaceId, spaceId), eq(roles.isManaged, false), inArray(roles.id, requested))) : [];
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
  const access = await requireOwner(spaceId);
  if ("error" in access) return access.error;
  const userId = new URL(request.url).searchParams.get("userId");
  if (!userId) return NextResponse.json({ code: "INVALID_INPUT", message: "Не указан участник." }, { status: 400 });
  if (userId === access.space.ownerId) return NextResponse.json({ code: "OWNER_PROTECTED", message: "Владельца нельзя исключить." }, { status: 409 });
  await access.database.transaction(async (tx) => {
    await tx.delete(memberRoles).where(and(eq(memberRoles.userId, userId), eq(memberRoles.spaceId, spaceId)));
    await tx.delete(members).where(and(eq(members.userId, userId), eq(members.spaceId, spaceId)));
  });
  return NextResponse.json({ ok: true });
}
