import { randomBytes, randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDatabase } from "@/db/client";
import { adminAuditLogs, directMessages, moderationCases, moderationFlags, sessions, superflipPurchases, users } from "@/db/schema";
import { requireAdmin } from "@/lib/admin";

export async function GET() {
  const access = await requireAdmin(); if ("error" in access) return access.error;
  const database = getDatabase();
  const [userRows, grants, logs, reports, recentMessages, cases] = await Promise.all([
    database.select({ id: users.id, email: users.email, username: users.username, displayName: users.displayName, platformRole: users.platformRole, bannedAt: users.bannedAt, createdAt: users.createdAt }).from(users).orderBy(desc(users.createdAt)),
    database.select().from(superflipPurchases).orderBy(desc(superflipPurchases.grantedAt)).limit(100),
    database.select().from(adminAuditLogs).orderBy(desc(adminAuditLogs.createdAt)).limit(100),
    database.select().from(moderationFlags).orderBy(desc(moderationFlags.createdAt)).limit(100),
    database.select({ id: directMessages.id, senderId: directMessages.senderId, receiverId: directMessages.receiverId, text: directMessages.text, createdAt: directMessages.createdAt }).from(directMessages).orderBy(desc(directMessages.createdAt)).limit(100),
    database.select({ id: moderationCases.id, targetUserId: moderationCases.targetUserId, moderatorId: moderationCases.moderatorId, action: moderationCases.action, reason: moderationCases.reason, expiresAt: moderationCases.expiresAt, createdAt: moderationCases.createdAt }).from(moderationCases).orderBy(desc(moderationCases.createdAt)).limit(100),
  ]);
  return NextResponse.json({ users: userRows, superflip: grants, auditLogs: logs, moderationFlags: reports, directMessages: recentMessages, moderationCases: cases });
}

export async function PATCH(request: Request) {
  const access = await requireAdmin(); if ("error" in access) return access.error;
  const body = await request.json().catch(() => null); const targetUserId = String(body?.userId ?? ""); const action = String(body?.action ?? "");
  const database = getDatabase();
  if (action === "review_flag") { const flagId = String(body?.flagId ?? ""); const status = body?.status === "resolved" || body?.status === "rejected" ? body.status : ""; if (!flagId || !status) return NextResponse.json({ message: "Некорректное действие модерации." }, { status: 400 }); await database.update(moderationFlags).set({ status, reviewedById: access.user.id, reviewedAt: new Date() }).where(eq(moderationFlags.id, flagId)); await database.insert(adminAuditLogs).values({ id: randomUUID(), adminId: access.user.id, action: `moderation.${status}`, metadata: { flagId } }); return NextResponse.json({ ok: true }); }
  if (!targetUserId || targetUserId === access.user.id) return NextResponse.json({ message: "Нельзя изменить этот аккаунт." }, { status: 400 });
  const [target] = await database.select({ id: users.id }).from(users).where(eq(users.id, targetUserId)).limit(1); if (!target) return NextResponse.json({ message: "Пользователь не найден." }, { status: 404 });
  const result: Record<string, unknown> = { ok: true };
  if (action === "ban") await database.update(users).set({ bannedAt: new Date(), banReason: String(body?.reason ?? "Нарушение правил").slice(0, 500) }).where(eq(users.id, targetUserId));
  else if (action === "unban") await database.update(users).set({ bannedAt: null, banReason: null }).where(eq(users.id, targetUserId));
  else if (action === "role") { const role = body?.role === "admin" ? "admin" : "user"; await database.update(users).set({ platformRole: role }).where(eq(users.id, targetUserId)); result.role = role; }
  else if (action === "reset_password") { const temporaryPassword = randomBytes(12).toString("base64url"); await database.transaction(async (tx) => { await tx.update(users).set({ passwordHash: await bcrypt.hash(temporaryPassword, 12) }).where(eq(users.id, targetUserId)); await tx.delete(sessions).where(eq(sessions.userId, targetUserId)); }); result.temporaryPassword = temporaryPassword; }
  else return NextResponse.json({ message: "Неизвестное действие." }, { status: 400 });
  await database.insert(adminAuditLogs).values({ id: randomUUID(), adminId: access.user.id, action: `user.${action}`, targetUserId, metadata: { reason: body?.reason ?? null, role: result.role ?? null } });
  return NextResponse.json(result);
}
