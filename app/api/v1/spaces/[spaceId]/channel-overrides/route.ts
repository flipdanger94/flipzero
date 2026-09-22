import { and, asc, eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getDatabase } from "@/db/client";
import { channelOverrides, channels, roles, spaces } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { getSpacePermissions } from "@/lib/space-permissions";
import { CHANNEL_PERMISSION_MASK, hasPermission, Permission } from "@/lib/permissions";

const overrideSchema = z.object({
  channelId: z.string().min(1),
  overrides: z.array(z.object({
    roleId: z.string().min(1),
    allow: z.number().int().min(0).max(2 ** 31 - 1),
    deny: z.number().int().min(0).max(2 ** 31 - 1),
  }).refine((item) => (item.allow & item.deny) === 0)).max(100),
});

async function requireOwner(spaceId: string, channelId: string) {
  const user = await getCurrentUser();
  if (!user) return { error: NextResponse.json({ code: "UNAUTHENTICATED", message: "Требуется вход." }, { status: 401 }) };
  const database = getDatabase();
  const [space] = await database.select({ ownerId: spaces.ownerId }).from(spaces).where(eq(spaces.id, spaceId)).limit(1);
  if (!space) return { error: NextResponse.json({ code: "NOT_FOUND", message: "Пространство не найдено." }, { status: 404 }) };
  if (space.ownerId !== user.id) {
    const state = await getSpacePermissions(spaceId, user.id);
    if (!state.spaceId || !hasPermission(state.permissions, Permission.ManageChannels)) return { error: NextResponse.json({ code: "FORBIDDEN", message: "Недостаточно прав для настройки доступа канала." }, { status: 403 }) };
  }
  const [channel] = await database.select({ id: channels.id, name: channels.name }).from(channels).where(and(eq(channels.id, channelId), eq(channels.spaceId, spaceId))).limit(1);
  if (!channel) return { error: NextResponse.json({ code: "NOT_FOUND", message: "Канал не найден." }, { status: 404 }) };
  return { database, channel, owner: space.ownerId === user.id };
}

export async function GET(request: Request, { params }: { params: Promise<{ spaceId: string }> }) {
  const { spaceId } = await params;
  const channelId = new URL(request.url).searchParams.get("channelId");
  if (!channelId) return NextResponse.json({ code: "INVALID_INPUT", message: "Не указан канал." }, { status: 400 });
  const access = await requireOwner(spaceId, channelId);
  if ("error" in access) return access.error;
  const [roleItems, overrideItems] = await Promise.all([
    access.database.select().from(roles).where(eq(roles.spaceId, spaceId)).orderBy(asc(roles.position)),
    access.database.select().from(channelOverrides).where(and(eq(channelOverrides.channelId, channelId), eq(channelOverrides.targetType, "role"))),
  ]);
  return NextResponse.json({ channel: access.channel, roles: roleItems, overrides: overrideItems.map((item) => ({ roleId: item.targetId, allow: item.allow, deny: item.deny })) });
}

export async function PUT(request: Request, { params }: { params: Promise<{ spaceId: string }> }) {
  const { spaceId } = await params;
  const parsed = overrideSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ code: "INVALID_INPUT", message: "Проверьте настройки доступа." }, { status: 400 });
  const access = await requireOwner(spaceId, parsed.data.channelId);
  if ("error" in access) return access.error;
  if (parsed.data.overrides.some((item) => (item.allow & ~CHANNEL_PERMISSION_MASK) !== 0 || (item.deny & ~CHANNEL_PERMISSION_MASK) !== 0)) return NextResponse.json({ code: "INVALID_OVERRIDE", message: "Переопределение содержит права, которые нельзя задавать на уровне канала." }, { status: 400 });
  const roleIds = [...new Set(parsed.data.overrides.map((item) => item.roleId))];
  if (roleIds.length !== parsed.data.overrides.length) return NextResponse.json({ code: "DUPLICATE_ROLE", message: "Роль указана несколько раз." }, { status: 400 });
  if (roleIds.length) {
    const validRoles = await access.database.select({ id: roles.id }).from(roles).where(and(eq(roles.spaceId, spaceId), inArray(roles.id, roleIds)));
    if (validRoles.length !== roleIds.length) return NextResponse.json({ code: "INVALID_ROLE", message: "Одна из ролей не принадлежит этому пространству." }, { status: 400 });
  }
  const effective = parsed.data.overrides.filter((item) => item.allow !== 0 || item.deny !== 0);
  await access.database.transaction(async (tx) => {
    await tx.delete(channelOverrides).where(and(eq(channelOverrides.channelId, parsed.data.channelId), eq(channelOverrides.targetType, "role")));
    if (effective.length) await tx.insert(channelOverrides).values(effective.map((item) => ({ channelId: parsed.data.channelId, targetId: item.roleId, targetType: "role", allow: item.allow, deny: item.deny })));
  });
  return NextResponse.json({ overrides: effective });
}
