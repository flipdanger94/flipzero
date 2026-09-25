import { clanTagsForUsers } from "@/lib/clan-tags";
import { createHash, randomUUID } from "node:crypto";
import { and, desc, eq, isNull, lt, ne, or, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDatabase } from "@/db/client";
import { directConversationMembers, directConversations, directMessages, friends, notifications, userBlocks, userPrivacySettings, userProgress, users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { presentationForUsers } from "@/lib/presentation";
import { decodeDirectMessage, directMessagePreview, encodeDirectMessage, normalizeDirectAttachments, normalizeDirectMessage } from "@/lib/direct-message";
import { getSuperFlipCapabilities } from "@/lib/superflip";
import { isTrustedMutationRequest } from "@/lib/security-controls";

const conversationIdFor = (left: string, right: string) => createHash("sha256").update([left, right].sort().join(":"), "utf8").digest("hex");

export async function GET(request: Request) {
  const user = await getCurrentUser(); if (!user) return NextResponse.json({ message: "Требуется вход." }, { status: 401 });
  const database = getDatabase();
  const params = new URL(request.url).searchParams;
  const conversationId = params.get("conversationId");
  if (conversationId) {
    const [membership] = await database.select().from(directConversationMembers).where(and(eq(directConversationMembers.conversationId, conversationId), eq(directConversationMembers.userId, user.id))).limit(1);
    if (!membership) return NextResponse.json({ message: "Диалог недоступен." }, { status: 403 });
    const [otherMember] = await database.select({ userId: directConversationMembers.userId }).from(directConversationMembers).where(and(eq(directConversationMembers.conversationId,conversationId),ne(directConversationMembers.userId,user.id))).limit(1);
    if (otherMember) { const [blocked] = await database.select({ blockerId:userBlocks.blockerId }).from(userBlocks).where(or(and(eq(userBlocks.blockerId,user.id),eq(userBlocks.blockedId,otherMember.userId)),and(eq(userBlocks.blockerId,otherMember.userId),eq(userBlocks.blockedId,user.id)))).limit(1); if(blocked)return NextResponse.json({message:"Диалог недоступен из-за блокировки."},{status:403}); }
    const requestedLimit = Number(params.get("limit") ?? 50);
    const limit = Number.isFinite(requestedLimit) ? Math.min(100, Math.max(20, Math.trunc(requestedLimit))) : 50;
    const cursorValue = params.get("cursor");
    const [cursorDate,cursorId]=cursorValue?.split("|")??[];
    const cursor = cursorValue ? new Date(cursorDate) : null;
    if (cursorValue && (!cursor || Number.isNaN(cursor.getTime()) || !/^[0-9a-f-]{36}$/i.test(cursorId??""))) {
      return NextResponse.json({ message: "Некорректный cursor." }, { status: 400 });
    }
    const conditions = [
      eq(directMessages.conversationId, conversationId),
      isNull(directMessages.deletedAt),
      ...(cursor ? [or(lt(directMessages.createdAt, cursor),and(eq(directMessages.createdAt,cursor),lt(directMessages.id,cursorId)))!] : []),
    ];
    const rows = await database.select({
      id: directMessages.id,
      conversationId: directMessages.conversationId,
      senderId: directMessages.senderId,
      receiverId: directMessages.receiverId,
      text: directMessages.text,
      createdAt: directMessages.createdAt,
      readAt: directMessages.readAt,
    }).from(directMessages).where(and(...conditions)).orderBy(desc(directMessages.createdAt),desc(directMessages.id)).limit(limit + 1);
    const hasMore = rows.length > limit;
    const page = rows.slice(0, limit).reverse();
    await database.update(directMessages).set({ readAt: new Date() }).where(and(eq(directMessages.conversationId, conversationId), eq(directMessages.receiverId, user.id), isNull(directMessages.readAt)));
    const messageTags=await clanTagsForUsers(page.map(message=>message.senderId));
    return NextResponse.json({
      messages: page.map((message) => ({ ...message, clan:messageTags.get(message.senderId)??null, ...decodeDirectMessage(message.text) })),
      nextCursor: hasMore && page[0] ? `${page[0].createdAt.toISOString()}|${page[0].id}` : null,
      hasMore,
    });
  }
  const memberships = await database.select({ conversationId: directConversationMembers.conversationId }).from(directConversationMembers).where(eq(directConversationMembers.userId, user.id)).limit(100);
  const conversations = await Promise.all(memberships.map(async ({ conversationId: id }) => {
    const [otherMember] = await database.select({ userId: directConversationMembers.userId }).from(directConversationMembers).where(and(eq(directConversationMembers.conversationId, id), ne(directConversationMembers.userId, user.id))).limit(1);
    if (!otherMember) return null;
    const [blocked] = await database.select({ blockerId: userBlocks.blockerId }).from(userBlocks).where(or(and(eq(userBlocks.blockerId,user.id),eq(userBlocks.blockedId,otherMember.userId)),and(eq(userBlocks.blockerId,otherMember.userId),eq(userBlocks.blockedId,user.id)))).limit(1);
    if (blocked) return null;
    const [other] = await database.select({ id: users.id, username: users.username, displayName: users.displayName, avatarUrl: users.avatarUrl, presence: users.presence, globalXp:userProgress.totalXp, globalLevel:userProgress.level }).from(users).leftJoin(userProgress,eq(userProgress.userId,users.id)).where(eq(users.id, otherMember.userId)).limit(1);
    const [lastMessageRow] = await database.select({ text: directMessages.text, createdAt: directMessages.createdAt }).from(directMessages).where(and(eq(directMessages.conversationId, id), isNull(directMessages.deletedAt))).orderBy(desc(directMessages.createdAt)).limit(1);
    const lastMessage = lastMessageRow ? { text: directMessagePreview(lastMessageRow.text), createdAt: lastMessageRow.createdAt } : null;
    const [counter] = await database.select({ count: sql<number>`count(*)::int` }).from(directMessages).where(and(eq(directMessages.conversationId, id), eq(directMessages.receiverId, user.id), isNull(directMessages.readAt), isNull(directMessages.deletedAt)));
    return { id, other:{...other,globalXp:other?.globalXp??0,globalLevel:other?.globalLevel??1}, lastMessage: lastMessage ?? null, unread: counter?.count ?? 0 };
  }));
  const clanTags=await clanTagsForUsers(conversations.map(item=>item?.other?.id).filter((id):id is string=>Boolean(id)));
  const presentation=await presentationForUsers(conversations.map(item=>item?.other?.id).filter((id):id is string=>Boolean(id)));
  return NextResponse.json({ conversations: conversations.filter(Boolean).map(item=>({...item!,other:{...item!.other,clan:clanTags.get(item!.other.id)??null,cosmetics:presentation.get(item!.other.id)?.cosmetics??{},badges:presentation.get(item!.other.id)?.badges??[]}})), unread: conversations.reduce((sum, item) => sum + (item?.unread ?? 0), 0) });
}

export async function POST(request: Request) {
  if (!isTrustedMutationRequest(request)) return NextResponse.json({ code: "UNTRUSTED_ORIGIN", message: "Запрос отклонён." }, { status: 403 });
  const user = await getCurrentUser(); if (!user) return NextResponse.json({ message: "Требуется вход." }, { status: 401 });
  const access = await getSuperFlipCapabilities(user.id);
  const body = await request.json().catch(() => null);
  const receiverId = String(body?.receiverId ?? "");
  const rawText = typeof body?.text === "string" ? body.text.trim() : "";
  const attachments = normalizeDirectAttachments(body?.attachments);
  if (rawText.length > access.capabilities.directMessageLimit) return NextResponse.json({
    code: "MESSAGE_TOO_LONG",
    message: `Максимальная длина личного сообщения — ${access.capabilities.directMessageLimit} символов.`,
    limit: access.capabilities.directMessageLimit,
  }, { status: 400 });
  const text = rawText ? normalizeDirectMessage(rawText, access.capabilities.directMessageLimit) : "";
  if (!receiverId || receiverId === user.id || (!text && !attachments.length)) return NextResponse.json({ message: "Получатель или сообщение указаны неверно." }, { status: 400 });
  const database = getDatabase(); const [receiver] = await database.select({ id: users.id }).from(users).where(eq(users.id, receiverId)).limit(1); if (!receiver) return NextResponse.json({ message: "Получатель не найден." }, { status: 404 });
  const [blocked] = await database.select().from(userBlocks).where(or(and(eq(userBlocks.blockerId, user.id), eq(userBlocks.blockedId, receiverId)), and(eq(userBlocks.blockerId, receiverId), eq(userBlocks.blockedId, user.id)))).limit(1); if (blocked) return NextResponse.json({ message: "Личные сообщения недоступны из-за блокировки." }, { status: 403 });
  const [privacy] = await database.select({ directMessages: userPrivacySettings.directMessages }).from(userPrivacySettings).where(eq(userPrivacySettings.userId, receiverId)).limit(1);
  if (privacy?.directMessages === false) {
    const [friend] = await database.select({ friendId: friends.friendId }).from(friends).where(and(eq(friends.userId, receiverId), eq(friends.friendId, user.id))).limit(1);
    if (!friend) return NextResponse.json({ message: "Пользователь принимает личные сообщения только от друзей." }, { status: 403 });
  }
  const conversationId = conversationIdFor(user.id, receiverId); const id = randomUUID();
  const storedText = encodeDirectMessage(text || "", attachments);
  await database.transaction(async (tx) => {
    await tx.insert(directConversations).values({ id: conversationId }).onConflictDoUpdate({ target: directConversations.id, set: { updatedAt: new Date() } });
    await tx.insert(directConversationMembers).values([{ conversationId, userId: user.id }, { conversationId, userId: receiverId }]).onConflictDoNothing();
    await tx.insert(directMessages).values({ id, conversationId, senderId: user.id, receiverId, text: storedText });
    const preview = text || (attachments[0]?.type === "audio" ? "🎤 Голосовое сообщение" : attachments[0]?.type === "image" ? "🖼️ Изображение" : attachments[0] ? `📎 ${attachments[0].name}` : "Новое сообщение");
    await tx.insert(notifications).values({ id: randomUUID(), userId: receiverId, actorId: user.id, type: "direct_message", title: "Новое сообщение", body: preview.slice(0, 180), entityType: "conversation", entityId: conversationId });
  });
  return NextResponse.json({ message: { id, conversationId, senderId: user.id, receiverId, text: text || "", attachments, createdAt: new Date().toISOString(), readAt: null } }, { status: 201 });
}
