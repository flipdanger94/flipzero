import { randomUUID } from "node:crypto";
import { and, eq, max } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDatabase } from "@/db/client";
import { channelCategories, channels, spaces } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { createCategorySchema, updateCategorySchema } from "@/lib/space-validation";
import { getSpacePermissions } from "@/lib/space-permissions";
import { hasPermission, Permission } from "@/lib/permissions";
import { writeSpaceAuditLog } from "@/lib/space-audit";

async function managerAccess(spaceId: string) {
  const user = await getCurrentUser();
  if (!user) return { error: NextResponse.json({ code: "UNAUTHENTICATED", message: "Требуется вход." }, { status: 401 }) };
  const database = getDatabase();
  const [space] = await database.select({ ownerId: spaces.ownerId }).from(spaces).where(eq(spaces.id, spaceId)).limit(1);
  if (!space) return { error: NextResponse.json({ code: "NOT_FOUND", message: "Пространство не найдено." }, { status: 404 }) };
  if (space.ownerId !== user.id) {
    const state = await getSpacePermissions(spaceId, user.id);
    if (!state.spaceId || !hasPermission(state.permissions, Permission.ManageChannels)) return { error: NextResponse.json({ code: "FORBIDDEN", message: "Недостаточно прав для управления категориями." }, { status: 403 }) };
  }
  return { database, user };
}

export async function POST(request: Request, { params }: { params: Promise<{ spaceId: string }> }) {
  const { spaceId } = await params;
  const access = await managerAccess(spaceId);
  if ("error" in access) return access.error;
  const parsed = createCategorySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ code: "INVALID_INPUT", message: "Проверьте название категории." }, { status: 400 });
  const [duplicate] = await access.database.select({ id: channelCategories.id }).from(channelCategories).where(and(eq(channelCategories.spaceId, spaceId), eq(channelCategories.name, parsed.data.name))).limit(1);
  if (duplicate) return NextResponse.json({ code: "CATEGORY_EXISTS", message: "Такая категория уже существует." }, { status: 409 });
  const [position] = await access.database.select({ value: max(channelCategories.position) }).from(channelCategories).where(eq(channelCategories.spaceId, spaceId));
  const category = { id: randomUUID(), spaceId, name: parsed.data.name, position: (position?.value ?? -1) + 1 };
  await access.database.insert(channelCategories).values(category);
  await writeSpaceAuditLog({ spaceId, actorId: access.user.id, action: "category.create", targetType: "category", targetId: category.id, metadata: { name: category.name } });
  return NextResponse.json({ category }, { status: 201 });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ spaceId: string }> }) {
  const { spaceId } = await params;
  const access = await managerAccess(spaceId);
  if ("error" in access) return access.error;
  const body = await request.json().catch(() => null);

  if (body?.action === "reorder") {
    const orderedIds: string[] = Array.isArray(body.orderedIds) ? Array.from(new Set((body.orderedIds as unknown[]).filter((id): id is string => typeof id === "string"))) : [];
    if (!orderedIds.length || orderedIds.length > 100) return NextResponse.json({ code: "INVALID_INPUT", message: "Некорректный порядок категорий." }, { status: 400 });
    const allCategories = await access.database.select({ id: channelCategories.id }).from(channelCategories).where(eq(channelCategories.spaceId, spaceId));
    const existingIds = new Set(allCategories.map((item) => item.id));
    if (orderedIds.length !== allCategories.length || orderedIds.some((id) => !existingIds.has(id))) return NextResponse.json({ code: "INVALID_CATEGORY_ORDER", message: "Передайте полный порядок категорий сервера." }, { status: 400 });
    await access.database.transaction(async (tx) => {
      for (const [position, id] of orderedIds.entries()) await tx.update(channelCategories).set({ position }).where(and(eq(channelCategories.id, id), eq(channelCategories.spaceId, spaceId)));
    });
    await writeSpaceAuditLog({ spaceId, actorId: access.user.id, action: "category.reorder", targetType: "category", metadata: { orderedIds } });
    return NextResponse.json({ orderedIds });
  }

  const parsed = updateCategorySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ code: "INVALID_INPUT", message: "Проверьте название категории." }, { status: 400 });
  const [duplicate] = await access.database.select({ id: channelCategories.id }).from(channelCategories).where(and(eq(channelCategories.spaceId, spaceId), eq(channelCategories.name, parsed.data.name))).limit(1);
  if (duplicate && duplicate.id !== parsed.data.categoryId) return NextResponse.json({ code: "CATEGORY_EXISTS", message: "Такая категория уже существует." }, { status: 409 });
  const [category] = await access.database.update(channelCategories).set({ name: parsed.data.name }).where(and(eq(channelCategories.id, parsed.data.categoryId), eq(channelCategories.spaceId, spaceId))).returning();
  if (!category) return NextResponse.json({ code: "NOT_FOUND", message: "Категория не найдена." }, { status: 404 });
  await writeSpaceAuditLog({ spaceId, actorId: access.user.id, action: "category.update", targetType: "category", targetId: category.id, metadata: { name: category.name } });
  return NextResponse.json({ category });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ spaceId: string }> }) {
  const { spaceId } = await params;
  const access = await managerAccess(spaceId);
  if ("error" in access) return access.error;
  const categoryId = new URL(request.url).searchParams.get("categoryId");
  if (!categoryId) return NextResponse.json({ code: "INVALID_INPUT", message: "Не указана категория." }, { status: 400 });
  const [category] = await access.database.select({ id: channelCategories.id }).from(channelCategories).where(and(eq(channelCategories.id, categoryId), eq(channelCategories.spaceId, spaceId))).limit(1);
  if (!category) return NextResponse.json({ code: "NOT_FOUND", message: "Категория не найдена." }, { status: 404 });
  await access.database.transaction(async (tx) => {
    await tx.update(channels).set({ parentId: null }).where(eq(channels.parentId, categoryId));
    await tx.delete(channelCategories).where(eq(channelCategories.id, categoryId));
  });
  await writeSpaceAuditLog({ spaceId, actorId: access.user.id, action: "category.delete", targetType: "category", targetId: categoryId });
  return NextResponse.json({ success: true });
}
