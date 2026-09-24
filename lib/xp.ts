import "server-only";

import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { getDatabase } from "@/db/client";
import { userProgress, users, xpEvents } from "@/db/schema";
import { levelFromXp, totalXpForLevel } from "@/lib/gamification";

type Database = ReturnType<typeof getDatabase>;
export type XpTransaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

export type AwardXpInput = {
  userId: string;
  source: string;
  amount: number;
  dedupeKey: string;
  spaceId?: string | null;
  meta?: Record<string, unknown>;
};

export type AwardXpResult = {
  awarded: boolean;
  amount: number;
  totalXp: number;
  newLevel: number;
  leveledUp: boolean;
  nextLevelXp: number | null;
};

function assertAwardInput(input: AwardXpInput) {
  if (!input.userId || !input.source || !input.dedupeKey) throw new Error("XP award requires userId, source and dedupeKey");
  if (!Number.isSafeInteger(input.amount) || input.amount <= 0 || input.amount > 1_000_000) throw new Error("XP award amount is invalid");
  if (input.dedupeKey.length > 240) throw new Error("XP dedupe key is too long");
}

async function awardXpInTransaction(tx: XpTransaction, input: AwardXpInput): Promise<AwardXpResult> {
  assertAwardInput(input);

  const [legacy] = await tx.select({ totalXp: users.globalXp, level: users.globalLevel })
    .from(users)
    .where(eq(users.id, input.userId))
    .limit(1);
  if (!legacy) throw new Error("XP user does not exist");

  await tx.insert(userProgress).values({
    userId: input.userId,
    totalXp: legacy.totalXp,
    level: levelFromXp(legacy.totalXp),
    xpUpdatedAt: new Date(),
  }).onConflictDoNothing();

  const ledgerKey = `${input.userId}:${input.source}:${input.dedupeKey}`;
  const [event] = await tx.insert(xpEvents).values({
    id: randomUUID(),
    userId: input.userId,
    spaceId: input.spaceId ?? null,
    source: input.source,
    amount: input.amount,
    idempotencyKey: ledgerKey,
    dedupeKey: input.dedupeKey,
    meta: input.meta ?? {},
  }).onConflictDoNothing().returning({ id: xpEvents.id });

  const [current] = await tx.select({ totalXp: userProgress.totalXp, level: userProgress.level })
    .from(userProgress)
    .where(eq(userProgress.userId, input.userId))
    .limit(1);
  if (!current) throw new Error("XP progress row is missing");

  if (!event) {
    return {
      awarded: false,
      amount: 0,
      totalXp: current.totalXp,
      newLevel: current.level,
      leveledUp: false,
      nextLevelXp: current.level >= 100 ? null : totalXpForLevel(current.level + 1),
    };
  }

  const now = new Date();
  const [incremented] = await tx.update(userProgress).set({
    totalXp: sql`${userProgress.totalXp} + ${input.amount}`,
    xpUpdatedAt: now,
  }).where(eq(userProgress.userId, input.userId)).returning({
    totalXp: userProgress.totalXp,
    oldLevel: userProgress.level,
  });
  if (!incremented) throw new Error("XP progress update failed");

  const newLevel = levelFromXp(incremented.totalXp);
  const leveledUp = newLevel > incremented.oldLevel;
  await tx.update(userProgress).set({
    level: newLevel,
    ...(leveledUp ? { lastLevelUpAt: now } : {}),
  }).where(eq(userProgress.userId, input.userId));

  // Transitional compatibility only: old columns are mirrors, never read as the
  // canonical source after the migration. They are updated in this transaction.
  await tx.update(users).set({
    globalXp: incremented.totalXp,
    globalLevel: newLevel,
    updatedAt: now,
  }).where(eq(users.id, input.userId));

  return {
    awarded: true,
    amount: input.amount,
    totalXp: incremented.totalXp,
    newLevel,
    leveledUp,
    nextLevelXp: newLevel >= 100 ? null : totalXpForLevel(newLevel + 1),
  };
}

export async function awardXp(input: AwardXpInput, tx?: XpTransaction): Promise<AwardXpResult> {
  if (tx) return awardXpInTransaction(tx, input);
  return getDatabase().transaction((transaction) => awardXpInTransaction(transaction, input));
}

export async function progressForUser(userId: string, db: Database | XpTransaction = getDatabase()) {
  const [row] = await db.select({
    totalXp: userProgress.totalXp,
    level: userProgress.level,
    xpUpdatedAt: userProgress.xpUpdatedAt,
    lastLevelUpAt: userProgress.lastLevelUpAt,
  }).from(userProgress).where(eq(userProgress.userId, userId)).limit(1);
  if (row) return { ...row, nextLevelXp: row.level >= 100 ? null : totalXpForLevel(row.level + 1) };

  const [legacy] = await db.select({ totalXp: users.globalXp }).from(users).where(eq(users.id, userId)).limit(1);
  if (!legacy) return null;
  const level = levelFromXp(legacy.totalXp);
  return {
    totalXp: legacy.totalXp,
    level,
    xpUpdatedAt: new Date(0),
    lastLevelUpAt: null,
    nextLevelXp: level >= 100 ? null : totalXpForLevel(level + 1),
  };
}
