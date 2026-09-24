import "server-only";
import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { getDatabase } from "@/db/client";
import { userProgress, users, xpEvents } from "@/db/schema";
import { levelFromXp } from "@/lib/gamification";

export type XpSource =
  | "message"
  | "reaction_received"
  | "voice_minute"
  | "event_hosted"
  | "invite_joined"
  | "forum_post"
  | "creative_post"
  | "quest"
  | "legacy_adjustment";

export type AwardXpInput = {
  userId: string;
  source: XpSource | string;
  amount: number;
  dedupeKey: string;
  spaceId?: string | null;
  meta?: Record<string, unknown>;
};

type Database = ReturnType<typeof getDatabase>;
export type XpTransaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

export async function awardXpInTransaction(tx: XpTransaction, input: AwardXpInput) {
  if (!input.userId || !input.source || !input.dedupeKey) throw new Error("XP_INPUT_INVALID");
  if (!Number.isSafeInteger(input.amount) || input.amount <= 0 || input.amount > 1_000_000) throw new Error("XP_AMOUNT_INVALID");

  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${input.userId}))`);

  const [inserted] = await tx.insert(xpEvents).values({
    id: randomUUID(),
    userId: input.userId,
    spaceId: input.spaceId ?? null,
    source: input.source,
    amount: input.amount,
    idempotencyKey: input.dedupeKey,
    meta: input.meta ?? {},
  }).onConflictDoNothing({
    target: [xpEvents.userId, xpEvents.source, xpEvents.idempotencyKey],
  }).returning({ id: xpEvents.id });

  if (!inserted) {
    const [current] = await tx.select({ totalXp: userProgress.totalXp, level: userProgress.level })
      .from(userProgress).where(eq(userProgress.userId, input.userId)).limit(1);
    return { awarded: false as const, totalXp: current?.totalXp ?? 0, newLevel: current?.level ?? 1, leveledUp: false };
  }

  await tx.insert(userProgress).values({ userId: input.userId, totalXp: 0, level: 1 })
    .onConflictDoNothing({ target: userProgress.userId });

  const [before] = await tx.select({ level: userProgress.level }).from(userProgress)
    .where(eq(userProgress.userId, input.userId)).limit(1);

  const [updated] = await tx.update(userProgress).set({
    totalXp: sql`${userProgress.totalXp} + ${input.amount}`,
    xpUpdatedAt: new Date(),
  }).where(eq(userProgress.userId, input.userId)).returning({ totalXp: userProgress.totalXp });

  if (!updated) throw new Error("XP_PROGRESS_MISSING");
  const newLevel = levelFromXp(updated.totalXp);
  const leveledUp = newLevel > (before?.level ?? 1);

  await tx.update(userProgress).set({
    level: newLevel,
    xpUpdatedAt: new Date(),
    ...(leveledUp ? { lastLevelUpAt: new Date() } : {}),
  }).where(eq(userProgress.userId, input.userId));

  // Compatibility mirror during rollout. All new awards go through this function,
  // so the legacy columns cannot diverge while old readers are being switched.
  await tx.update(users).set({
    globalXp: updated.totalXp,
    globalLevel: newLevel,
    updatedAt: new Date(),
  }).where(eq(users.id, input.userId));

  return { awarded: true as const, totalXp: updated.totalXp, newLevel, leveledUp };
}

export async function awardXp(input: AwardXpInput) {
  return getDatabase().transaction((tx) => awardXpInTransaction(tx, input));
}


export async function awardVoiceSessionXp(input: {
  userId: string;
  channelId: string;
  spaceId?: string | null;
  joinedAt: Date;
  confirmedUntil: Date;
}) {
  const durationMs = Math.max(0, input.confirmedUntil.getTime() - input.joinedAt.getTime());
  const minutes = Math.min(120, Math.floor(durationMs / 60_000));
  if (minutes <= 0) return { awardedMinutes: 0, xp: 0 };

  return getDatabase().transaction(async (tx) => {
    let awardedMinutes = 0;
    for (let minute = 1; minute <= minutes; minute += 1) {
      const timestamp = input.joinedAt.getTime() + minute * 60_000;
      const minuteBucket = Math.floor(timestamp / 60_000);
      const result = await awardXpInTransaction(tx, {
        userId: input.userId,
        source: "voice_minute",
        amount: 3,
        dedupeKey: `voice:${input.userId}:${input.channelId}:${minuteBucket}`,
        spaceId: input.spaceId ?? null,
        meta: { channelId: input.channelId, minuteBucket },
      });
      if (result.awarded) awardedMinutes += 1;
    }
    return { awardedMinutes, xp: awardedMinutes * 3 };
  });
}
