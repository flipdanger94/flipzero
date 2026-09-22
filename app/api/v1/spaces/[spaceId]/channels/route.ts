import { randomUUID } from "node:crypto";
import { and, count, eq, max } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDatabase } from "@/db/client";
import { channelCategories, channels, spaces } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { createChannelSchema, updateChannelSchema } from "@/lib/space-validation";
import { getSpacePermissions } from "@/lib/space-permissions";
import { hasPermission, Permission } from "@/lib/permissions";
import { resetChannelVoiceRooms } from "@/lib/livekit-admin";

export async function POST(request: Request, { params }: { params: Promise<{ spaceId: string }> }) {
  const [user, { spaceId }] = await Promise.all([getCurrentUser(), params]);
  if (!user) return NextResponse.json({ code: "UNAUTHENTICATED", message: "Требуется вход." }, { status: 401 });
  const parsed = createChannelSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ code: "INVALID_INPUT", message: "Проверьте данные канала.", issues: parsed.error.flatten() }, { status: 400 });

  const database = getDatabase();
  const [space] = await database.select({ ownerId: spaces.ownerId }).from(spaces).where(eq(spaces.id, spaceId)).limit(1);
  if (!space) return NextResponse.json({ code: "NOT_FOUND", message: "Пространство не найдено." }, { status: 404 });
  if (space.ownerId !== user.id) {
    const permissionState = await getSpacePermissions(spaceId, user.id);
    if (!permissionState.spaceId || !hasPermission(permissionState.permissions, Permission.ManageChannels)) return NextResponse.json({ code: "FORBIDDEN", message: "Недостаточно прав для создания каналов." }, { status: 403 });
  }

  if (parsed.data.parentId) {
    const [category] = await database.select({ id: channelCategories.id }).from(channelCategories).where(and(eq(channelCategories.id, parsed.data.parentId), eq(channelCategories.spaceId, spaceId))).limit(1);
    if (!category) return NextResponse.json({ code: "INVALID_CATEGORY", message: "Категория не найдена." }, { status: 400 });
  }

  const [duplicate] = await database.select({ id: channels.id }).from(channels).where(and(eq(channels.spaceId, spaceId), eq(channels.name, parsed.data.name))).limit(1);
  if (duplicate) return NextResponse.json({ code: "CHANNEL_EXISTS", message: "Канал с таким названием уже существует." }, { status: 409 });
  const [positionResult] = await database.select({ value: max(channels.position) }).from(channels).where(eq(channels.spaceId, spaceId));
  const channel = { id: randomUUID(), spaceId, parentId: parsed.data.parentId, name: parsed.data.name, topic: parsed.data.topic || null, kind: parsed.data.kind, position: (positionResult?.value ?? -1) + 1 };
  await database.insert(channels).values(channel);
  return NextResponse.json({ channel }, { status: 201 });
}


export async function PATCH(request: Request, { params }: { params: Promise<{ spaceId: string }> }) {
  const [user, { spaceId }] = await Promise.all([getCurrentUser(), params]);
  if (!user) return NextResponse.json({ code: "UNAUTHENTICATED", message: "Требуется вход." }, { status: 401 });
  const parsed = updateChannelSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ code: "INVALID_INPUT", message: "Проверьте настройки канала.", issues: parsed.error.flatten() }, { status: 400 });

  const database = getDatabase();
  const [space] = await database.select({ ownerId: spaces.ownerId }).from(spaces).where(eq(spaces.id, spaceId)).limit(1);
  if (!space) return NextResponse.json({ code: "NOT_FOUND", message: "Пространство не найдено." }, { status: 404 });
  if (space.ownerId !== user.id) {
    const permissionState = await getSpacePermissions(spaceId, user.id);
    if (!permissionState.spaceId || !hasPermission(permissionState.permissions, Permission.ManageChannels)) return NextResponse.json({ code: "FORBIDDEN", message: "Недостаточно прав для изменения канала." }, { status: 403 });
  }

  if (parsed.data.parentId) {
    const [parent] = await database.select({ id: channelCategories.id }).from(channelCategories).where(and(eq(channelCategories.id, parsed.data.parentId), eq(channelCategories.spaceId, spaceId))).limit(1);
    if (!parent) return NextResponse.json({ code: "INVALID_CATEGORY", message: "Категория не принадлежит этому серверу." }, { status: 400 });
  }
  const [duplicate] = await database.select({ id: channels.id }).from(channels).where(and(
    eq(channels.spaceId, spaceId),
    eq(channels.name, parsed.data.name),
  )).limit(1);
  if (duplicate && duplicate.id !== parsed.data.channelId) return NextResponse.json({ code: "CHANNEL_EXISTS", message: "Канал с таким названием уже существует." }, { status: 409 });

  const [channel] = await database.update(channels).set({
    name: parsed.data.name,
    parentId: parsed.data.parentId,
    topic: parsed.data.topic || null,
    slowmodeSeconds: parsed.data.slowmodeSeconds,
    isNsfw: parsed.data.isNsfw,
  }).where(and(eq(channels.id, parsed.data.channelId), eq(channels.spaceId, spaceId))).returning({
    id: channels.id,
    parentId: channels.parentId,
    name: channels.name,
    topic: channels.topic,
    kind: channels.kind,
    slowmodeSeconds: channels.slowmodeSeconds,
    isNsfw: channels.isNsfw,
  });
  if (!channel) return NextResponse.json({ code: "NOT_FOUND", message: "Канал не найден." }, { status: 404 });
  return NextResponse.json({ channel });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ spaceId: string }> }) {
  const [user, { spaceId }] = await Promise.all([getCurrentUser(), params]);
  if (!user) return NextResponse.json({ code: "UNAUTHENTICATED", message: "Требуется вход." }, { status: 401 });
  const channelId = new URL(request.url).searchParams.get("channelId");
  if (!channelId) return NextResponse.json({ code: "INVALID_INPUT", message: "Не указан канал." }, { status: 400 });

  const database = getDatabase();
  const [space] = await database.select({ ownerId: spaces.ownerId }).from(spaces).where(eq(spaces.id, spaceId)).limit(1);
  if (!space) return NextResponse.json({ code: "NOT_FOUND", message: "Пространство не найдено." }, { status: 404 });
  const [channel] = await database.select({ id: channels.id, kind: channels.kind }).from(channels).where(and(eq(channels.id, channelId), eq(channels.spaceId, spaceId))).limit(1);
  if (!channel) return NextResponse.json({ code: "NOT_FOUND", message: "Канал не найден." }, { status: 404 });
  if (space.ownerId !== user.id) { const permissionState = await getSpacePermissions(spaceId, user.id); if (!permissionState.spaceId || !hasPermission(permissionState.permissions, Permission.ManageChannels)) return NextResponse.json({ code: "FORBIDDEN", message: "Недостаточно прав для удаления каналов." }, { status: 403 }); }
  if (channel.kind === "text") {
    const [textCount] = await database.select({ value: count() }).from(channels).where(and(eq(channels.spaceId, spaceId), eq(channels.kind, "text")));
    if (textCount.value <= 1) return NextResponse.json({ code: "LAST_TEXT_CHANNEL", message: "Нельзя удалить последний текстовый канал." }, { status: 409 });
  }
  if (["voice", "stage"].includes(channel.kind)) await resetChannelVoiceRooms(spaceId, channelId);
  await database.delete(channels).where(eq(channels.id, channelId));
  return NextResponse.json({ success: true });
}
