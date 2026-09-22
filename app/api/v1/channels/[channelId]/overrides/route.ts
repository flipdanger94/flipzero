import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDatabase } from "@/db/client";
import { channelOverrides, channels, members, roles, spaces } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { getSpacePermissions } from "@/lib/space-permissions";
import { hasPermission, Permission } from "@/lib/permissions";

const channelPermissionMask = Permission.ViewChannels | Permission.SendMessages | Permission.ManageMessages | Permission.ManageChannels | Permission.ConnectVoice | Permission.SpeakVoice | Permission.Stream;

async function requireManager(channelId: string) {
  const user = await getCurrentUser();
  if (!user) return { error: NextResponse.json({ code: "UNAUTHENTICATED", message: "Требуется вход." }, { status: 401 }) };
  const db = getDatabase();
  const [channel] = await db.select({ id: channels.id, spaceId: channels.spaceId, ownerId: spaces.ownerId })
    .from(channels).innerJoin(spaces, eq(spaces.id, channels.spaceId)).where(eq(channels.id, channelId)).limit(1);
  if (!channel) return { error: NextResponse.json({ code: "NOT_FOUND", message: "Канал не найден." }, { status: 404 }) };
  const state = await getSpacePermissions(channel.spaceId, user.id);
  if (channel.ownerId !== user.id && !hasPermission(state.permissions, Permission.ManageChannels)) {
    return { error: NextResponse.json({ code: "FORBIDDEN", message: "Недостаточно прав для настройки канала." }, { status: 403 }) };
  }
  return { db, channel, user, owner: channel.ownerId === user.id };
}

export async function GET(_: Request, { params }: { params: Promise<{ channelId: string }> }) {
  const { channelId } = await params;
  const access = await requireManager(channelId); if ("error" in access) return access.error;
  const overrides = await access.db.select().from(channelOverrides).where(eq(channelOverrides.channelId, channelId));
  return NextResponse.json({ overrides });
}

export async function PUT(request: Request, { params }: { params: Promise<{ channelId: string }> }) {
  const { channelId } = await params;
  const access = await requireManager(channelId); if ("error" in access) return access.error;
  const body = await request.json().catch(() => null);
  const targetId = String(body?.targetId ?? "");
  const targetType = String(body?.targetType ?? "");
  const allow = Number(body?.allow ?? 0), deny = Number(body?.deny ?? 0);
  if (!targetId || !["role", "member"].includes(targetType) || !Number.isSafeInteger(allow) || !Number.isSafeInteger(deny) || allow < 0 || deny < 0 || (allow & ~channelPermissionMask) !== 0 || (deny & ~channelPermissionMask) !== 0 || (allow & deny) !== 0) {
    return NextResponse.json({ code: "INVALID_OVERRIDE", message: "Некорректные права канала." }, { status: 400 });
  }
  if (!access.owner && ((allow | deny) & Permission.Administrator) !== 0) return NextResponse.json({ code: "ROLE_ESCALATION", message: "Только владелец может изменять право администратора." }, { status: 403 });
  if (targetType === "role") {
    const [target] = await access.db.select({ id: roles.id }).from(roles).where(and(eq(roles.id, targetId), eq(roles.spaceId, access.channel.spaceId))).limit(1);
    if (!target) return NextResponse.json({ code: "INVALID_TARGET", message: "Роль не принадлежит этому серверу." }, { status: 400 });
  } else {
    const [target] = await access.db.select({ userId: members.userId }).from(members).where(and(eq(members.userId, targetId), eq(members.spaceId, access.channel.spaceId))).limit(1);
    if (!target) return NextResponse.json({ code: "INVALID_TARGET", message: "Пользователь не состоит в этом сервере." }, { status: 400 });
  }
  await access.db.insert(channelOverrides).values({ channelId, targetId, targetType, allow, deny })
    .onConflictDoUpdate({ target: [channelOverrides.channelId, channelOverrides.targetId], set: { targetType, allow, deny } });
  return NextResponse.json({ targetId, targetType, allow, deny });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ channelId: string }> }) {
  const { channelId } = await params;
  const access = await requireManager(channelId); if ("error" in access) return access.error;
  const targetId = new URL(request.url).searchParams.get("targetId") ?? "";
  if (!targetId) return NextResponse.json({ code: "INVALID_INPUT", message: "Не указана роль или участник." }, { status: 400 });
  await access.db.delete(channelOverrides).where(and(eq(channelOverrides.channelId, channelId), eq(channelOverrides.targetId, targetId)));
  return NextResponse.json({ ok: true });
}
