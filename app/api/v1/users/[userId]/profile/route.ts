import { and, count, eq, inArray, or, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDatabase } from "@/db/client";
import { friendRequests, friends, members, messages, spaces, userBlocks, userPrivacySettings, userProgress, users } from "@/db/schema";
import { getUserClan } from "@/lib/clans";
import { totalXpForLevel } from "@/lib/gamification";
import { presentationForUsers } from "@/lib/presentation";
import { getCurrentUser } from "@/lib/auth";

export async function GET(_request: Request, { params }: { params: Promise<{ userId: string }> }) {
  const viewer = await getCurrentUser();
  if (!viewer) return NextResponse.json({ code: "UNAUTHENTICATED", message: "Требуется вход." }, { status: 401 });
  const { userId } = await params;
  const db = getDatabase();
  await db.execute(sql`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "profile_location" text; ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "profile_status" text; ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "profile_links" jsonb DEFAULT '[]'::jsonb NOT NULL;`);
  const [exists] = await db.select({ id: users.id }).from(users).where(eq(users.id, userId)).limit(1);
  if (!exists) return NextResponse.json({ code: "NOT_FOUND", message: "Пользователь не найден." }, { status: 404 });
  await db.insert(userProgress).values({ userId, totalXp: 0, level: 1 }).onConflictDoNothing({ target: userProgress.userId });
  const [user] = await db.select({
    id: users.id, username: users.username, displayName: users.displayName, avatarUrl: users.avatarUrl,
    bannerUrl: users.bannerUrl, bio: users.bio, accentColor: users.accentColor, presence: users.presence, lastSeenAt: users.lastSeenAt,
    globalXp: userProgress.totalXp, globalLevel: userProgress.level, xpUpdatedAt: userProgress.xpUpdatedAt, createdAt: users.createdAt,
    profileLocation: users.profileLocation, profileStatus: users.profileStatus, profileLinks: users.profileLinks,
    profileGames:users.profileGames,profileMusic:users.profileMusic,profileWidgets:users.profileWidgets,customStatusEmoji:users.customStatusEmoji,customStatusExpiresAt:users.customStatusExpiresAt,
  }).from(users).innerJoin(userProgress, eq(userProgress.userId, users.id)).where(eq(users.id, userId)).limit(1);
  if (viewer.id !== userId) {
    const [blocked] = await db.select().from(userBlocks).where(or(and(eq(userBlocks.blockerId, viewer.id), eq(userBlocks.blockedId, userId)), and(eq(userBlocks.blockerId, userId), eq(userBlocks.blockedId, viewer.id)))).limit(1);
    if (blocked) return NextResponse.json({ code: "PROFILE_UNAVAILABLE", message: "Профиль недоступен." }, { status: 403 });
    const [privacy] = await db.select({ profileDiscovery: userPrivacySettings.profileDiscovery }).from(userPrivacySettings).where(eq(userPrivacySettings.userId, userId)).limit(1);
    if (privacy?.profileDiscovery === false) {
      const [friend] = await db.select({ friendId: friends.friendId }).from(friends).where(and(eq(friends.userId, viewer.id), eq(friends.friendId, userId))).limit(1);
      if (!friend) return NextResponse.json({ code: "PRIVATE_PROFILE", message: "Пользователь ограничил просмотр профиля." }, { status: 403 });
    }
  }

  const [[messageCount], [friendCount], [serverCount], serverRows, clan] = await Promise.all([
    db.select({ value: count() }).from(messages).where(eq(messages.authorId, userId)),
    db.select({ value: count() }).from(friends).where(eq(friends.userId, userId)),
    db.select({ value: count() }).from(members).where(eq(members.userId, userId)),
    db.select({ id: spaces.id, name: spaces.name, iconUrl: spaces.iconUrl }).from(members).innerJoin(spaces, eq(spaces.id, members.spaceId)).where(eq(members.userId, userId)).limit(3),
    getUserClan(userId),
  ]);
  const presentation=(await presentationForUsers([userId])).get(userId);
  const [viewerFriends, targetFriends, viewerSpaces, targetSpaces] = viewer.id === userId
    ? [[], [], [], []]
    : await Promise.all([
        db.select({ id: friends.friendId }).from(friends).where(eq(friends.userId, viewer.id)),
        db.select({ id: friends.friendId }).from(friends).where(eq(friends.userId, userId)),
        db.select({ id: members.spaceId }).from(members).where(eq(members.userId, viewer.id)),
        db.select({ id: members.spaceId }).from(members).where(eq(members.userId, userId)),
      ]);
  const viewerFriendIds = new Set(viewerFriends.map((item) => item.id));
  const commonFriendIds = targetFriends.map((item) => item.id).filter((id) => viewerFriendIds.has(id)).slice(0, 20);
  const viewerSpaceIds = new Set(viewerSpaces.map((item) => item.id));
  const commonSpaceIds = targetSpaces.map((item) => item.id).filter((id) => viewerSpaceIds.has(id)).slice(0, 20);
  const [commonFriends, commonServers] = await Promise.all([
    commonFriendIds.length ? db.select({ id: users.id, username: users.username, displayName: users.displayName, avatarUrl: users.avatarUrl }).from(users).where(inArray(users.id, commonFriendIds)) : Promise.resolve([]),
    commonSpaceIds.length ? db.select({ id: spaces.id, name: spaces.name, iconUrl: spaces.iconUrl }).from(spaces).where(inArray(spaces.id, commonSpaceIds)) : Promise.resolve([]),
  ]);

  const [friendship] = viewer.id === userId ? [] : await db.select({ friendId: friends.friendId }).from(friends).where(and(eq(friends.userId, viewer.id), eq(friends.friendId, userId))).limit(1);
  const [outgoingRequest] = viewer.id === userId || friendship ? [] : await db.select({ id: friendRequests.id }).from(friendRequests).where(and(eq(friendRequests.fromId, viewer.id), eq(friendRequests.toId, userId), eq(friendRequests.status, "pending"))).limit(1);
  const [incomingRequest] = viewer.id === userId || friendship ? [] : await db.select({ id: friendRequests.id }).from(friendRequests).where(and(eq(friendRequests.fromId, userId), eq(friendRequests.toId, viewer.id), eq(friendRequests.status, "pending"))).limit(1);
  return NextResponse.json({
    profile: { ...user,profileStatus:user.customStatusExpiresAt&&user.customStatusExpiresAt<new Date()?null:user.profileStatus,customStatusEmoji:user.customStatusExpiresAt&&user.customStatusExpiresAt<new Date()?null:user.customStatusEmoji, clan, nextLevelXp:user.globalLevel>=100?user.globalXp:totalXpForLevel(user.globalLevel+1), xpToNextLevel:user.globalLevel>=100?0:Math.max(0,totalXpForLevel(user.globalLevel+1)-user.globalXp), cosmetics:presentation?.cosmetics??{},badges:presentation?.badges??[], presence: user.lastSeenAt && user.lastSeenAt.getTime() > Date.now() - 90_000 ? "online" : "offline", lastSeenAt: undefined, isOwnProfile: viewer.id === userId, isFriend: Boolean(friendship), friendshipStatus: friendship ? "friends" : outgoingRequest ? "outgoing" : incomingRequest ? "incoming" : "none", incomingRequestId: incomingRequest?.id ?? null,
      stats: { messages: messageCount?.value ?? 0, friends: friendCount?.value ?? 0, servers: serverCount?.value ?? 0 },
      servers: serverRows,
      commonFriends,
      commonServers,
    }
  });
}
