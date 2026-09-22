import { randomUUID } from "node:crypto";
import { asc, eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDatabase } from "@/db/client";
import { channelCategories, channels, memberRoles, members, roles, spacePlacements, spaces } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { DEFAULT_MEMBER_PERMISSIONS, hasPermission, Permission } from "@/lib/permissions";
import { getSpaceChannelPermissions } from "@/lib/space-permissions";
import { createSpaceSchema } from "@/lib/space-validation";

function makeSlug(name: string) {
  const base = name.toLocaleLowerCase("ru").normalize("NFKD").replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "").slice(0, 36) || "space";
  return `${base}-${randomUUID().slice(0, 6)}`;
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ code: "UNAUTHENTICATED", message: "Требуется вход." }, { status: 401 });

  const database = getDatabase();
  const joinedSpaces = await database.select({
    id: spaces.id,
    name: spaces.name,
    slug: spaces.slug,
    description: spaces.description,
    iconUrl: spaces.iconUrl,
    bannerUrl: spaces.bannerUrl,
    visibility: spaces.visibility,
    accentColor: spaces.accentColor,
    ownerId: spaces.ownerId,
  }).from(members).innerJoin(spaces, eq(members.spaceId, spaces.id)).where(eq(members.userId, user.id)).orderBy(asc(members.joinedAt));

  const spaceIds = joinedSpaces.map((space) => space.id);
  const spaceChannels = spaceIds.length ? await database.select({
    id: channels.id,
    spaceId: channels.spaceId,
    name: channels.name,
    topic: channels.topic,
    kind: channels.kind,
    position: channels.position,
    parentId: channels.parentId,
  }).from(channels).where(inArray(channels.spaceId, spaceIds)).orderBy(asc(channels.position)) : [];
  const categories = spaceIds.length ? await database.select().from(channelCategories).where(inArray(channelCategories.spaceId, spaceIds)).orderBy(asc(channelCategories.position)) : [];
  const assignments = spaceIds.length ? await database.select({ spaceId: memberRoles.spaceId, permissions: roles.permissions }).from(memberRoles).innerJoin(roles, eq(roles.id, memberRoles.roleId)).where(eq(memberRoles.userId, user.id)) : [];
  const channelPermissionEntries = await Promise.all(joinedSpaces.map(async (space) => {
    const ids = spaceChannels.filter((channel) => channel.spaceId === space.id).map((channel) => channel.id);
    return [space.id, await getSpaceChannelPermissions(space.id, user.id, ids)] as const;
  }));
  const channelPermissions = new Map(channelPermissionEntries);

  return NextResponse.json({ spaces: joinedSpaces.map((space) => {
    const permissions = space.ownerId === user.id ? Permission.Administrator : assignments.filter((item) => item.spaceId === space.id).reduce((value, item) => value | Number(item.permissions), 0);
    const permissionMap = channelPermissions.get(space.id) ?? new Map<string, number>();
    const visibleChannels = spaceChannels.filter((channel) => channel.spaceId === space.id && hasPermission(permissionMap.get(channel.id) ?? 0, Permission.ViewChannels));
    const visibleParentIds = new Set(visibleChannels.map((channel) => channel.parentId).filter((parentId): parentId is string => Boolean(parentId)));
    const visibleCategories = categories.filter((category) => category.spaceId === space.id && (hasPermission(permissions, Permission.ManageChannels) || visibleParentIds.has(category.id)));
    return {
      ...space,
      permissions,
      categories: visibleCategories,
      channels: visibleChannels,
    };
  }) });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ code: "UNAUTHENTICATED", message: "Требуется вход." }, { status: 401 });
  const parsed = createSpaceSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ code: "INVALID_INPUT", message: "Проверьте данные пространства.", issues: parsed.error.flatten() }, { status: 400 });

  const database = getDatabase();
  const spaceId = randomUUID();
  const ownerRoleId = randomUUID();
  const memberRoleId = randomUUID();
  const slug = makeSlug(parsed.data.name);
  const textCategoryId = randomUUID();
  const voiceCategoryId = randomUUID();
  const defaultCategories = [{ id: textCategoryId, spaceId, name: "Общение", position: 0 }, { id: voiceCategoryId, spaceId, name: "Голосовые", position: 1 }];
  const defaultChannels = [
    { id: randomUUID(), spaceId, parentId: textCategoryId, name: "добро-пожаловать", topic: "Начните знакомство с пространством", kind: "text" as const, position: 0 },
    { id: randomUUID(), spaceId, parentId: textCategoryId, name: "общий-чат", topic: "Главный канал сообщества", kind: "text" as const, position: 1 },
    { id: randomUUID(), spaceId, parentId: voiceCategoryId, name: "Лаунж", topic: "Голосовая комната", kind: "voice" as const, position: 2 },
  ];

  await database.transaction(async (tx) => {
    await tx.insert(spaces).values({ id: spaceId, ownerId: user.id, name: parsed.data.name, slug, description: parsed.data.description || null, visibility: parsed.data.visibility, accentColor: parsed.data.accentColor });
    await tx.insert(spacePlacements).values({ spaceId, shardId: "primary", homeRegion: process.env.VERCEL_REGION ?? "global" });
    await tx.insert(roles).values([
      { id: ownerRoleId, spaceId, name: "Владелец", color: parsed.data.accentColor, position: 100, permissions: Permission.Administrator, isManaged: true },
      { id: memberRoleId, spaceId, name: "Участник", color: "#918d9d", position: 0, permissions: DEFAULT_MEMBER_PERMISSIONS, isManaged: true },
    ]);
    await tx.insert(members).values({ userId: user.id, spaceId });
    await tx.insert(memberRoles).values([{ userId: user.id, spaceId, roleId: ownerRoleId }, { userId: user.id, spaceId, roleId: memberRoleId }]);
    await tx.insert(channelCategories).values(defaultCategories);
    await tx.insert(channels).values(defaultChannels);
  });

  return NextResponse.json({ space: { id: spaceId, ownerId: user.id, name: parsed.data.name, slug, description: parsed.data.description || null, visibility: parsed.data.visibility, accentColor: parsed.data.accentColor, iconUrl: null, bannerUrl: null, categories: defaultCategories, channels: defaultChannels } }, { status: 201 });
}
