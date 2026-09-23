import { and, asc, eq, ilike, or } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDatabase } from "@/db/client";
import { members, roles, spaces, users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";

export async function GET(request: Request, { params }: { params: Promise<{ spaceId: string }> }) {
  const { spaceId } = await params;
  const viewer = await getCurrentUser();
  if (!viewer) return NextResponse.json({ code: "UNAUTHENTICATED", message: "Требуется вход." }, { status: 401 });

  const database = getDatabase();
  const [space] = await database.select({ ownerId: spaces.ownerId }).from(spaces).where(eq(spaces.id, spaceId)).limit(1);
  if (!space) return NextResponse.json({ code: "NOT_FOUND", message: "Пространство не найдено." }, { status: 404 });

  const [membership] = await database
    .select({ userId: members.userId })
    .from(members)
    .where(and(eq(members.spaceId, spaceId), eq(members.userId, viewer.id)))
    .limit(1);

  if (space.ownerId !== viewer.id && !membership) {
    return NextResponse.json({ code: "FORBIDDEN", message: "Вы не состоите в этом сообществе." }, { status: 403 });
  }

  const query = new URL(request.url).searchParams.get("q")?.trim().slice(0, 48) ?? "";
  const like = `%${query}%`;

  const memberFilter = query
    ? and(
        eq(members.spaceId, spaceId),
        or(
          ilike(users.username, like),
          ilike(users.displayName, like),
          ilike(members.nickname, like),
        )!,
      )
    : eq(members.spaceId, spaceId);

  const roleFilter = query
    ? and(eq(roles.spaceId, spaceId), ilike(roles.name, like))
    : eq(roles.spaceId, spaceId);

  const [memberRows, roleRows] = await Promise.all([
    database
      .select({
        id: users.id,
        username: users.username,
        displayName: users.displayName,
        nickname: members.nickname,
        avatarUrl: users.avatarUrl,
        lastSeenAt: users.lastSeenAt,
      })
      .from(members)
      .innerJoin(users, eq(users.id, members.userId))
      .where(memberFilter)
      .orderBy(asc(users.displayName), asc(users.username))
      .limit(8),
    database
      .select({ id: roles.id, name: roles.name, color: roles.color, position: roles.position })
      .from(roles)
      .where(roleFilter)
      .orderBy(asc(roles.position), asc(roles.name))
      .limit(6),
  ]);

  return NextResponse.json({
    items: [
      ...memberRows.map((member) => ({
        type: "user" as const,
        id: member.id,
        username: member.username,
        displayName: member.displayName,
        nickname: member.nickname,
        avatarUrl: member.avatarUrl,
        online: Boolean(member.lastSeenAt && member.lastSeenAt.getTime() > Date.now() - 90_000),
      })),
      ...roleRows.map((role) => ({
        type: "role" as const,
        id: role.id,
        name: role.name,
        color: role.color,
      })),
    ],
  });
}
