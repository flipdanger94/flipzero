import { and, eq } from "drizzle-orm";
import { RoomServiceClient, TrackSource } from "livekit-server-sdk";
import { NextResponse } from "next/server";
import { getDatabase } from "@/db/client";
import { getDatabaseForSpace } from "@/db/topology";
import { channels, voiceStates } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission, Permission } from "@/lib/permissions";
import { isTrustedMutationRequest } from "@/lib/security-controls";
import { getChannelPermissions } from "@/lib/space-permissions";

export async function POST(request: Request, { params }: { params: Promise<{ channelId: string }> }) {
  if (!isTrustedMutationRequest(request)) return NextResponse.json({ code: "UNTRUSTED_ORIGIN" }, { status: 403 });
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ code: "UNAUTHENTICATED" }, { status: 401 });
  const { channelId } = await params;
  const [channel] = await getDatabase().select({ spaceId: channels.spaceId }).from(channels).where(eq(channels.id, channelId)).limit(1);
  if (!channel) return NextResponse.json({ code: "NOT_FOUND" }, { status: 404 });

  const access = await getChannelPermissions(channelId, user.id);
  if (!hasPermission(access.permissions, Permission.ManageChannels)) return NextResponse.json({ code: "FORBIDDEN", message: "Недостаточно прав." }, { status: 403 });

  const body = await request.json().catch(() => null);
  const targetUserId = typeof body?.targetUserId === "string" ? body.targetUserId : "";
  const action = body?.action;
  if (!targetUserId || !["mute", "unmute", "disconnect"].includes(action)) return NextResponse.json({ code: "INVALID_INPUT" }, { status: 400 });

  const { database } = await getDatabaseForSpace(channel.spaceId);
  const [state] = await database.select({ breakout: voiceStates.breakout }).from(voiceStates)
    .where(and(eq(voiceStates.userId, targetUserId), eq(voiceStates.channelId, channelId))).limit(1);
  if (!state) return NextResponse.json({ code: "NOT_CONNECTED" }, { status: 409 });

  const url = process.env.LIVEKIT_URL, key = process.env.LIVEKIT_API_KEY, secret = process.env.LIVEKIT_API_SECRET;
  if (!url || !key || !secret) return NextResponse.json({ code: "VOICE_NOT_CONFIGURED" }, { status: 503 });
  const serviceUrl = new URL(url);
  serviceUrl.protocol = "https:";
  const service = new RoomServiceClient(serviceUrl.origin, key, secret, { requestTimeout: 5, failover: false });
  const room = `${channel.spaceId}:${channelId}:${state.breakout}`;

  if (action === "disconnect") {
    await service.removeParticipant(room, targetUserId);
    await database.delete(voiceStates).where(and(eq(voiceStates.userId, targetUserId), eq(voiceStates.channelId, channelId)));
    return NextResponse.json({ ok: true });
  }

  const participants = await service.listParticipants(room);
  const participant = participants.find((item) => item.identity === targetUserId);
  const microphone = participant?.tracks.find((track) => track.source === TrackSource.MICROPHONE);
  if (!microphone?.sid) return NextResponse.json({ code: "MICROPHONE_NOT_PUBLISHED" }, { status: 409 });

  const muted = action === "mute";
  await service.mutePublishedTrack(room, targetUserId, microphone.sid, muted);
  await database.update(voiceStates).set({ selfMuted: muted, speaking: false, updatedAt: new Date() })
    .where(and(eq(voiceStates.userId, targetUserId), eq(voiceStates.channelId, channelId)));
  return NextResponse.json({ ok: true, muted });
}
