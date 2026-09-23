import { and, desc, eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getDatabase } from "@/db/client";
import { channelOverrides, channels, members, roles, spaces, users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { Permission } from "@/lib/permissions";

const allowedMask = Object.values(Permission).reduce((mask, value) => mask | value, 0);
const overrideSchema = z.object({
  channelId: z.string().min(1),
  overrides: z.array(z.object({
    targetId: z.string().min(1),
    targetType: z.enum(["role", "member"]),
    allow: z.number().int().min(0).max(2 ** 31 - 1),
    deny: z.number().int().min(0).max(2 ** 31 - 1),
  }).refine((item) => (item.allow & item.deny) === 0 && (item.allow & ~allowedMask) === 0 && (item.deny & ~allowedMask) === 0)).max(200),
});

async function requireOwner(spaceId: string, channelId: string) {
  const user = await getCurrentUser();
  if (!user) return { error: NextResponse.json({ code: "UNAUTHENTICATED", message: "Требуется вход." }, { status: 401 }) };
  const database = getDatabase();
  const [space] = await database.select({ ownerId: spaces.ownerId }).from(spaces).where(eq(spaces.id, spaceId)).limit(1);
  if (!space) return { error: NextResponse.json({ code: "NOT_FOUND", message: "Пространство не найдено." }, { status: 404 }) };
  if (space.ownerId !== user.id) return { error: NextResponse.json({ code: "FORBIDDEN", message: "Настраивать доступ может только владелец." }, { status: 403 }) };
  const [channel] = await database.select({ id: channels.id, name: channels.name, kind: channels.kind }).from(channels).where(and(eq(channels.id, channelId), eq(channels.spaceId, spaceId))).limit(1);
  if (!channel) return { error: NextResponse.json({ code: "NOT_FOUND", message: "Канал не найден." }, { status: 404 }) };
  return { database, channel };
}

export async function GET(request: Request, { params }: { params: Promise<{ spaceId: string }> }) {
  const { spaceId } = await params;
  const channelId = new URL(request.url).searchParams.get("channelId");
  if (!channelId) return NextResponse.json({ code: "INVALID_INPUT", message: "Не указан канал." }, { status: 400 });
  const access = await requireOwner(spaceId, channelId); if ("error" in access) return access.error;
  const [roleItems, memberItems, overrideItems] = await Promise.all([
    access.database.select().from(roles).where(eq(roles.spaceId, spaceId)).orderBy(desc(roles.position)),
    access.database.select({ id: users.id, username: users.username, displayName: users.displayName, avatarUrl: users.avatarUrl }).from(members).innerJoin(users, eq(users.id, members.userId)).where(eq(members.spaceId, spaceId)).limit(150),
    access.database.select().from(channelOverrides).where(eq(channelOverrides.channelId, channelId)),
  ]);
  return NextResponse.json({
    channel: access.channel,
    roles: roleItems,
    members: memberItems,
    overrides: overrideItems.map((item) => ({ targetId: item.targetId, targetType: item.targetType, allow: Number(item.allow), deny: Number(item.deny) })),
  });
}

export async function PUT(request: Request, { params }: { params: Promise<{ spaceId: string }> }) {
  const { spaceId } = await params;
  const parsed = overrideSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ code: "INVALID_INPUT", message: "Проверьте настройки доступа." }, { status: 400 });
  const access = await requireOwner(spaceId, parsed.data.channelId); if ("error" in access) return access.error;
  const keys = parsed.data.overrides.map((item) => `${item.targetType}:${item.targetId}`);
  if (new Set(keys).size !== keys.length) return NextResponse.json({ code: "DUPLICATE_TARGET", message: "Роль или участник указаны несколько раз." }, { status: 400 });
  const roleIds = parsed.data.overrides.filter((item) => item.targetType === "role").map((item) => item.targetId);
  const memberIds = parsed.data.overrides.filter((item) => item.targetType === "member").map((item) => item.targetId);
  if (roleIds.length) {
    const valid = await access.database.select({ id: roles.id }).from(roles).where(and(eq(roles.spaceId, spaceId), inArray(roles.id, roleIds)));
    if (valid.length !== roleIds.length) return NextResponse.json({ code: "INVALID_ROLE", message: "Одна из ролей не принадлежит этому пространству." }, { status: 400 });
  }
  if (memberIds.length) {
    const valid = await access.database.select({ id: members.userId }).from(members).where(and(eq(members.spaceId, spaceId), inArray(members.userId, memberIds)));
    if (valid.length !== memberIds.length) return NextResponse.json({ code: "INVALID_MEMBER", message: "Один из участников не принадлежит этому пространству." }, { status: 400 });
  }
  const effective = parsed.data.overrides.filter((item) => item.allow !== 0 || item.deny !== 0);
  await access.database.transaction(async (tx) => {
    await tx.delete(channelOverrides).where(eq(channelOverrides.channelId, parsed.data.channelId));
    if (effective.length) await tx.insert(channelOverrides).values(effective.map((item) => ({ channelId: parsed.data.channelId, targetId: item.targetId, targetType: item.targetType, allow: item.allow, deny: item.deny })));
  });
  return NextResponse.json({ overrides: effective });
}
