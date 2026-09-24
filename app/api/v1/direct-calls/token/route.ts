import { createHash, randomUUID } from "node:crypto";
import { and, eq, or } from "drizzle-orm";
import { AccessToken, TrackSource } from "livekit-server-sdk";
import { NextResponse } from "next/server";
import { getDatabase } from "@/db/client";
import { directCallSessions, friends, notifications, userBlocks, userPrivacySettings, users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { isTrustedMutationRequest } from "@/lib/security-controls";

export async function POST(request: Request) {
  if (!isTrustedMutationRequest(request)) return NextResponse.json({ message: "Запрос отклонён." }, { status: 403 });
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ message: "Требуется вход." }, { status: 401 });
  const body = await request.json().catch(() => null);
  const receiverId = String(body?.receiverId ?? "");
  const video = Boolean(body?.video);
  if (!receiverId || receiverId === user.id) return NextResponse.json({ message: "Собеседник указан неверно." }, { status: 400 });

  const db = getDatabase();
  const [receiver] = await db.select({ id: users.id }).from(users).where(eq(users.id, receiverId)).limit(1);
  if (!receiver) return NextResponse.json({ message: "Пользователь не найден." }, { status: 404 });
  const [blocked] = await db.select({ blockerId: userBlocks.blockerId }).from(userBlocks).where(or(
    and(eq(userBlocks.blockerId, user.id), eq(userBlocks.blockedId, receiverId)),
    and(eq(userBlocks.blockerId, receiverId), eq(userBlocks.blockedId, user.id)),
  )).limit(1);
  if (blocked) return NextResponse.json({ message: "Звонок недоступен из-за блокировки." }, { status: 403 });
  const [privacy] = await db.select({ directMessages: userPrivacySettings.directMessages }).from(userPrivacySettings).where(eq(userPrivacySettings.userId, receiverId)).limit(1);
  if (privacy?.directMessages === false) {
    const [friend] = await db.select({ friendId: friends.friendId }).from(friends).where(and(eq(friends.userId, receiverId), eq(friends.friendId, user.id))).limit(1);
    if (!friend) return NextResponse.json({ message: "Пользователь принимает звонки только от друзей." }, { status: 403 });
  }

  const url = process.env.LIVEKIT_URL;
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  if (!url || !apiKey || !apiSecret) return NextResponse.json({ code: "VOICE_NOT_CONFIGURED", message: "Сервис звонков пока не настроен." }, { status: 503 });

  const room = "dm:" + createHash("sha256").update([user.id, receiverId].sort().join(":")).digest("hex").slice(0, 32);
  const token = new AccessToken(apiKey, apiSecret, {
    identity: user.id,
    name: user.displayName,
    ttl: "2m",
    metadata: JSON.stringify({ username: user.username, receiverId, directCall: true }),
  });
  token.addGrant({
    roomJoin: true,
    room,
    canPublish: true,
    canPublishSources: video ? [TrackSource.MICROPHONE, TrackSource.CAMERA] : [TrackSource.MICROPHONE],
    canSubscribe: true,
  });

  const callId=randomUUID();
  const expiresAt=new Date(Date.now()+40_000);
  await db.update(directCallSessions).set({status:"cancelled",endedAt:new Date()})
    .where(and(eq(directCallSessions.callerId,user.id),eq(directCallSessions.receiverId,receiverId),eq(directCallSessions.status,"ringing")));
  await db.insert(directCallSessions).values({
    id:callId,
    roomName:room,
    callerId:user.id,
    receiverId,
    video,
    status:"ringing",
    expiresAt,
  });
  await db.insert(notifications).values({
    id: randomUUID(),
    userId: receiverId,
    actorId: user.id,
    type: "direct_call",
    title: video ? "Входящий видеозвонок" : "Входящий звонок",
    body: `${user.displayName} звонит вам в FlipZero.`,
    entityType: "direct_call",
    entityId: callId,
  });

  return NextResponse.json({ token: await token.toJwt(), url, room, video, callId, expiresAt });
}
