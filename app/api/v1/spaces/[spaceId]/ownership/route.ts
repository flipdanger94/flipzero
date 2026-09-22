import { and, eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDatabase } from "@/db/client";
import { memberRoles, members, roles, spaces } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { expandPermissions, Permission } from "@/lib/permissions";
import { evictParticipantsFromSpaceVoice } from "@/lib/livekit-admin";

export async function POST(request: Request, { params }: { params: Promise<{ spaceId: string }> }) {
  const [user, { spaceId }] = await Promise.all([getCurrentUser(), params]);
  if (!user) return NextResponse.json({ code: "UNAUTHENTICATED", message: "Требуется вход." }, { status: 401 });

  const body = await request.json().catch(() => null);
  const targetUserId = typeof body?.targetUserId === "string" ? body.targetUserId : "";
  const confirmation = typeof body?.confirmation === "string" ? body.confirmation : "";
  if (!targetUserId) return NextResponse.json({ code: "INVALID_INPUT", message: "Выберите нового владельца." }, { status: 400 });

  const database = getDatabase();
  const [space] = await database.select({ ownerId: spaces.ownerId, name: spaces.name }).from(spaces).where(eq(spaces.id, spaceId)).limit(1);
  if (!space) return NextResponse.json({ code: "NOT_FOUND", message: "Пространство не найдено." }, { status: 404 });
  if (space.ownerId !== user.id) return NextResponse.json({ code: "FORBIDDEN", message: "Передать владение может только текущий владелец." }, { status: 403 });
  if (targetUserId === user.id) return NextResponse.json({ code: "INVALID_TARGET", message: "Вы уже являетесь владельцем." }, { status: 409 });
  if (confirmation !== space.name) return NextResponse.json({ code: "CONFIRMATION_REQUIRED", message: "Введите точное название сервера для подтверждения." }, { status: 400 });

  const [[targetMember], managedRoles] = await Promise.all([
    database.select({ userId: members.userId }).from(members).where(and(eq(members.spaceId, spaceId), eq(members.userId, targetUserId))).limit(1),
    database.select({ id: roles.id, name: roles.name }).from(roles).where(and(eq(roles.spaceId, spaceId), eq(roles.isManaged, true), inArray(roles.name, ["Владелец", "Участник"]))),
  ]);
  if (!targetMember) return NextResponse.json({ code: "NOT_MEMBER", message: "Новый владелец должен состоять в этом сервере." }, { status: 409 });

  const ownerRole = managedRoles.find((role) => role.name === "Владелец");
  const memberRole = managedRoles.find((role) => role.name === "Участник");
  if (!ownerRole || !memberRole) return NextResponse.json({ code: "ROLE_CONFIGURATION", message: "Системные роли сервера настроены некорректно." }, { status: 409 });

  const transferred = await database.transaction(async (tx) => {
    const updated = await tx.update(spaces)
      .set({ ownerId: targetUserId, updatedAt: new Date() })
      .where(and(eq(spaces.id, spaceId), eq(spaces.ownerId, user.id)))
      .returning({ id: spaces.id });
    if (!updated.length) return false;

    await tx.delete(memberRoles).where(and(eq(memberRoles.spaceId, spaceId), eq(memberRoles.roleId, ownerRole.id), inArray(memberRoles.userId, [user.id, targetUserId])));
    await tx.insert(memberRoles).values({ userId: targetUserId, spaceId, roleId: ownerRole.id }).onConflictDoNothing();
    await tx.insert(memberRoles).values([
      { userId: user.id, spaceId, roleId: memberRole.id },
      { userId: targetUserId, spaceId, roleId: memberRole.id },
    ]).onConflictDoNothing();
    return true;
  });

  if (!transferred) return NextResponse.json({ code: "OWNERSHIP_CHANGED", message: "Владелец уже изменился. Обновите сервер и попробуйте снова." }, { status: 409 });

  await evictParticipantsFromSpaceVoice(spaceId, [user.id, targetUserId]);
  const currentRoles = await database.select({ permissions: roles.permissions }).from(memberRoles)
    .innerJoin(roles, eq(roles.id, memberRoles.roleId))
    .where(and(eq(memberRoles.spaceId, spaceId), eq(memberRoles.userId, user.id)));
  const permissions = expandPermissions(currentRoles.reduce((value, role) => value | Number(role.permissions), 0));

  return NextResponse.json({
    ownerId: targetUserId,
    permissions,
    message: "Владение сервером передано.",
  });
}
