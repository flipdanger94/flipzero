import { randomUUID } from "node:crypto";
import { and, asc, eq, max } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDatabase } from "@/db/client";
import { roles, spaces } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { roleSchema } from "@/lib/role-validation";
import { memberRoles, members } from "@/db/schema";
import { hasPermission, Permission } from "@/lib/permissions";

async function requireRoleManager(spaceId: string) {
  const user = await getCurrentUser();
  if (!user) return { error: NextResponse.json({ code: "UNAUTHENTICATED", message: "Требуется вход." }, { status: 401 }) };
  const database = getDatabase();
  const [space] = await database.select({ ownerId: spaces.ownerId }).from(spaces).where(eq(spaces.id, spaceId)).limit(1);
  if (!space) return { error: NextResponse.json({ code: "NOT_FOUND", message: "Пространство не найдено." }, { status: 404 }) };
  if (space.ownerId !== user.id) {
    const [membership] = await database.select({ userId: members.userId }).from(members).where(and(eq(members.spaceId, spaceId), eq(members.userId, user.id))).limit(1);
    if (!membership) return { error: NextResponse.json({ code: "FORBIDDEN", message: "Вы не состоите в этом сообществе." }, { status: 403 }) };
    const assigned = await database.select({ permissions: roles.permissions }).from(memberRoles).innerJoin(roles, eq(roles.id, memberRoles.roleId)).where(and(eq(memberRoles.spaceId, spaceId), eq(memberRoles.userId, user.id)));
    const permissions = assigned.reduce((value, role) => value | Number(role.permissions), 0);
    if (!hasPermission(permissions, Permission.ManageRoles)) return { error: NextResponse.json({ code: "FORBIDDEN", message: "Недостаточно прав для управления ролями." }, { status: 403 }) };
  }
  return { database, user, space };
}

export async function GET(_: Request, { params }: { params: Promise<{ spaceId: string }> }) {
  const { spaceId } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ code: "UNAUTHENTICATED", message: "Требуется вход." }, { status: 401 });
  const database = getDatabase();
  const [space] = await database.select({ ownerId: spaces.ownerId }).from(spaces).where(eq(spaces.id, spaceId)).limit(1);
  if (!space) return NextResponse.json({ code: "NOT_FOUND", message: "Пространство не найдено." }, { status: 404 });
  if (space.ownerId !== user.id) {
    const [membership] = await database.select({ userId: members.userId }).from(members).where(and(eq(members.spaceId, spaceId), eq(members.userId, user.id))).limit(1);
    if (!membership) return NextResponse.json({ code: "FORBIDDEN", message: "Вы не состоите в этом сообществе." }, { status: 403 });
  }
  const items = await database.select().from(roles).where(eq(roles.spaceId, spaceId)).orderBy(asc(roles.position));
  return NextResponse.json({ roles: items });
}

export async function POST(request: Request, { params }: { params: Promise<{ spaceId: string }> }) {
  const { spaceId } = await params;
  const access = await requireRoleManager(spaceId);
  if ("error" in access) return access.error;
  const parsed = roleSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ code: "INVALID_INPUT", message: "Проверьте название, цвет и права роли." }, { status: 400 });
  const [position] = await access.database.select({ value: max(roles.position) }).from(roles).where(eq(roles.spaceId, spaceId));
  const [created] = await access.database.insert(roles).values({ id: randomUUID(), spaceId, ...parsed.data, position: Math.max(1, (position.value ?? 0) + 1), isManaged: false }).returning();
  return NextResponse.json({ role: created }, { status: 201 });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ spaceId: string }> }) {
  const { spaceId } = await params;
  const access = await requireRoleManager(spaceId);
  if ("error" in access) return access.error;
  const body = await request.json().catch(() => null);
  if (typeof body?.id === "string" && typeof body?.showInMemberList === "boolean") {
    const [existing] = await access.database.select({ id: roles.id }).from(roles).where(and(eq(roles.id, body.id), eq(roles.spaceId, spaceId))).limit(1);
    if (!existing) return NextResponse.json({ code: "NOT_FOUND", message: "Роль не найдена." }, { status: 404 });
    const [updated] = await access.database.update(roles).set({ showInMemberList: body.showInMemberList }).where(and(eq(roles.id, body.id), eq(roles.spaceId, spaceId))).returning();
    return NextResponse.json({ role: updated });
  }
  const parsed = roleSchema.safeParse(body);
  if (!parsed.success || typeof body?.id !== "string") return NextResponse.json({ code: "INVALID_INPUT", message: "Проверьте данные роли." }, { status: 400 });
  const [existing] = await access.database.select({ isManaged: roles.isManaged }).from(roles).where(and(eq(roles.id, body.id), eq(roles.spaceId, spaceId))).limit(1);
  if (!existing) return NextResponse.json({ code: "NOT_FOUND", message: "Роль не найдена." }, { status: 404 });
  if (existing.isManaged) return NextResponse.json({ code: "PROTECTED_ROLE", message: "Системную роль нельзя изменять." }, { status: 409 });
  const [updated] = await access.database.update(roles).set(parsed.data).where(and(eq(roles.id, body.id), eq(roles.spaceId, spaceId))).returning();
  return NextResponse.json({ role: updated });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ spaceId: string }> }) {
  const { spaceId } = await params;
  const access = await requireRoleManager(spaceId);
  if ("error" in access) return access.error;
  const roleId = new URL(request.url).searchParams.get("roleId");
  if (!roleId) return NextResponse.json({ code: "INVALID_INPUT", message: "Не указана роль." }, { status: 400 });
  const [existing] = await access.database.select({ isManaged: roles.isManaged }).from(roles).where(and(eq(roles.id, roleId), eq(roles.spaceId, spaceId))).limit(1);
  if (!existing) return NextResponse.json({ code: "NOT_FOUND", message: "Роль не найдена." }, { status: 404 });
  if (existing.isManaged) return NextResponse.json({ code: "PROTECTED_ROLE", message: "Системную роль нельзя удалить." }, { status: 409 });
  await access.database.delete(roles).where(and(eq(roles.id, roleId), eq(roles.spaceId, spaceId)));
  return NextResponse.json({ ok: true });
}
