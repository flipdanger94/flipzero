import { and, eq, inArray } from "drizzle-orm";
import { RoomServiceClient, TrackSource } from "livekit-server-sdk";
import { NextResponse } from "next/server";
import { getDatabase } from "@/db/client";
import { channels, members, users, voiceStates } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { getChannelPermissions } from "@/lib/space-permissions";
import { hasPermission, Permission } from "@/lib/permissions";
import { normalizeVoicePresence } from "@/lib/voice-presence";

export async function GET(_request: Request, { params }: { params: Promise<{ spaceId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ message: "Требуется вход." }, { status: 401 });
  const { spaceId } = await params;
  const database = getDatabase();
  const [membership] = await database.select({ userId: members.userId }).from(members).where(and(eq(members.spaceId, spaceId), eq(members.userId, user.id))).limit(1);
  if (!membership) return NextResponse.json({ message: "Нет доступа к сообществу." }, { status: 403 });

  const allVoiceChannels = await database.select({ id: channels.id, userLimit: channels.userLimit }).from(channels).where(and(eq(channels.spaceId, spaceId), inArray(channels.kind, ["voice", "stage"])));
  const permissionRows = await Promise.all(allVoiceChannels.map(async (channel) => ({ channel, state: await getChannelPermissions(channel.id, user.id) })));
  const voiceChannels = permissionRows.filter(({ state }) => state.spaceId === spaceId && hasPermission(state.permissions, Permission.ViewChannels)).map(({ channel }) => channel);
  const url = process.env.LIVEKIT_URL; const key = process.env.LIVEKIT_API_KEY; const secret = process.env.LIVEKIT_API_SECRET;
  if (!url || !key || !secret || !voiceChannels.length) return NextResponse.json({ channels: {}, limits: {} }, { headers: { "cache-control": "no-store" } });

  const channelIds = voiceChannels.map((channel) => channel.id);
  const states = await database
    .select({
      channelId: voiceStates.channelId,
      userId: voiceStates.userId,
      displayName: users.displayName,
      username: users.username,
      avatarUrl: users.avatarUrl,
      selfMuted: voiceStates.selfMuted,
      selfDeafened: voiceStates.selfDeafened,
      streaming: voiceStates.streaming,
      speaking: voiceStates.speaking,
    })
    .from(voiceStates)
    .innerJoin(users, eq(users.id, voiceStates.userId))
    .where(inArray(voiceStates.channelId, channelIds));

  const stateByChannel = new Map<string, Map<string, (typeof states)[number]>>();
  for (const row of states) {
    const map = stateByChannel.get(row.channelId) ?? new Map<string, (typeof states)[number]>();
    map.set(row.userId, row);
    stateByChannel.set(row.channelId, map);
  }

  try {
    const serviceUrl = new URL(url); serviceUrl.protocol = "https:";
    const service = new RoomServiceClient(serviceUrl.origin, key, secret, { requestTimeout: 5, failover: false });
    const result = await Promise.all(voiceChannels.map(async (channel) => {
      const participants = await service.listParticipants(`${spaceId}:${channel.id}:main`).catch(() => []);
      const stateMap = stateByChannel.get(channel.id) ?? new Map();
      return [channel.id, normalizeVoicePresence(participants.map((participant) => {
        const state = stateMap.get(participant.identity);
        const microphone = participant.tracks.find((track) => track.source === TrackSource.MICROPHONE);
        const sharing = participant.tracks.some((track) => track.source === TrackSource.SCREEN_SHARE && !track.muted);
        return {
          id: participant.identity,
          name: state?.displayName || participant.name || participant.identity,
          username: state?.username ?? null,
          avatarUrl: state?.avatarUrl ?? null,
          muted: state?.selfMuted ?? (!microphone || microphone.muted),
          deafened: state?.selfDeafened ?? false,
          camera: participant.tracks.some((track) => track.source === TrackSource.CAMERA && !track.muted),
          sharing,
          streaming: state?.streaming || sharing,
          speaking: state?.speaking ?? false,
        };
      }))] as const;
    }));
    return NextResponse.json({
      channels: Object.fromEntries(result),
      limits: Object.fromEntries(voiceChannels.map((channel) => [channel.id, channel.userLimit ?? null])),
    }, { headers: { "cache-control": "no-store" } });
  } catch {
    return NextResponse.json({ channels: {}, limits: {}, message: "Не удалось получить состояние голосовых комнат." }, { status: 503, headers: { "cache-control": "no-store" } });
  }
}
