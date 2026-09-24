import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDatabase } from "@/db/client";
import { channels, users, voiceStates, xpEvents } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { getChannelPermissions } from "@/lib/space-permissions";
import { hasPermission, Permission } from "@/lib/permissions";
import { isTrustedMutationRequest } from "@/lib/security-controls";

async function accessVoice(channelId: string) {
  const user = await getCurrentUser();
  if (!user) return { error: NextResponse.json({ code: "UNAUTHENTICATED", message: "Требуется вход." }, { status: 401 }) };
  const db = getDatabase();
  const [channel] = await db.select({ id: channels.id, kind: channels.kind }).from(channels).where(eq(channels.id, channelId)).limit(1);
  if (!channel || !["voice", "stage"].includes(channel.kind)) return { error: NextResponse.json({ code: "NOT_FOUND", message: "Голосовой канал не найден." }, { status: 404 }) };
  const state = await getChannelPermissions(channelId, user.id);
  if (!state.spaceId || !hasPermission(state.permissions, Permission.ViewChannels)) return { error: NextResponse.json({ code: "FORBIDDEN", message: "Голосовой канал недоступен." }, { status: 403 }) };
  return { db, user, state };
}

export async function GET(_: Request, { params }: { params: Promise<{ channelId: string }> }) {
  const { channelId } = await params; const access = await accessVoice(channelId); if ("error" in access) return access.error;
  const participants = await access.db.select({ userId: voiceStates.userId, displayName: users.displayName, username: users.username, avatarUrl: users.avatarUrl, selfMuted: voiceStates.selfMuted, selfDeafened: voiceStates.selfDeafened, streaming: voiceStates.streaming, speaking: voiceStates.speaking, joinedAt: voiceStates.joinedAt }).from(voiceStates).innerJoin(users, eq(users.id, voiceStates.userId)).where(eq(voiceStates.channelId, channelId));
  return NextResponse.json({ participants });
}

export async function POST(request: Request, { params }: { params: Promise<{ channelId: string }> }) {
  if (!isTrustedMutationRequest(request)) return NextResponse.json({ code: "UNTRUSTED_ORIGIN", message: "Запрос отклонён." }, { status: 403 });
  const { channelId } = await params; const access = await accessVoice(channelId); if ("error" in access) return access.error;
  if (!hasPermission(access.state.permissions, Permission.ConnectVoice)) return NextResponse.json({ code: "FORBIDDEN", message: "Нет права подключаться к голосовому каналу." }, { status: 403 });
  await access.db.insert(voiceStates).values({ userId: access.user.id, channelId }).onConflictDoUpdate({ target: voiceStates.userId, set: { channelId, selfMuted: false, selfDeafened: false, streaming: false, speaking: false, joinedAt: new Date(), updatedAt: new Date() } });
  return NextResponse.json({ connected: true, channelId });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ channelId: string }> }) {
  if (!isTrustedMutationRequest(request)) return NextResponse.json({ code: "UNTRUSTED_ORIGIN", message: "Запрос отклонён." }, { status: 403 });
  const { channelId } = await params; const access = await accessVoice(channelId); if ("error" in access) return access.error;
  const body = await request.json().catch(() => null);
  const [current] = await access.db.select().from(voiceStates).where(and(eq(voiceStates.userId, access.user.id), eq(voiceStates.channelId, channelId))).limit(1);
  if (!current) return NextResponse.json({ code: "NOT_CONNECTED", message: "Сначала подключитесь к голосовому каналу." }, { status: 409 });
  const streaming = typeof body?.streaming === "boolean" ? body.streaming : current.streaming;
  const speakingState = typeof body?.speaking === "boolean" ? body.speaking : current.speaking;
  if (streaming && !hasPermission(access.state.permissions, Permission.Stream)) return NextResponse.json({ code: "FORBIDDEN", message: "Нет права запускать трансляцию." }, { status: 403 });
  const speaking = body?.selfMuted === false;
  if (speaking && !hasPermission(access.state.permissions, Permission.SpeakVoice)) return NextResponse.json({ code: "FORBIDDEN", message: "Нет права говорить в этом канале." }, { status: 403 });
  await access.db.update(voiceStates).set({ selfMuted: typeof body?.selfMuted === "boolean" ? body.selfMuted : current.selfMuted, selfDeafened: typeof body?.selfDeafened === "boolean" ? body.selfDeafened : current.selfDeafened, streaming, speaking: speakingState, updatedAt: new Date() }).where(eq(voiceStates.userId, access.user.id));
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ channelId: string }> }) {
  if (!isTrustedMutationRequest(request)) return NextResponse.json({ code: "UNTRUSTED_ORIGIN", message: "Запрос отклонён." }, { status: 403 });
  const { channelId } = await params; const access = await accessVoice(channelId); if ("error" in access) return access.error;
  await access.db.transaction(async tx=>{
    const [session]=await tx.delete(voiceStates).where(and(eq(voiceStates.userId, access.user.id), eq(voiceStates.channelId, channelId))).returning({joinedAt:voiceStates.joinedAt});
    if(session){const minutes=Math.min(120,Math.floor((Date.now()-session.joinedAt.getTime())/60_000));if(minutes>0)await tx.insert(xpEvents).values({id:randomUUID(),userId:access.user.id,spaceId:access.state.spaceId,source:"voice_minute",amount:minutes,idempotencyKey:`voice:${access.user.id}:${channelId}:${session.joinedAt.toISOString()}`}).onConflictDoNothing()}
  });
  return NextResponse.json({ connected: false });
}
