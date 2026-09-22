import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getDatabase } from "@/db/client";
import { channels, memberRoles, members, messages, moderationCases, moderationFlags, roles, spaces, users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission, Permission } from "@/lib/permissions";

const actionSchema = z.object({
  targetUserId: z.string().min(1),
  action: z.enum(["warn", "timeout", "kick", "ban", "unban"]),
  reason: z.string().trim().max(500).optional().default(""),
  durationMinutes: z.number().int().min(1).max(10080).optional(),
});

const reviewSchema = z.object({
  flagId: z.string().min(1),
  action: z.enum(["dismiss", "remove"]),
});

async function requireModerator(spaceId: string) {
  const user = await getCurrentUser();
  if (!user) return { error: NextResponse.json({ code: "UNAUTHENTICATED", message: "Требуется вход." }, { status: 401 }) };
  const database = getDatabase();
  const [space] = await database.select({ ownerId: spaces.ownerId }).from(spaces).where(eq(spaces.id, spaceId)).limit(1);
  if (!space) return { error: NextResponse.json({ code: "NOT_FOUND", message: "Пространство не найдено." }, { status: 404 }) };
  if (space.ownerId === user.id) return { database, user, space, owner: true, permissions: Permission.Administrator, topPosition: Number.MAX_SAFE_INTEGER };

  const assigned = await database.select({ permissions: roles.permissions, position: roles.position }).from(memberRoles)
    .innerJoin(roles, eq(roles.id, memberRoles.roleId))
    .where(and(eq(memberRoles.spaceId, spaceId), eq(memberRoles.userId, user.id)));
  const permissions = assigned.reduce((value, role) => value | Number(role.permissions), 0);
  const canOpenModeration =
    hasPermission(permissions, Permission.ModerateMembers) ||
    hasPermission(permissions, Permission.KickMembers) ||
    hasPermission(permissions, Permission.BanMembers);
  if (!canOpenModeration) return { error: NextResponse.json({ code: "FORBIDDEN", message: "Недостаточно прав для модерации." }, { status: 403 }) };
  return { database, user, space, owner: false, permissions, topPosition: Math.max(0, ...assigned.map((role) => role.position)) };
}

function actionPermission(action: "warn" | "timeout" | "kick" | "ban" | "unban") {
  if (action === "kick") return Permission.KickMembers;
  if (action === "ban" || action === "unban") return Permission.BanMembers;
  return Permission.ModerateMembers;
}

export async function GET(_: Request, { params }: { params: Promise<{ spaceId: string }> }) {
  const { spaceId } = await params;
  const access = await requireModerator(spaceId);
  if ("error" in access) return access.error;
  const canReviewFlags = access.owner || hasPermission(access.permissions, Permission.ModerateMembers);
  const canWarnTimeout = access.owner || hasPermission(access.permissions, Permission.ModerateMembers);
  const canKick = access.owner || hasPermission(access.permissions, Permission.KickMembers);
  const canBan = access.owner || hasPermission(access.permissions, Permission.BanMembers);
  const canModerateMembers = canWarnTimeout || canKick || canBan;
  const [spaceMembers, cases, flags] = await Promise.all([
    canModerateMembers ? access.database.select({ userId: members.userId, displayName: users.displayName, username: users.username }).from(members).innerJoin(users, eq(members.userId, users.id)).where(eq(members.spaceId, spaceId)).orderBy(asc(users.displayName)) : Promise.resolve([]),
    canModerateMembers ? access.database.select().from(moderationCases).where(eq(moderationCases.spaceId, spaceId)).orderBy(desc(moderationCases.createdAt)).limit(100) : Promise.resolve([]),
    canReviewFlags ? access.database.select({ id: moderationFlags.id, messageId: moderationFlags.messageId, authorId: moderationFlags.authorId, category: moderationFlags.category, severity: moderationFlags.severity, confidence: moderationFlags.confidence, summary: moderationFlags.summary, evidence: moderationFlags.evidence, status: moderationFlags.status, autoHidden: moderationFlags.autoHidden, createdAt: moderationFlags.createdAt, content: messages.content, channelId: channels.id, channelName: channels.name, displayName: users.displayName, username: users.username }).from(moderationFlags).innerJoin(messages, eq(moderationFlags.messageId, messages.id)).innerJoin(channels, eq(moderationFlags.channelId, channels.id)).innerJoin(users, eq(moderationFlags.authorId, users.id)).where(eq(moderationFlags.spaceId, spaceId)).orderBy(desc(moderationFlags.createdAt)).limit(100) : Promise.resolve([]),
  ]);
  const userIds = [...new Set(cases.flatMap((item) => [item.targetUserId, item.moderatorId]))];
  const caseUsers = userIds.length ? await access.database.select({ id: users.id, displayName: users.displayName, username: users.username }).from(users).where(inArray(users.id, userIds)) : [];
  const userMap = new Map(caseUsers.map((item) => [item.id, item]));
  return NextResponse.json({ ownerId: access.space.ownerId, capabilities: { reviewFlags: canReviewFlags, warn: canWarnTimeout, timeout: canWarnTimeout, kick: canKick, ban: canBan, unban: canBan }, members: spaceMembers, flags, cases: cases.map((item) => ({ ...item, target: userMap.get(item.targetUserId) ?? null, moderator: userMap.get(item.moderatorId) ?? null })) });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ spaceId: string }> }) {
  const { spaceId } = await params;
  const access = await requireModerator(spaceId);
  if ("error" in access) return access.error;
  if (!access.owner && !hasPermission(access.permissions, Permission.ModerateMembers)) return NextResponse.json({ code: "FORBIDDEN", message: "Недостаточно прав для проверки сообщений." }, { status: 403 });
  const parsed = reviewSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ code: "INVALID_INPUT", message: "Решение по флагу не распознано." }, { status: 400 });
  const [flag] = await access.database.select().from(moderationFlags).where(and(eq(moderationFlags.id, parsed.data.flagId), eq(moderationFlags.spaceId, spaceId))).limit(1);
  if (!flag) return NextResponse.json({ code: "NOT_FOUND", message: "Флаг модерации не найден." }, { status: 404 });
  if (flag.status !== "pending") return NextResponse.json({ code: "ALREADY_REVIEWED", message: "Этот флаг уже обработан." }, { status: 409 });
  const reviewedAt = new Date();
  await access.database.transaction(async (tx) => {
    await tx.update(moderationFlags).set({ status: parsed.data.action === "remove" ? "actioned" : "dismissed", reviewedById: access.user.id, reviewedAt }).where(eq(moderationFlags.id, flag.id));
    if (parsed.data.action === "remove") await tx.update(messages).set({ deletedAt: reviewedAt }).where(eq(messages.id, flag.messageId));
    if (parsed.data.action === "dismiss" && flag.autoHidden) await tx.update(messages).set({ deletedAt: null }).where(eq(messages.id, flag.messageId));
  });
  return NextResponse.json({ status: parsed.data.action === "remove" ? "actioned" : "dismissed", reviewedAt });
}

export async function POST(request: Request, { params }: { params: Promise<{ spaceId: string }> }) {
  const { spaceId } = await params;
  const access = await requireModerator(spaceId);
  if ("error" in access) return access.error;
  const parsed = actionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ code: "INVALID_INPUT", message: "Проверьте действие, причину и длительность." }, { status: 400 });
  if (!access.owner && !hasPermission(access.permissions, actionPermission(parsed.data.action))) return NextResponse.json({ code: "FORBIDDEN", message: "Недостаточно прав для этого действия." }, { status: 403 });
  if (parsed.data.targetUserId === access.user.id) return NextResponse.json({ code: "SELF_MODERATION", message: "Нельзя применить это действие к самому себе." }, { status: 409 });
  if (parsed.data.targetUserId === access.space.ownerId) return NextResponse.json({ code: "OWNER_PROTECTED", message: "Владельца пространства нельзя модерировать." }, { status: 409 });
  const [target] = await access.database.select({ id: users.id }).from(users).where(eq(users.id, parsed.data.targetUserId)).limit(1);
  if (!target) return NextResponse.json({ code: "NOT_FOUND", message: "Пользователь не найден." }, { status: 404 });
  if (parsed.data.action === "unban") {
    const [latest] = await access.database.select({ action: moderationCases.action }).from(moderationCases).where(and(eq(moderationCases.spaceId, spaceId), eq(moderationCases.targetUserId, target.id), inArray(moderationCases.action, ["ban", "unban"]))).orderBy(desc(moderationCases.createdAt)).limit(1);
    if (latest?.action !== "ban") return NextResponse.json({ code: "NOT_BANNED", message: "Пользователь не заблокирован." }, { status: 409 });
  } else {
    const [membership] = await access.database.select({ userId: members.userId }).from(members).where(and(eq(members.spaceId, spaceId), eq(members.userId, target.id))).limit(1);
    if (!membership) return NextResponse.json({ code: "NOT_MEMBER", message: "Пользователь не является участником пространства." }, { status: 409 });
    if (!access.owner) {
      const targetRoles = await access.database.select({ position: roles.position }).from(memberRoles).innerJoin(roles, eq(roles.id, memberRoles.roleId)).where(and(eq(memberRoles.spaceId, spaceId), eq(memberRoles.userId, target.id)));
      const targetTop = Math.max(0, ...targetRoles.map((role) => role.position));
      if (targetTop >= access.topPosition) return NextResponse.json({ code: "ROLE_HIERARCHY", message: "Нельзя модерировать участника с равной или более высокой ролью." }, { status: 403 });
    }
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
