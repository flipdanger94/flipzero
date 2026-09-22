import { and, desc, eq, gte, inArray, lte } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDatabase } from "@/db/client";
import { spaceAuditLogs, spaces, users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { getSpacePermissions } from "@/lib/space-permissions";
import { hasPermission, Permission } from "@/lib/permissions";

function parseDate(value: string | null, endOfDay = false) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  if (endOfDay && /^\d{4}-\d{2}-\d{2}$/.test(value)) date.setUTCHours(23, 59, 59, 999);
  return date;
}

export async function GET(request: Request, { params }: { params: Promise<{ spaceId: string }> }) {
  const [user, { spaceId }] = await Promise.all([getCurrentUser(), params]);
  if (!user) return NextResponse.json({ code: "UNAUTHENTICATED", message: "Требуется вход." }, { status: 401 });

  const database = getDatabase();
  const [space] = await database.select({ ownerId: spaces.ownerId }).from(spaces).where(eq(spaces.id, spaceId)).limit(1);
  if (!space) return NextResponse.json({ code: "NOT_FOUND", message: "Сервер не найден." }, { status: 404 });
  if (space.ownerId !== user.id) {
    const state = await getSpacePermissions(spaceId, user.id);
    if (!state.spaceId || !hasPermission(state.permissions, Permission.ManageSpace)) {
      return NextResponse.json({ code: "FORBIDDEN", message: "Недостаточно прав для просмотра журнала." }, { status: 403 });
    }
  }

  const url = new URL(request.url);
  const actorId = url.searchParams.get("actorId")?.trim() ?? "";
  const action = url.searchParams.get("action")?.trim() ?? "";
  const fromRaw = url.searchParams.get("from");
  const toRaw = url.searchParams.get("to");
  const from = parseDate(fromRaw);
  const to = parseDate(toRaw, true);
  if ((fromRaw && !from) || (toRaw && !to)) {
    return NextResponse.json({ code: "INVALID_DATE", message: "Некорректный период журнала." }, { status: 400 });
  }

  const conditions = [eq(spaceAuditLogs.spaceId, spaceId)];
  if (actorId) conditions.push(eq(spaceAuditLogs.actorId, actorId));
  if (action) conditions.push(eq(spaceAuditLogs.action, action.slice(0, 100)));
  if (from) conditions.push(gte(spaceAuditLogs.createdAt, from));
  if (to) conditions.push(lte(spaceAuditLogs.createdAt, to));

  const logs = await database.select().from(spaceAuditLogs).where(and(...conditions)).orderBy(desc(spaceAuditLogs.createdAt)).limit(200);
  const actorIds = [...new Set(logs.map((item) => item.actorId).filter((id): id is string => Boolean(id)))];
  const actors = actorIds.length
    ? await database.select({ id: users.id, displayName: users.displayName, username: users.username, avatarUrl: users.avatarUrl }).from(users).where(inArray(users.id, actorIds))
    : [];
  const actorMap = new Map(actors.map((actor) => [actor.id, actor]));

  return NextResponse.json({
    logs: logs.map((item) => ({ ...item, actor: item.actorId ? actorMap.get(item.actorId) ?? null : null })),
  });
}
