import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getDatabase } from "@/db/client";
import { memberRoles, members, moderationCases, spaces, users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";

const actionSchema = z.object({
  targetUserId: z.string().min(1),
  action: z.enum(["warn", "timeout", "kick", "ban", "unban"]),
  reason: z.string().trim().max(500).optional().default(""),
  durationMinutes: z.number().int().min(1).max(10080).optional(),
});

async function requireOwner(spaceId: string) {
  const user = await getCurrentUser();
  if (!user) return { error: NextResponse.json({ code: "UNAUTHENTICATED", message: "Требуется вход." }, { status: 401 }) };
  const database = getDatabase();
  const [space] = await database.select({ ownerId: spaces.ownerId }).from(spaces).where(eq(spaces.id, spaceId)).limit(1);
  if (!space) return { error: NextResponse.json({ code: "NOT_FOUND", message: "Пространство не найдено." }, { status: 404 }) };
  if (space.ownerId !== user.id) return { error: NextResponse.json({ code: "FORBIDDEN", message: "Модерация доступна только владельцу." }, { status: 403 }) };
  return { database, user, space };
}

export async function GET(_: Request, { params }: { params: Promise<{ spaceId: string }> }) {
  const { spaceId } = await params;
  const access = await requireOwner(spaceId);
  if ("error" in access) return access.error;
  const [spaceMembers, cases] = await Promise.all([
    access.database.select({ userId: members.userId, displayName: users.displayName, username: users.username }).from(members).innerJoin(users, eq(members.userId, users.id)).where(eq(members.spaceId, spaceId)).orderBy(asc(users.displayName)),
    access.database.select().from(moderationCases).where(eq(moderationCases.spaceId, spaceId)).orderBy(desc(moderationCases.createdAt)).limit(100),
  ]);
  const userIds = [...new Set(cases.flatMap((item) => [item.targetUserId, item.moderatorId]))];
  const caseUsers = userIds.length ? await access.database.select({ id: users.id, displayName: users.displayName, username: users.username }).from(users).where(inArray(users.id, userIds)) : [];
  const userMap = new Map(caseUsers.map((item) => [item.id, item]));
  return NextResponse.json({ ownerId: access.space.ownerId, members: spaceMembers, cases: cases.map((item) => ({ ...item, target: userMap.get(item.targetUserId) ?? null, moderator: userMap.get(item.moderatorId) ?? null })) });
}

export async function POST(request: Request, { params }: { params: Promise<{ spaceId: string }> }) {
  const { spaceId } = await params;
  const access = await requireOwner(spaceId);
  if ("error" in access) return access.error;
  const parsed = actionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ code: "INVALID_INPUT", message: "Проверьте действие, причину и длительность." }, { status: 400 });
  if (parsed.data.targetUserId === access.space.ownerId) return NextResponse.json({ code: "OWNER_PROTECTED", message: "Владельца пространства нельзя модерировать." }, { status: 409 });
  const [target] = await access.database.select({ id: users.id }).from(users).where(eq(users.id, parsed.data.targetUserId)).limit(1);
  if (!target) return NextResponse.json({ code: "NOT_FOUND", message: "Пользователь не найден." }, { status: 404 });
  if (parsed.data.action === "unban") {
    const [latest] = await access.database.select({ action: moderationCases.action }).from(moderationCases).where(and(eq(moderationCases.spaceId, spaceId), eq(moderationCases.targetUserId, target.id), inArray(moderationCases.action, ["ban", "unban"]))).orderBy(desc(moderationCases.createdAt)).limit(1);
    if (latest?.action !== "ban") return NextResponse.json({ code: "NOT_BANNED", message: "Пользователь не заблокирован." }, { status: 409 });
  } else {
    const [membership] = await access.database.select({ userId: members.userId }).from(members).where(and(eq(members.spaceId, spaceId), eq(members.userId, target.id))).limit(1);
    if (!membership) return NextResponse.json({ code: "NOT_MEMBER", message: "Пользователь не является участником пространства." }, { status: 409 });
  }
  const expiresAt = parsed.data.action === "timeout" ? new Date(Date.now() + (parsed.data.durationMinutes ?? 60) * 60000) : null;
  const moderationCase = { id: randomUUID(), spaceId, targetUserId: target.id, moderatorId: access.user.id, action: parsed.data.action, reason: parsed.data.reason || null, metadata: parsed.data.action === "timeout" ? { durationMinutes: parsed.data.durationMinutes ?? 60 } : {}, expiresAt };
  await access.database.transaction(async (tx) => {
    await tx.insert(moderationCases).values(moderationCase);
    if (parsed.data.action === "kick" || parsed.data.action === "ban") {
      await tx.delete(memberRoles).where(and(eq(memberRoles.userId, target.id), eq(memberRoles.spaceId, spaceId)));
      await tx.delete(members).where(and(eq(members.userId, target.id), eq(members.spaceId, spaceId)));
    }
  });
  return NextResponse.json({ case: moderationCase }, { status: 201 });
}
