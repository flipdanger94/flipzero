import { randomUUID } from "node:crypto";
import { and, count, eq, max, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDatabase } from "@/db/client";
import { channelCategories, channels, spaces } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { createChannelSchema } from "@/lib/space-validation";
import { normalizeVoiceUserLimit } from "@/lib/voice-channel-limit";
import { getChannelPermissions } from "@/lib/space-permissions";
import { hasPermission, Permission } from "@/lib/permissions";

export async function POST(request: Request, { params }: { params: Promise<{ spaceId: string }> }) {
  const [user, { spaceId }] = await Promise.all([getCurrentUser(), params]);
  if (!user) return NextResponse.json({ code: "UNAUTHENTICATED", message: "Требуется вход." }, { status: 401 });
  const parsed = createChannelSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ code: "INVALID_INPUT", message: "Проверьте данные канала.", issues: parsed.error.flatten() }, { status: 400 });

  const database = getDatabase();
  const [space] = await database.select({ ownerId: spaces.ownerId }).from(spaces).where(eq(spaces.id, spaceId)).limit(1);
  if (!space) return NextResponse.json({ code: "NOT_FOUND", message: "Пространство не найдено." }, { status: 404 });
  if (space.ownerId !== user.id) {
    const [probe] = await database.select({ id: channels.id }).from(channels).where(eq(channels.spaceId, spaceId)).limit(1);
    const permissionState = probe ? await getChannelPermissions(probe.id, user.id) : null;
    if (!permissionState || !hasPermission(permissionState.permissions, Permission.ManageChannels)) return NextResponse.json({ code: "FORBIDDEN", message: "Недостаточно прав для создания каналов." }, { status: 403 });
  }

  if (parsed.data.parentId) {
    const [category] = await database.select({ id: channelCategories.id }).from(channelCategories).where(and(eq(channelCategories.id, parsed.data.parentId), eq(channelCategories.spaceId, spaceId))).limit(1);
    if (!category) return NextResponse.json({ code: "INVALID_CATEGORY", message: "Категория не найдена." }, { status: 400 });
  }

  const [duplicate] = await database.select({ id: channels.id }).from(channels).where(and(eq(channels.spaceId, spaceId), eq(channels.name, parsed.data.name))).limit(1);
  if (duplicate) return NextResponse.json({ code: "CHANNEL_EXISTS", message: "Канал с таким названием уже существует." }, { status: 409 });
  const [positionResult] = await database.select({ value: max(channels.position) }).from(channels).where(eq(channels.spaceId, spaceId));
  const channel = { id: randomUUID(), spaceId, parentId: parsed.data.parentId, name: parsed.data.name, topic: parsed.data.topic || null, kind: parsed.data.kind, position: (positionResult?.value ?? -1) + 1, userLimit: null as number | null };
  await database.insert(channels).values(channel);
  return NextResponse.json({ channel }, { status: 201 });
}

export async function PUT(request: Request, { params }: { params: Promise<{ spaceId: string }> }) {
  const [user, { spaceId }] = await Promise.all([getCurrentUser(), params]);
  if (!user) return NextResponse.json({ code: "UNAUTHENTICATED", message: "Требуется вход." }, { status: 401 });
  const body = await request.json().catch(() => null);
  const channelId = typeof body?.channelId === "string" ? body.channelId : "";
  if (!channelId) return NextResponse.json({ code: "INVALID_INPUT", message: "Не указан канал." }, { status: 400 });

  let userLimit: number | null;
  try {
    userLimit = normalizeVoiceUserLimit(body?.userLimit);
  } catch {
    return NextResponse.json({ code: "INVALID_USER_LIMIT", message: "Лимит пользователей должен быть от 1 до 99 или без ограничений." }, { status: 400 });
  }

  const database = getDatabase();
  const [channel] = await database.select({ id: channels.id, kind: channels.kind, spaceId: channels.spaceId }).from(channels).where(and(eq(channels.id, channelId), eq(channels.spaceId, spaceId))).limit(1);
  if (!channel) return NextResponse.json({ code: "NOT_FOUND", message: "Канал не найден." }, { status: 404 });
  if (!["voice", "stage"].includes(channel.kind)) return NextResponse.json({ code: "INVALID_CHANNEL_KIND", message: "Лимит пользователей доступен только для голосовых каналов." }, { status: 400 });

  const permissionState = await getChannelPermissions(channelId, user.id);
  if (!hasPermission(permissionState.permissions, Permission.ManageChannels)) {
    return NextResponse.json({ code: "FORBIDDEN", message: "Недостаточно прав для изменения канала." }, { status: 403 });
  }

  const updated = await database.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${channelId}))`);
    const [row] = await tx.update(channels).set({ userLimit }).where(and(eq(channels.id, channelId), eq(channels.spaceId, spaceId))).returning({
      id: channels.id,
      userLimit: channels.userLimit,
    });
    return row;
  });
  return NextResponse.json({ channel: updated });
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
  if (space.ownerId !== user.id) { const permissionState = await getChannelPermissions(channelId, user.id); if (!hasPermission(permissionState.permissions, Permission.ManageChannels)) return NextResponse.json({ code: "FORBIDDEN", message: "Недостаточно прав для удаления каналов." }, { status: 403 }); }
  if (channel.kind === "text") {
    const [textCount] = await database.select({ value: count() }).from(channels).where(and(eq(channels.spaceId, spaceId), eq(channels.kind, "text")));
    if (textCount.value <= 1) return NextResponse.json({ code: "LAST_TEXT_CHANNEL", message: "Нельзя удалить последний текстовый канал." }, { status: 409 });
  }
  await database.delete(channels).where(eq(channels.id, channelId));
  return NextResponse.json({ success: true });
}
