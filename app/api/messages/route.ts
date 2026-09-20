import { createHash, randomUUID } from "node:crypto";
import { and, asc, desc, eq, isNull, ne, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDatabase } from "@/db/client";
import { directConversationMembers, directConversations, directMessages, users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { normalizeDirectMessage } from "@/lib/direct-message";
import { getSuperFlipCapabilities } from "@/lib/superflip";

const conversationIdFor = (left: string, right: string) => createHash("sha256").update([left, right].sort().join(":"), "utf8").digest("hex");

export async function GET(request: Request) {
  const user = await getCurrentUser(); if (!user) return NextResponse.json({ message: "Требуется вход." }, { status: 401 });
  const database = getDatabase(); const conversationId = new URL(request.url).searchParams.get("conversationId");
  if (conversationId) {
    const [membership] = await database.select().from(directConversationMembers).where(and(eq(directConversationMembers.conversationId, conversationId), eq(directConversationMembers.userId, user.id))).limit(1);
    if (!membership) return NextResponse.json({ message: "Диалог недоступен." }, { status: 403 });
    const rows = await database.select({ id: directMessages.id, conversationId: directMessages.conversationId, senderId: directMessages.senderId, receiverId: directMessages.receiverId, text: directMessages.text, createdAt: directMessages.createdAt, readAt: directMessages.readAt }).from(directMessages).where(and(eq(directMessages.conversationId, conversationId), isNull(directMessages.deletedAt))).orderBy(asc(directMessages.createdAt)).limit(200);
    await database.update(directMessages).set({ readAt: new Date() }).where(and(eq(directMessages.conversationId, conversationId), eq(directMessages.receiverId, user.id), isNull(directMessages.readAt)));
    return NextResponse.json({ messages: rows });
  }
  const memberships = await database.select({ conversationId: directConversationMembers.conversationId }).from(directConversationMembers).where(eq(directConversationMembers.userId, user.id));
  const conversations = await Promise.all(memberships.map(async ({ conversationId: id }) => {
    const [otherMember] = await database.select({ userId: directConversationMembers.userId }).from(directConversationMembers).where(and(eq(directConversationMembers.conversationId, id), ne(directConversationMembers.userId, user.id))).limit(1);
    if (!otherMember) return null;
    const [other] = await database.select({ id: users.id, username: users.username, displayName: users.displayName, avatarUrl: users.avatarUrl, presence: users.presence }).from(users).where(eq(users.id, otherMember.userId)).limit(1);
    const [lastMessage] = await database.select({ text: directMessages.text, createdAt: directMessages.createdAt }).from(directMessages).where(and(eq(directMessages.conversationId, id), isNull(directMessages.deletedAt))).orderBy(desc(directMessages.createdAt)).limit(1);
    const [counter] = await database.select({ count: sql<number>`count(*)::int` }).from(directMessages).where(and(eq(directMessages.conversationId, id), eq(directMessages.receiverId, user.id), isNull(directMessages.readAt), isNull(directMessages.deletedAt)));
    return { id, other, lastMessage: lastMessage ?? null, unread: counter?.count ?? 0 };
  }));
  return NextResponse.json({ conversations: conversations.filter(Boolean), unread: conversations.reduce((sum, item) => sum + (item?.unread ?? 0), 0) });
}

export async function POST(request: Request) {
  const user = await getCurrentUser(); if (!user) return NextResponse.json({ message: "Требуется вход." }, { status: 401 });
  const access = await getSuperFlipCapabilities(user.id);
  const body = await request.json().catch(() => null); const receiverId = String(body?.receiverId ?? ""); const text = normalizeDirectMessage(body?.text, access.capabilities.directMessageLimit);
  if (!receiverId || receiverId === user.id || !text) return NextResponse.json({ message: "Получатель или сообщение указаны неверно." }, { status: 400 });
  const database = getDatabase(); const [receiver] = await database.select({ id: users.id }).from(users).where(eq(users.id, receiverId)).limit(1); if (!receiver) return NextResponse.json({ message: "Получатель не найден." }, { status: 404 });
  const conversationId = conversationIdFor(user.id, receiverId); const id = randomUUID();
  await database.transaction(async (tx) => {
    await tx.insert(directConversations).values({ id: conversationId }).onConflictDoUpdate({ target: directConversations.id, set: { updatedAt: new Date() } });
    await tx.insert(directConversationMembers).values([{ conversationId, userId: user.id }, { conversationId, userId: receiverId }]).onConflictDoNothing();
    await tx.insert(directMessages).values({ id, conversationId, senderId: user.id, receiverId, text });
  });
  return NextResponse.json({ message: { id, conversationId, senderId: user.id, receiverId, text, createdAt: new Date().toISOString(), readAt: null } }, { status: 201 });
}
