import { and, count, eq, or } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDatabase } from "@/db/client";
import { friends, members, messages, spaces, users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";

export async function GET(_request: Request, { params }: { params: Promise<{ userId: string }> }) {
  const viewer = await getCurrentUser();
  if (!viewer) return NextResponse.json({ code: "UNAUTHENTICATED", message: "Требуется вход." }, { status: 401 });
  const { userId } = await params;
  const db = getDatabase();
  const [user] = await db.select({
    id: users.id, username: users.username, displayName: users.displayName, avatarUrl: users.avatarUrl,
    bannerUrl: users.bannerUrl, bio: users.bio, accentColor: users.accentColor, presence: users.presence,
    globalXp: users.globalXp, globalLevel: users.globalLevel, createdAt: users.createdAt,
    profileLocation: users.profileLocation, profileStatus: users.profileStatus, profileLinks: users.profileLinks,
  }).from(users).where(eq(users.id, userId)).limit(1);
  if (!user) return NextResponse.json({ code: "NOT_FOUND", message: "Пользователь не найден." }, { status: 404 });

  const [[messageCount], [friendCount], [serverCount], serverRows] = await Promise.all([
    db.select({ value: count() }).from(messages).where(eq(messages.authorId, userId)),
    db.select({ value: count() }).from(friends).where(eq(friends.userId, userId)),
    db.select({ value: count() }).from(members).where(eq(members.userId, userId)),
    db.select({ id: spaces.id, name: spaces.name, iconUrl: spaces.iconUrl }).from(members).innerJoin(spaces, eq(spaces.id, members.spaceId)).where(eq(members.userId, userId)).limit(3),
  ]);
  const [friendship] = viewer.id === userId ? [] : await db.select({ friendId: friends.friendId }).from(friends).where(and(eq(friends.userId, viewer.id), eq(friends.friendId, userId))).limit(1);
  return NextResponse.json({
    profile: { ...user, isOwnProfile: viewer.id === userId, isFriend: Boolean(friendship),
      stats: { messages: messageCount?.value ?? 0, friends: friendCount?.value ?? 0, servers: serverCount?.value ?? 0 },
      servers: serverRows,
    }
  });
}
