import { and, count, eq, or, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDatabase } from "@/db/client";
import { friendRequests, friends, members, messages, spaces, userBlocks, userPrivacySettings, users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";

export async function GET(_request: Request, { params }: { params: Promise<{ userId: string }> }) {
  const viewer = await getCurrentUser();
  if (!viewer) return NextResponse.json({ code: "UNAUTHENTICATED", message: "Требуется вход." }, { status: 401 });
  const { userId } = await params;
  const db = getDatabase();
  await db.execute(sql`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "profile_location" text; ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "profile_status" text; ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "profile_links" jsonb DEFAULT '[]'::jsonb NOT NULL;`);
  const [user] = await db.select({
    id: users.id, username: users.username, displayName: users.displayName, avatarUrl: users.avatarUrl,
    bannerUrl: users.bannerUrl, bio: users.bio, accentColor: users.accentColor, presence: users.presence,
    globalXp: users.globalXp, globalLevel: users.globalLevel, createdAt: users.createdAt,
    profileLocation: users.profileLocation, profileStatus: users.profileStatus, profileLinks: users.profileLinks,
  }).from(users).where(eq(users.id, userId)).limit(1);
  if (!user) return NextResponse.json({ code: "NOT_FOUND", message: "Пользователь не найден." }, { status: 404 });
  if (viewer.id !== userId) {
    const [blocked] = await db.select().from(userBlocks).where(or(and(eq(userBlocks.blockerId, viewer.id), eq(userBlocks.blockedId, userId)), and(eq(userBlocks.blockerId, userId), eq(userBlocks.blockedId, viewer.id)))).limit(1);
    if (blocked) return NextResponse.json({ code: "PROFILE_UNAVAILABLE", message: "Профиль недоступен." }, { status: 403 });
    const [privacy] = await db.select({ profileDiscovery: userPrivacySettings.profileDiscovery }).from(userPrivacySettings).where(eq(userPrivacySettings.userId, userId)).limit(1);
    if (privacy?.profileDiscovery === false) {
      const [friend] = await db.select({ friendId: friends.friendId }).from(friends).where(and(eq(friends.userId, viewer.id), eq(friends.friendId, userId))).limit(1);
      if (!friend) return NextResponse.json({ code: "PRIVATE_PROFILE", message: "Пользователь ограничил просмотр профиля." }, { status: 403 });
    }
  }

  const [[messageCount], [friendCount], [serverCount], serverRows] = await Promise.all([
    db.select({ value: count() }).from(messages).where(eq(messages.authorId, userId)),
    db.select({ value: count() }).from(friends).where(eq(friends.userId, userId)),
    db.select({ value: count() }).from(members).where(eq(members.userId, userId)),
    db.select({ id: spaces.id, name: spaces.name, iconUrl: spaces.iconUrl }).from(members).innerJoin(spaces, eq(spaces.id, members.spaceId)).where(eq(members.userId, userId)).limit(3),
  ]);
  const [friendship] = viewer.id === userId ? [] : await db.select({ friendId: friends.friendId }).from(friends).where(and(eq(friends.userId, viewer.id), eq(friends.friendId, userId))).limit(1);
  const [outgoingRequest] = viewer.id === userId || friendship ? [] : await db.select({ id: friendRequests.id }).from(friendRequests).where(and(eq(friendRequests.fromId, viewer.id), eq(friendRequests.toId, userId), eq(friendRequests.status, "pending"))).limit(1);
  const [incomingRequest] = viewer.id === userId || friendship ? [] : await db.select({ id: friendRequests.id }).from(friendRequests).where(and(eq(friendRequests.fromId, userId), eq(friendRequests.toId, viewer.id), eq(friendRequests.status, "pending"))).limit(1);
  return NextResponse.json({
    profile: { ...user, isOwnProfile: viewer.id === userId, isFriend: Boolean(friendship), friendshipStatus: friendship ? "friends" : outgoingRequest ? "outgoing" : incomingRequest ? "incoming" : "none", incomingRequestId: incomingRequest?.id ?? null,
      stats: { messages: messageCount?.value ?? 0, friends: friendCount?.value ?? 0, servers: serverCount?.value ?? 0 },
      servers: serverRows,
    }
  });
}
