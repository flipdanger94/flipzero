import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDatabase } from "@/db/client";
import { adminAuditLogs, coinTransactions, notifications, users, userWallets } from "@/db/schema";
import { requireAdmin } from "@/lib/admin";

const MAX_COIN_GRANT = 2_147_483_647;

export async function POST(request: Request) {
  const access = await requireAdmin();
  if ("error" in access) return access.error;

  const body = await request.json().catch(() => null);
  const userId = typeof body?.userId === "string" ? body.userId : "";
  const amount = Number(body?.amount);

  if (!userId) {
    return NextResponse.json({ message: "Укажите пользователя." }, { status: 400 });
  }
  if (!Number.isSafeInteger(amount) || amount <= 0 || amount > MAX_COIN_GRANT) {
    return NextResponse.json(
      { message: `Количество монет должно быть целым числом от 1 до ${MAX_COIN_GRANT.toLocaleString("ru-RU")}.` },
      { status: 400 },
    );
  }

  const database = getDatabase();
  const [target] = await database
    .select({ id: users.id, username: users.username })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!target) {
    return NextResponse.json({ message: "Пользователь не найден." }, { status: 404 });
  }

  const transactionId = randomUUID();
  const idempotencyKey = `admin:${access.user.id}:${transactionId}`;

  const balance = await database.transaction(async (tx) => {
    await tx.insert(coinTransactions).values({
      id: transactionId,
      userId: target.id,
      amount,
      reason: "admin_grant",
      idempotencyKey,
    });

    const [wallet] = await tx
      .insert(userWallets)
      .values({ userId: target.id, balance: amount })
      .onConflictDoUpdate({
        target: userWallets.userId,
        set: {
          balance: sql`${userWallets.balance} + ${amount}`,
          updatedAt: new Date(),
        },
      })
      .returning({ balance: userWallets.balance });

    await tx.insert(notifications).values({
      id: randomUUID(),
      userId: target.id,
      actorId: access.user.id,
      type: "coin_gift",
      title: "Вам начислены монеты",
      body: `Администратор начислил вам ${amount.toLocaleString("ru-RU")} монет.`,
      entityType: "coin_transaction",
      entityId: transactionId,
    });

    await tx.insert(adminAuditLogs).values({
      id: randomUUID(),
      adminId: access.user.id,
      action: "economy.coins_grant",
      targetUserId: target.id,
      metadata: { transactionId, amount },
    });

    return wallet.balance;
  });

  return NextResponse.json({
    grant: { transactionId, userId: target.id, username: target.username, amount, balance },
  }, { status: 201 });
}
