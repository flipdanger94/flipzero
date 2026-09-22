import { and, eq, inArray } from "drizzle-orm";
import { RoomServiceClient, TrackSource } from "livekit-server-sdk";
import { NextResponse } from "next/server";
import { getDatabase } from "@/db/client";
import { channels, members } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { getSpaceChannelPermissions } from "@/lib/space-permissions";
import { hasPermission, Permission } from "@/lib/permissions";

export async function GET(_request: Request, { params }: { params: Promise<{ spaceId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ message: "Требуется вход." }, { status: 401 });
  const { spaceId } = await params;
  const database = getDatabase();
  const [membership] = await database.select({ userId: members.userId }).from(members).where(and(eq(members.spaceId, spaceId), eq(members.userId, user.id))).limit(1);
  if (!membership) return NextResponse.json({ message: "Нет доступа к сообществу." }, { status: 403 });

  const allVoiceChannels = await database.select({ id: channels.id }).from(channels).where(and(eq(channels.spaceId, spaceId), inArray(channels.kind, ["voice", "stage"])));
  const permissionMap = await getSpaceChannelPermissions(spaceId, user.id, allVoiceChannels.map((channel) => channel.id));
  const voiceChannels = allVoiceChannels.filter((channel) => hasPermission(permissionMap.get(channel.id) ?? 0, Permission.ViewChannels));
  const url = process.env.LIVEKIT_URL; const key = process.env.LIVEKIT_API_KEY; const secret = process.env.LIVEKIT_API_SECRET;
  if (!url || !key || !secret || !voiceChannels.length) return NextResponse.json({ channels: {} }, { headers: { "cache-control": "no-store" } });

  try {
    const serviceUrl = new URL(url); serviceUrl.protocol = "https:";
    const service = new RoomServiceClient(serviceUrl.origin, key, secret, { requestTimeout: 5, failover: false });
    const result = await Promise.all(voiceChannels.map(async (channel) => {
      const participants = await service.listParticipants(`${spaceId}:${channel.id}:main`).catch(() => []);
      return [channel.id, participants.map((participant) => {
        const microphone = participant.tracks.find((track) => track.source === TrackSource.MICROPHONE);
        return { id: participant.identity, name: participant.name || participant.identity, muted: !microphone || microphone.muted, camera: participant.tracks.some((track) => track.source === TrackSource.CAMERA && !track.muted), sharing: participant.tracks.some((track) => track.source === TrackSource.SCREEN_SHARE && !track.muted), speaking: false };
      })] as const;
    }));
    return NextResponse.json({ channels: Object.fromEntries(result) }, { headers: { "cache-control": "no-store" } });
  } catch {
    return NextResponse.json({ channels: {}, message: "Не удалось получить состояние голосовых комнат." }, { status: 503, headers: { "cache-control": "no-store" } });
  }
}
