import { randomUUID } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDatabase } from "@/db/client";
import { adminAuditLogs, notifications, superflipPurchases, users } from "@/db/schema";
import { requireAdmin } from "@/lib/admin";
import {
  normalizeSuperFlipGiftReason,
  parseSuperFlipGiftPeriod,
  subscriptionExpiry,
  superFlipGiftNotificationBody,
} from "@/lib/superflip";

export async function POST(request: Request) {
  const access = await requireAdmin(); if ("error" in access) return access.error;
  const body = await request.json().catch(() => null);
  const userId = typeof body?.userId === "string" ? body.userId : null;
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : null;
  const reason = normalizeSuperFlipGiftReason(body?.reason);
  const period = parseSuperFlipGiftPeriod(body?.period);
  if (!userId && !email) return NextResponse.json({ message: "Укажите userId или email." }, { status: 400 });
  if (!reason) return NextResponse.json({ message: "Укажите причину выдачи SuperFlip." }, { status: 400 });
  if (!period) return NextResponse.json({ message: "Выберите срок SuperFlip: месяц, год или навсегда." }, { status: 400 });

  const database = getDatabase();
  const [target] = await database.select({ id: users.id, email: users.email }).from(users).where(userId ? eq(users.id, userId) : eq(users.email, email!)).limit(1);
  if (!target) return NextResponse.json({ message: "Пользователь не найден." }, { status: 404 });

  const months = period === "year" ? 12 : 1;
  const grantId = randomUUID();
  const expiresAt = period === "forever" ? null : subscriptionExpiry(months);

  await database.transaction(async (tx) => {
    await tx.insert(superflipPurchases).values({
      id: grantId,
      userId: target.id,
      grantedBy: access.user.id,
      expiresAt,
      source: "gift",
      reason,
    });
    await tx.insert(notifications).values({
      id: randomUUID(),
      userId: target.id,
      actorId: access.user.id,
      type: "superflip_gift",
      title: "Вам подарен SuperFlip",
      body: superFlipGiftNotificationBody(period, reason),
      entityType: "superflip_grant",
      entityId: grantId,
    });
    await tx.insert(adminAuditLogs).values({
      id: randomUUID(),
      adminId: access.user.id,
      action: "superflip.grant",
      targetUserId: target.id,
      metadata: { grantId, period, months: period === "forever" ? null : months, reason },
    });
  });

  return NextResponse.json({
    grant: { id: grantId, userId: target.id, expiresAt, period, source: "gift", reason },
  }, { status: 201 });
}

export async function DELETE(request: Request) {
  const access = await requireAdmin(); if ("error" in access) return access.error;
  const body = await request.json().catch(() => null); const targetUserId = String(body?.userId ?? "");
  if (!targetUserId) return NextResponse.json({ message: "Укажите userId." }, { status: 400 });
  const database = getDatabase();
  const grants = await database.update(superflipPurchases).set({ revokedAt: new Date() }).where(and(eq(superflipPurchases.userId, targetUserId), isNull(superflipPurchases.revokedAt))).returning({ id: superflipPurchases.id });
  await database.insert(adminAuditLogs).values({ id: randomUUID(), adminId: access.user.id, action: "superflip.revoke", targetUserId, metadata: { grants: grants.map((item) => item.id) } });
  return NextResponse.json({ revoked: grants.length });
}
