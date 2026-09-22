import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDatabase } from "@/db/client";
import { memberRoles, members, spaces } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { dispatchDeveloperEvent } from "@/lib/developer-webhooks";
import { updateSpaceSchema } from "@/lib/space-validation";

export async function PATCH(request: Request, { params }: { params: Promise<{ spaceId: string }> }) {
  const [user, { spaceId }] = await Promise.all([getCurrentUser(), params]);
  if (!user) return NextResponse.json({ code: "UNAUTHENTICATED", message: "Требуется вход." }, { status: 401 });
  const parsed = updateSpaceSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ code: "INVALID_INPUT", message: "Проверьте настройки пространства.", issues: parsed.error.flatten() }, { status: 400 });

  const database = getDatabase();
  const [space] = await database.select({ ownerId: spaces.ownerId }).from(spaces).where(eq(spaces.id, spaceId)).limit(1);
  if (!space) return NextResponse.json({ code: "NOT_FOUND", message: "Пространство не найдено." }, { status: 404 });
  if (space.ownerId !== user.id && user.platformRole !== "admin") return NextResponse.json({ code: "FORBIDDEN", message: "Недостаточно прав для изменения пространства." }, { status: 403 });

  const [updated] = await database.update(spaces).set({
    name: parsed.data.name,
    description: parsed.data.description || null,
    visibility: parsed.data.visibility,
    accentColor: parsed.data.accentColor,
    updatedAt: new Date(),
  }).where(eq(spaces.id, spaceId)).returning({ id: spaces.id, name: spaces.name, description: spaces.description, visibility: spaces.visibility, accentColor: spaces.accentColor });
  void dispatchDeveloperEvent(spaceId, "space.updated", { space: updated, actorId: user.id }).catch(() => undefined);
  return NextResponse.json({ space: updated });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ spaceId: string }> }) {
  const [user, { spaceId }] = await Promise.all([getCurrentUser(), params]);
  if (!user) return NextResponse.json({ code: "UNAUTHENTICATED", message: "Требуется вход." }, { status: 401 });
  const body = await request.json().catch(() => null); const database = getDatabase();
  const [space] = await database.select({ ownerId: spaces.ownerId, name: spaces.name }).from(spaces).where(eq(spaces.id, spaceId)).limit(1);
  if (!space) return NextResponse.json({ code: "NOT_FOUND", message: "Сервер не найден." }, { status: 404 });
  if (body?.action === "leave") {
    if (space.ownerId === user.id) return NextResponse.json({ code: "OWNER_CANNOT_LEAVE", message: "Владелец должен удалить сервер или передать владение." }, { status: 409 });
    const [membership] = await database.select({ userId: members.userId }).from(members).where(and(eq(members.userId, user.id), eq(members.spaceId, spaceId))).limit(1);
    if (!membership) return NextResponse.json({ code: "NOT_MEMBER", message: "Вы не состоите в этом сервере." }, { status: 404 });
    await database.transaction(async (tx) => { await tx.delete(memberRoles).where(and(eq(memberRoles.userId, user.id), eq(memberRoles.spaceId, spaceId))); await tx.delete(members).where(and(eq(members.userId, user.id), eq(members.spaceId, spaceId))); });
    void dispatchDeveloperEvent(spaceId, "member.left", { userId: user.id, reason: "left" }).catch(() => undefined);
    return NextResponse.json({ ok: true });
  }
  if (body?.action !== "delete" || body?.name !== space.name) return NextResponse.json({ code: "CONFIRMATION_REQUIRED", message: "Введите точное название сервера." }, { status: 400 });
  if (space.ownerId !== user.id && user.platformRole !== "admin") return NextResponse.json({ code: "FORBIDDEN", message: "Удалить сервер может только владелец." }, { status: 403 });
  await database.delete(spaces).where(eq(spaces.id, spaceId));
  return NextResponse.json({ ok: true });
}
