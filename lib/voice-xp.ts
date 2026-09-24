import "server-only";

import { and, eq } from "drizzle-orm";
import { voiceStates } from "@/db/schema";
import { awardXp, type XpTransaction } from "@/lib/xp";

const VOICE_XP_PER_MINUTE = 3;
const MAX_SESSION_MINUTES = 120;

export async function finalizeVoiceXp(
  tx: XpTransaction,
  input: { userId: string; channelId: string; spaceId: string; now?: Date },
) {
  const [session] = await tx.select({
    joinedAt: voiceStates.joinedAt,
    updatedAt: voiceStates.updatedAt,
  }).from(voiceStates).where(and(
    eq(voiceStates.userId, input.userId),
    eq(voiceStates.channelId, input.channelId),
  )).limit(1);

  if (!session) return { minutes: 0, xp: 0 };

  await tx.delete(voiceStates).where(and(
    eq(voiceStates.userId, input.userId),
    eq(voiceStates.channelId, input.channelId),
  ));

  const now = input.now ?? new Date();
  const confirmedUntilMs = Math.min(now.getTime(), session.updatedAt.getTime() + 60_000);
  const durationMs = Math.max(0, confirmedUntilMs - session.joinedAt.getTime());
  const minutes = Math.min(MAX_SESSION_MINUTES, Math.floor(durationMs / 60_000));
  let awardedMinutes = 0;

  for (let minute = 1; minute <= minutes; minute += 1) {
    const bucketTime = session.joinedAt.getTime() + minute * 60_000;
    const minuteBucket = Math.floor(bucketTime / 60_000);
    const result = await awardXp({
      userId: input.userId,
      source: "voice_minute",
      amount: VOICE_XP_PER_MINUTE,
      dedupeKey: `voice:${input.userId}:${input.channelId}:${minuteBucket}`,
      spaceId: input.spaceId,
      meta: { channelId: input.channelId, minuteBucket },
    }, tx);
    if (result.awarded) awardedMinutes += 1;
  }

  return { minutes: awardedMinutes, xp: awardedMinutes * VOICE_XP_PER_MINUTE };
}
