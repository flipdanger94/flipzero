import "server-only";

import { and, eq, or } from "drizzle-orm";
import { getDatabase } from "@/db/client";
import { friends, userBlocks, userPrivacySettings, users } from "@/db/schema";

export async function canDirectCall(callerId: string, receiverId: string) {
  if (!callerId || !receiverId || callerId === receiverId) {
    return { ok: false as const, status: 400, message: "Собеседник указан неверно." };
  }
  const db = getDatabase();
  const [receiver] = await db.select({ id: users.id }).from(users).where(eq(users.id, receiverId)).limit(1);
  if (!receiver) return { ok: false as const, status: 404, message: "Пользователь не найден." };

  const [blocked] = await db.select({ blockerId: userBlocks.blockerId }).from(userBlocks).where(or(
    and(eq(userBlocks.blockerId, callerId), eq(userBlocks.blockedId, receiverId)),
    and(eq(userBlocks.blockerId, receiverId), eq(userBlocks.blockedId, callerId)),
  )).limit(1);
  if (blocked) return { ok: false as const, status: 403, message: "Звонок недоступен из-за блокировки." };

  const [privacy] = await db.select({ directMessages: userPrivacySettings.directMessages })
    .from(userPrivacySettings)
    .where(eq(userPrivacySettings.userId, receiverId))
    .limit(1);
  if (privacy?.directMessages === false) {
    const [friend] = await db.select({ friendId: friends.friendId }).from(friends).where(and(
      eq(friends.userId, receiverId),
      eq(friends.friendId, callerId),
    )).limit(1);
    if (!friend) return { ok: false as const, status: 403, message: "Пользователь принимает звонки только от друзей." };
  }
  return { ok: true as const };
}
