import { randomUUID } from "node:crypto";
import { and, asc, eq, max } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDatabase } from "@/db/client";
import { roles, spaces } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { roleSchema } from "@/lib/role-validation";

async function requireOwner(spaceId: string) {
  const user = await getCurrentUser();
  if (!user) return { error: NextResponse.json({ code: "UNAUTHENTICATED", message: "Требуется вход." }, { status: 401 }) };
  const database = getDatabase();
  const [space] = await database.select({ ownerId: spaces.ownerId }).from(spaces).where(eq(spaces.id, spaceId)).limit(1);
  if (!space) return { error: NextResponse.json({ code: "NOT_FOUND", message: "Пространство не найдено." }, { status: 404 }) };
  if (space.ownerId !== user.id) return { error: NextResponse.json({ code: "FORBIDDEN", message: "Управлять ролями может только владелец." }, { status: 403 }) };
  return { database };
}

export async function GET(_: Request, { params }: { params: Promise<{ spaceId: string }> }) {
  const { spaceId } = await params;
  const access = await requireOwner(spaceId);
  if ("error" in access) return access.error;
  const items = await access.database.select().from(roles).where(eq(roles.spaceId, spaceId)).orderBy(asc(roles.position));
  return NextResponse.json({ roles: items });
}

export async function POST(request: Request, { params }: { params: Promise<{ spaceId: string }> }) {
  const { spaceId } = await params;
  const access = await requireOwner(spaceId);
  if ("error" in access) return access.error;
  const parsed = roleSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ code: "INVALID_INPUT", message: "Проверьте название, цвет и права роли." }, { status: 400 });
  const [position] = await access.database.select({ value: max(roles.position) }).from(roles).where(eq(roles.spaceId, spaceId));
  const [created] = await access.database.insert(roles).values({ id: randomUUID(), spaceId, ...parsed.data, position: Math.max(1, (position.value ?? 0) + 1), isManaged: false }).returning();
  return NextResponse.json({ role: created }, { status: 201 });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ spaceId: string }> }) {
  const { spaceId } = await params;
  const access = await requireOwner(spaceId);
  if ("error" in access) return access.error;
  const body = await request.json().catch(() => null);
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
  const access = await requireOwner(spaceId);
  if ("error" in access) return access.error;
  const roleId = new URL(request.url).searchParams.get("roleId");
  if (!roleId) return NextResponse.json({ code: "INVALID_INPUT", message: "Не указана роль." }, { status: 400 });
  const [existing] = await access.database.select({ isManaged: roles.isManaged }).from(roles).where(and(eq(roles.id, roleId), eq(roles.spaceId, spaceId))).limit(1);
  if (!existing) return NextResponse.json({ code: "NOT_FOUND", message: "Роль не найдена." }, { status: 404 });
  if (existing.isManaged) return NextResponse.json({ code: "PROTECTED_ROLE", message: "Системную роль нельзя удалить." }, { status: 409 });
  await access.database.delete(roles).where(and(eq(roles.id, roleId), eq(roles.spaceId, spaceId)));
  return NextResponse.json({ ok: true });
}
