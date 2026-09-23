import { and, eq, gte, isNull, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDatabase } from "@/db/client";
import { channels, members, messages, spaces } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";

export async function GET(_request: Request, { params }: { params: Promise<{ spaceId: string }> }) {
  const [user, { spaceId }] = await Promise.all([getCurrentUser(), params]);
  if (!user) return NextResponse.json({ message: "Требуется вход." }, { status: 401 });
  const db = getDatabase();
  const [space] = await db.select({ ownerId: spaces.ownerId }).from(spaces).where(eq(spaces.id, spaceId)).limit(1);
  if (!space) return NextResponse.json({ message: "Пространство не найдено." }, { status: 404 });
  const [member] = await db.select({ userId: members.userId }).from(members).where(and(eq(members.spaceId, spaceId), eq(members.userId, user.id))).limit(1);
  if (!member && space.ownerId !== user.id) return NextResponse.json({ message: "Вы не состоите в пространстве." }, { status: 403 });
  const week = new Date(Date.now() - 7 * 86400000);
  const [memberCount, channelCount, messageCount, weeklyMessages, weeklyJoins] = await Promise.all([
    db.select({ count: sql<number>`count(*)::int` }).from(members).where(eq(members.spaceId, spaceId)),
    db.select({ count: sql<number>`count(*)::int` }).from(channels).where(eq(channels.spaceId, spaceId)),
    db.select({ count: sql<number>`count(*)::int` }).from(messages).innerJoin(channels, eq(messages.channelId, channels.id)).where(and(eq(channels.spaceId, spaceId), isNull(messages.deletedAt))),
    db.select({ count: sql<number>`count(*)::int` }).from(messages).innerJoin(channels, eq(messages.channelId, channels.id)).where(and(eq(channels.spaceId, spaceId), isNull(messages.deletedAt), gte(messages.createdAt, week))),
    db.select({ count: sql<number>`count(*)::int` }).from(members).where(and(eq(members.spaceId, spaceId), gte(members.joinedAt, week))),
  ]);
  return NextResponse.json({ members: memberCount[0]?.count ?? 0, channels: channelCount[0]?.count ?? 0, messages: messageCount[0]?.count ?? 0, weeklyMessages: weeklyMessages[0]?.count ?? 0, weeklyJoins: weeklyJoins[0]?.count ?? 0 });
}
