import { randomUUID } from "node:crypto";
import { and, desc, eq, or } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDatabase } from "@/db/client";
import { friendRequests, friends, notifications, userBlocks, userPrivacySettings, users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  const user = await getCurrentUser(); if (!user) return NextResponse.json({ message: "Требуется вход." }, { status: 401 });
  const database = getDatabase();
  const blockRows=await database.select({blockerId:userBlocks.blockerId,blockedId:userBlocks.blockedId}).from(userBlocks).where(or(eq(userBlocks.blockerId,user.id),eq(userBlocks.blockedId,user.id)));
  const blockedIds=new Set(blockRows.map(row=>row.blockerId===user.id?row.blockedId:row.blockerId));
  const links = (await database.select().from(friends).where(eq(friends.userId, user.id))).filter(link=>!blockedIds.has(link.friendId));
  const pending = (await database.select().from(friendRequests).where(and(eq(friendRequests.toId, user.id), eq(friendRequests.status, "pending"))).orderBy(desc(friendRequests.createdAt))).filter(item=>!blockedIds.has(item.fromId));
  const friendUsers = await Promise.all(links.map(async (link) => (await database.select({ id: users.id, username: users.username, displayName: users.displayName, avatarUrl: users.avatarUrl, presence: users.presence }).from(users).where(eq(users.id, link.friendId)).limit(1))[0]));
  const requests = await Promise.all(pending.map(async (request) => ({ ...request, from: (await database.select({ id: users.id, username: users.username, displayName: users.displayName, avatarUrl: users.avatarUrl }).from(users).where(eq(users.id, request.fromId)).limit(1))[0] })));
  return NextResponse.json({ friends: friendUsers.filter(Boolean), requests, unreadRequests: requests.length });
}

export async function POST(request: Request) {
  const user = await getCurrentUser(); if (!user) return NextResponse.json({ message: "Требуется вход." }, { status: 401 });
  const body = await request.json().catch(() => null); const toId = String(body?.toId ?? "");
  if (!toId || toId === user.id) return NextResponse.json({ message: "Некорректный пользователь." }, { status: 400 });
  const database = getDatabase();
  const [target] = await database.select({ id: users.id }).from(users).where(eq(users.id, toId)).limit(1); if (!target) return NextResponse.json({ message: "Пользователь не найден." }, { status: 404 });
  const [blocked] = await database.select().from(userBlocks).where(or(and(eq(userBlocks.blockerId, user.id), eq(userBlocks.blockedId, toId)), and(eq(userBlocks.blockerId, toId), eq(userBlocks.blockedId, user.id)))).limit(1); if (blocked) return NextResponse.json({ message: "Заявка в друзья недоступна из-за блокировки." }, { status: 403 });
  const [privacy] = await database.select({ friendRequests: userPrivacySettings.friendRequests }).from(userPrivacySettings).where(eq(userPrivacySettings.userId, toId)).limit(1); if (privacy?.friendRequests === false) return NextResponse.json({ message: "Пользователь отключил запросы в друзья." }, { status: 403 });
  const [existingFriend] = await database.select().from(friends).where(and(eq(friends.userId, user.id), eq(friends.friendId, toId))).limit(1); if (existingFriend) return NextResponse.json({ message: "Пользователь уже в друзьях." }, { status: 409 });
  const reverse = await database.select().from(friendRequests).where(and(eq(friendRequests.fromId, toId), eq(friendRequests.toId, user.id), eq(friendRequests.status, "pending"))).limit(1);
  if (reverse[0]) return acceptRequest(database, reverse[0].id, user.id, toId);
  const [sameDirection]=await database.select({id:friendRequests.id}).from(friendRequests).where(and(eq(friendRequests.fromId,user.id),eq(friendRequests.toId,toId),eq(friendRequests.status,"pending"))).limit(1);
  if(sameDirection)return NextResponse.json({status:"pending",requestId:sameDirection.id});
  const requestId=randomUUID(); await database.transaction(async tx=>{await tx.insert(friendRequests).values({id:requestId,fromId:user.id,toId}).onConflictDoUpdate({target:[friendRequests.fromId,friendRequests.toId],set:{status:"pending",respondedAt:null,createdAt:new Date()}});const [stored]=await tx.select({id:friendRequests.id}).from(friendRequests).where(and(eq(friendRequests.fromId,user.id),eq(friendRequests.toId,toId))).limit(1);await tx.insert(notifications).values({id:randomUUID(),userId:toId,actorId:user.id,type:"friend_request",title:"Новый запрос в друзья",body:`@${user.username} хочет добавить вас в друзья.`,entityType:"friend_request",entityId:stored?.id??requestId});});
  return NextResponse.json({ status: "pending" }, { status: 201 });
}

async function acceptRequest(database: ReturnType<typeof getDatabase>, requestId: string, currentUserId: string, friendId: string) {
  await database.transaction(async (tx) => {
    await tx.update(friendRequests).set({ status: "accepted", respondedAt: new Date() }).where(eq(friendRequests.id, requestId));
    await tx.insert(friends).values([{ userId: currentUserId, friendId }, { userId: friendId, friendId: currentUserId }]).onConflictDoNothing();
    const [actor]=await tx.select({username:users.username}).from(users).where(eq(users.id,currentUserId)).limit(1);
    await tx.insert(notifications).values({id:randomUUID(),userId:friendId,actorId:currentUserId,type:"friend_accepted",title:"Заявка в друзья принята",body:actor?`@${actor.username} теперь у вас в друзьях.`:null,entityType:"user",entityId:currentUserId});
  });
  return NextResponse.json({ status: "accepted" });
}

export async function PATCH(request: Request) {
  const user = await getCurrentUser(); if (!user) return NextResponse.json({ message: "Требуется вход." }, { status: 401 });
  const body = await request.json().catch(() => null); const requestId = String(body?.requestId ?? ""); const status = body?.status;
  if (!requestId || !["accepted", "declined"].includes(status)) return NextResponse.json({ message: "Некорректное действие." }, { status: 400 });
  const database = getDatabase(); const [item] = await database.select().from(friendRequests).where(and(eq(friendRequests.id, requestId), eq(friendRequests.toId, user.id), eq(friendRequests.status, "pending"))).limit(1);
  if (!item) return NextResponse.json({ message: "Заявка не найдена." }, { status: 404 });
  if (status === "accepted") return acceptRequest(database, requestId, user.id, item.fromId);
  await database.update(friendRequests).set({ status: "declined", respondedAt: new Date() }).where(eq(friendRequests.id, requestId)); return NextResponse.json({ status });
}

export async function DELETE(request: Request) {
  const user = await getCurrentUser(); if (!user) return NextResponse.json({ message: "Требуется вход." }, { status: 401 });
  const friendId = new URL(request.url).searchParams.get("friendId") ?? ""; if (!friendId) return NextResponse.json({ message: "Укажите друга." }, { status: 400 });
  await getDatabase().delete(friends).where(or(and(eq(friends.userId, user.id), eq(friends.friendId, friendId)), and(eq(friends.userId, friendId), eq(friends.friendId, user.id))));
  return NextResponse.json({ ok: true });
}
