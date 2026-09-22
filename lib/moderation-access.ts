import "server-only";
import { and, desc, eq, gt } from "drizzle-orm";
import { getDatabase } from "@/db/client";
import { moderationCases } from "@/db/schema";

export async function getActiveTimeout(spaceId: string, userId: string) {
  const db = getDatabase();
  const [timeout] = await db.select({ expiresAt: moderationCases.expiresAt })
    .from(moderationCases)
    .where(and(
      eq(moderationCases.spaceId, spaceId),
      eq(moderationCases.targetUserId, userId),
      eq(moderationCases.action, "timeout"),
      gt(moderationCases.expiresAt, new Date()),
    ))
    .orderBy(desc(moderationCases.createdAt))
    .limit(1);
  return timeout?.expiresAt ?? null;
}
