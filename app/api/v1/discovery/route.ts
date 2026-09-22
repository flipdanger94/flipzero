import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDatabase } from "@/db/client";
import { memberRoles, members, moderationCases, roles, spaces, userBlocks } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ code: "UNAUTHENTICATED", message: "Войдите, чтобы искать сообщества." }, { status: 401 });
  const query = new URL(request.url).searchParams.get("q")?.trim().slice(0, 80) ?? "";
  const database = getDatabase();
  const conditions = [eq(spaces.visibility, "public")];
  if (query) conditions.push(or(ilike(spaces.name, `%${query}%`), ilike(spaces.description, `%${query}%`))!);
  const [catalog, joinedRows, blockRows] = await Promise.all([
    database.select({ id: spaces.id, ownerId: spaces.ownerId, name: spaces.name, slug: spaces.slug, description: spaces.description, iconUrl: spaces.iconUrl, bannerUrl: spaces.bannerUrl, accentColor: spaces.accentColor, memberCount: sql<number>`count(${members.userId})::int`, createdAt: spaces.createdAt }).from(spaces).leftJoin(members, eq(members.spaceId, spaces.id)).where(and(...conditions)).groupBy(spaces.id).orderBy(desc(sql`lower(${spaces.name}) = 'flipzero hq'`), desc(sql`count(${members.userId})`), desc(spaces.createdAt)).limit(60),
    database.select({ spaceId: members.spaceId }).from(members).where(eq(members.userId, user.id)),
    database.select({ blockerId: userBlocks.blockerId, blockedId: userBlocks.blockedId }).from(userBlocks).where(or(eq(userBlocks.blockerId, user.id), eq(userBlocks.blockedId, user.id))),
  ]);
  const joinedIds = new Set(joinedRows.map((row) => row.spaceId));
  const blockedIds = new Set(blockRows.map((row) => row.blockerId === user.id ? row.blockedId : row.blockerId));
  const visibleCatalog = catalog.filter((space) => !blockedIds.has(space.ownerId));
  return NextResponse.json({ spaces: visibleCatalog.map(({ ownerId: _ownerId, ...space }) => ({ ...space, joined: joinedIds.has(space.id) })) });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ code: "UNAUTHENTICATED", message: "Войдите, чтобы вступить в сообщество." }, { status: 401 });
  const body = await request.json().catch(() => null) as { spaceId?: unknown } | null;
  if (typeof body?.spaceId !== "string" || !body.spaceId) return NextResponse.json({ code: "INVALID_INPUT", message: "Не выбрано сообщество." }, { status: 400 });
  const database = getDatabase();
  const [space] = await database.select({ id: spaces.id, ownerId: spaces.ownerId }).from(spaces).where(and(eq(spaces.id, body.spaceId), eq(spaces.visibility, "public"))).limit(1);
  if (!space) return NextResponse.json({ code: "NOT_FOUND", message: "Открытое сообщество не найдено." }, { status: 404 });
  const [ownerBlock] = await database.select({ blockerId: userBlocks.blockerId }).from(userBlocks).where(or(
    and(eq(userBlocks.blockerId, user.id), eq(userBlocks.blockedId, space.ownerId)),
    and(eq(userBlocks.blockerId, space.ownerId), eq(userBlocks.blockedId, user.id)),
  )).limit(1);
  if (ownerBlock) return NextResponse.json({ code: "BLOCKED", message: "Это сообщество недоступно из-за настроек блокировки." }, { status: 403 });
  const [latestBanAction] = await database.select({ action: moderationCases.action }).from(moderationCases).where(and(eq(moderationCases.spaceId, space.id), eq(moderationCases.targetUserId, user.id), or(eq(moderationCases.action, "ban"), eq(moderationCases.action, "unban")))).orderBy(desc(moderationCases.createdAt)).limit(1);
  if (latestBanAction?.action === "ban") return NextResponse.json({ code: "BANNED", message: "Вы заблокированы в этом сообществе." }, { status: 403 });
  const [memberRole] = await database.select({ id: roles.id }).from(roles).where(and(eq(roles.spaceId, space.id), eq(roles.name, "Участник"))).limit(1);
  const inserted = await database.transaction(async (tx) => {
    const created = await tx.insert(members).values({ userId: user.id, spaceId: space.id }).onConflictDoNothing().returning({ userId: members.userId });
    if (memberRole) await tx.insert(memberRoles).values({ userId: user.id, spaceId: space.id, roleId: memberRole.id }).onConflictDoNothing();
    return created.length > 0;
  });
  return NextResponse.json({ spaceId: space.id, joined: inserted });
}
