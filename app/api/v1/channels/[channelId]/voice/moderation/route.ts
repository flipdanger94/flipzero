import { and, eq } from "drizzle-orm";
import { RoomServiceClient, TrackSource } from "livekit-server-sdk";
import { NextResponse } from "next/server";
import { getDatabase } from "@/db/client";
import { voiceStates } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission, Permission } from "@/lib/permissions";
import { isTrustedMutationRequest } from "@/lib/security-controls";
import { getChannelPermissions } from "@/lib/space-permissions";

const BREAKOUTS = ["main", "focus", "social"] as const;

function roomService() {
  const url = process.env.LIVEKIT_URL;
  const key = process.env.LIVEKIT_API_KEY;
  const secret = process.env.LIVEKIT_API_SECRET;
  if (!url || !key || !secret) return null;
  const serviceUrl = new URL(url);
  serviceUrl.protocol = "https:";
  return new RoomServiceClient(serviceUrl.origin, key, secret, { requestTimeout: 5, failover: false });
}

export async function POST(request: Request, { params }: { params: Promise<{ channelId: string }> }) {
  if (!isTrustedMutationRequest(request)) return NextResponse.json({ message: "Запрос отклонён." }, { status: 403 });
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ message: "Требуется вход." }, { status: 401 });
  const { channelId } = await params;
  const access = await getChannelPermissions(channelId, user.id);
  if (!access.spaceId || !hasPermission(access.permissions, Permission.ModerateMembers)) {
    return NextResponse.json({ code: "FORBIDDEN", message: "Нет права модерировать голосовой канал." }, { status: 403 });
  }
  const body = await request.json().catch(() => null);
  const targetUserId = typeof body?.targetUserId === "string" ? body.targetUserId : "";
  const action = body?.action === "mute" || body?.action === "disconnect" ? body.action : null;
  if (!targetUserId || !action) return NextResponse.json({ message: "Некорректное действие." }, { status: 400 });

  const service = roomService();
  if (!service) return NextResponse.json({ code: "VOICE_NOT_CONFIGURED", message: "Голосовой сервер не настроен." }, { status: 503 });
  const database = getDatabase();
  const rooms = BREAKOUTS.map((breakout) => `${access.spaceId}:${channelId}:${breakout}`);

  try {
    if (action === "disconnect") {
      await Promise.all(rooms.map((room) => service.removeParticipant(room, targetUserId).catch(() => undefined)));
      await database.delete(voiceStates).where(and(eq(voiceStates.channelId, channelId), eq(voiceStates.userId, targetUserId)));
      return NextResponse.json({ ok: true, action });
    }

    const muted = body?.muted !== false;
    for (const room of rooms) {
      const participants = await service.listParticipants(room).catch(() => []);
      const target = participants.find((participant) => participant.identity === targetUserId);
      if (!target) continue;
      const microphones = target.tracks.filter((track) => track.source === TrackSource.MICROPHONE);
      await Promise.all(microphones.map((track) => service.mutePublishedTrack(room, targetUserId, track.sid, muted)));
    }
    await database.update(voiceStates).set({ selfMuted: muted, updatedAt: new Date() }).where(and(
      eq(voiceStates.channelId, channelId),
      eq(voiceStates.userId, targetUserId),
    ));
    return NextResponse.json({ ok: true, action, muted });
  } catch {
    return NextResponse.json({ code: "VOICE_SERVICE_UNAVAILABLE", message: "Не удалось выполнить действие модерации." }, { status: 503 });
  }
}
