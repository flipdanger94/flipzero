import { createHash, randomUUID } from "node:crypto";
import { and, eq, or } from "drizzle-orm";
import { AccessToken, TrackSource } from "livekit-server-sdk";
import { NextResponse } from "next/server";
import { getDatabase } from "@/db/client";
import { directCallSessions, notifications } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { canDirectCall } from "@/lib/direct-call";
import { isTrustedMutationRequest } from "@/lib/security-controls";

const RING_TIMEOUT_MS = 40_000;

export async function POST(request: Request) {
  if (!isTrustedMutationRequest(request)) return NextResponse.json({ message: "Запрос отклонён." }, { status: 403 });
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ message: "Требуется вход." }, { status: 401 });
  const body = await request.json().catch(() => null);
  const requestedCallId = typeof body?.callId === "string" ? body.callId : "";
  const requestedReceiverId = typeof body?.receiverId === "string" ? body.receiverId : "";
  const requestedVideo = Boolean(body?.video);
  const db = getDatabase();

  let callId = requestedCallId;
  let receiverId = requestedReceiverId;
  let callerId = user.id;
  let video = requestedVideo;
  let room = "";
  let created = false;

  if (requestedCallId) {
    const [session] = await db.select().from(directCallSessions).where(and(
      eq(directCallSessions.id, requestedCallId),
      or(eq(directCallSessions.callerId, user.id), eq(directCallSessions.receiverId, user.id)),
    )).limit(1);
    if (!session) return NextResponse.json({ code: "CALL_NOT_FOUND", message: "Звонок больше недоступен." }, { status: 404 });

    const expired = session.status === "ringing" && session.expiresAt.getTime() <= Date.now();
    if (expired || ["declined", "cancelled", "ended"].includes(session.status)) {
      return NextResponse.json({ code: "CALL_ENDED", message: expired ? "Время ожидания звонка истекло." : "Звонок уже завершён." }, { status: 410 });
    }

    callerId = session.callerId;
    receiverId = session.receiverId;
    video = session.video;
    room = session.room;
    const permission = await canDirectCall(callerId, receiverId);
    if (!permission.ok) return NextResponse.json({ code: "CALL_FORBIDDEN", message: permission.message }, { status: permission.status });

    if (user.id === receiverId && session.status === "ringing") {
      await db.update(directCallSessions).set({
        status: "accepted",
        answeredAt: new Date(),
        updatedAt: new Date(),
      }).where(eq(directCallSessions.id, callId));
    }
  } else {
    if (!receiverId) return NextResponse.json({ message: "Собеседник указан неверно." }, { status: 400 });
    const permission = await canDirectCall(user.id, receiverId);
    if (!permission.ok) return NextResponse.json({ code: "CALL_FORBIDDEN", message: permission.message }, { status: permission.status });

    room = "dm:" + createHash("sha256").update([user.id, receiverId].sort().join(":")).digest("hex").slice(0, 32);
    callId = randomUUID();
    const now = new Date();
    await db.insert(directCallSessions).values({
      id: callId,
      callerId: user.id,
      receiverId,
      room,
      video,
      status: "ringing",
      expiresAt: new Date(now.getTime() + RING_TIMEOUT_MS),
      createdAt: now,
      updatedAt: now,
    });
    created = true;
  }

  const url = process.env.LIVEKIT_URL;
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  if (!url || !apiKey || !apiSecret) return NextResponse.json({ code: "VOICE_NOT_CONFIGURED", message: "Сервис звонков пока не настроен." }, { status: 503 });

  const peerId = user.id === callerId ? receiverId : callerId;
  const token = new AccessToken(apiKey, apiSecret, {
    identity: user.id,
    name: user.displayName,
    ttl: "2h",
    metadata: JSON.stringify({ username: user.username, peerId, directCall: true, callId }),
  });
  token.addGrant({
    roomJoin: true,
    room,
    canPublish: true,
    canPublishSources: video ? [TrackSource.MICROPHONE, TrackSource.CAMERA] : [TrackSource.MICROPHONE],
    canSubscribe: true,
  });

  if (created) {
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
  }

  return NextResponse.json({ token: await token.toJwt(), url, room, video, callId, expiresInMs: RING_TIMEOUT_MS });
}
