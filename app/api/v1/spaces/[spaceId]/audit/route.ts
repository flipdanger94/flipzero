import { desc, eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDatabase } from "@/db/client";
import { spaceAuditLogs, spaces, users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { getSpacePermissions } from "@/lib/space-permissions";
import { hasPermission, Permission } from "@/lib/permissions";

export async function GET(_: Request, { params }: { params: Promise<{ spaceId: string }> }) {
  const [user, { spaceId }] = await Promise.all([getCurrentUser(), params]);
  if (!user) return NextResponse.json({ code: "UNAUTHENTICATED", message: "Требуется вход." }, { status: 401 });

  const database = getDatabase();
  const [space] = await database.select({ ownerId: spaces.ownerId }).from(spaces).where(eq(spaces.id, spaceId)).limit(1);
  if (!space) return NextResponse.json({ code: "NOT_FOUND", message: "Сервер не найден." }, { status: 404 });
  if (space.ownerId !== user.id) {
    const state = await getSpacePermissions(spaceId, user.id);
    if (!state.spaceId || !hasPermission(state.permissions, Permission.ManageSpace)) return NextResponse.json({ code: "FORBIDDEN", message: "Недостаточно прав для просмотра журнала." }, { status: 403 });
  }

  const logs = await database.select().from(spaceAuditLogs).where(eq(spaceAuditLogs.spaceId, spaceId)).orderBy(desc(spaceAuditLogs.createdAt)).limit(200);
  const actorIds = [...new Set(logs.map((item) => item.actorId).filter((id): id is string => Boolean(id)))];
  const actors = actorIds.length ? await database.select({ id: users.id, displayName: users.displayName, username: users.username, avatarUrl: users.avatarUrl }).from(users).where(inArray(users.id, actorIds)) : [];
  const actorMap = new Map(actors.map((actor) => [actor.id, actor]));

  return NextResponse.json({
    logs: logs.map((item) => ({ ...item, actor: item.actorId ? actorMap.get(item.actorId) ?? null : null })),
  });
}
