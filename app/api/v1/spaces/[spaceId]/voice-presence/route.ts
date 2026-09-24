import { createHash } from "node:crypto";
import { and, eq, inArray, lt } from "drizzle-orm";
import { RoomServiceClient, TrackSource } from "livekit-server-sdk";
import { NextResponse } from "next/server";
import { getDatabase } from "@/db/client";
import { getDatabaseForSpace } from "@/db/topology";
import { channels, clanMembers, clans, members, users, voiceStates } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { getChannelPermissions } from "@/lib/space-permissions";
import { hasPermission, Permission } from "@/lib/permissions";
import { normalizeVoicePresence, type VoicePresence } from "@/lib/voice-presence";
import { parseSpaceVoiceRoom } from "@/lib/livekit-voice";

type LiveParticipant = {
  identity: string;
  name?: string;
  metadata?: string;
  tracks: Array<{ source?: TrackSource; muted?: boolean }>;
};

type CachedRooms = {
  expiresAt: number;
  byChannel: Record<string, Array<{ participant: LiveParticipant; breakout: "main" | "focus" | "social" }>>;
};

const liveCache = new Map<string, CachedRooms>();
const LIVE_CACHE_MS = 3_000;
const STALE_STATE_MS = 90_000;

async function liveParticipantsForSpace(spaceId: string, channelIds: Set<string>) {
  const cached = liveCache.get(spaceId);
  if (cached && cached.expiresAt > Date.now()) return cached.byChannel;

  const url = process.env.LIVEKIT_URL;
  const key = process.env.LIVEKIT_API_KEY;
  const secret = process.env.LIVEKIT_API_SECRET;
  if (!url || !key || !secret) return {};

  const serviceUrl = new URL(url);
  serviceUrl.protocol = "https:";
  const service = new RoomServiceClient(serviceUrl.origin, key, secret, { requestTimeout: 5, failover: false });
  const rooms = await service.listRooms([]);
  const matching = rooms
    .map((room) => ({ room, parsed: parseSpaceVoiceRoom(room.name) }))
    .filter((entry) => entry.parsed?.spaceId === spaceId && channelIds.has(entry.parsed.channelId));

  const byChannel: CachedRooms["byChannel"] = {};
  await Promise.all(matching.map(async ({ room, parsed }) => {
    if (!parsed) return;
    const participants = await service.listParticipants(room.name).catch(() => []);
    const bucket = byChannel[parsed.channelId] ?? [];
    for (const participant of participants) bucket.push({
      participant: participant as LiveParticipant,
      breakout: parsed.breakout,
    });
    byChannel[parsed.channelId] = bucket;
  }));

  liveCache.set(spaceId, { expiresAt: Date.now() + LIVE_CACHE_MS, byChannel });
  return byChannel;
}

export async function GET(request: Request, { params }: { params: Promise<{ spaceId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ message: "Требуется вход." }, { status: 401 });
  const { spaceId } = await params;

  const primary = getDatabase();
  const [membership] = await primary.select({ userId: members.userId }).from(members)
    .where(and(eq(members.spaceId, spaceId), eq(members.userId, user.id))).limit(1);
  if (!membership) return NextResponse.json({ message: "Нет доступа к сообществу." }, { status: 403 });

  const allVoiceChannels = await primary.select({ id: channels.id, userLimit: channels.userLimit }).from(channels)
    .where(and(eq(channels.spaceId, spaceId), inArray(channels.kind, ["voice", "stage"])));
  const permissionRows = await Promise.all(allVoiceChannels.map(async (channel) => ({
    channel,
    state: await getChannelPermissions(channel.id, user.id),
  })));
  const voiceChannels = permissionRows
    .filter(({ state }) => state.spaceId === spaceId && hasPermission(state.permissions, Permission.ViewChannels))
    .map(({ channel }) => channel);
  const limits = Object.fromEntries(voiceChannels.map((channel) => [channel.id, channel.userLimit ?? null]));
  const manage = Object.fromEntries(permissionRows
    .filter(({ state }) => state.spaceId === spaceId)
    .map(({ channel, state }) => [channel.id, hasPermission(state.permissions, Permission.ManageChannels)]));

  if (!voiceChannels.length) return NextResponse.json({ channels: {}, limits, manage }, { headers: { "cache-control": "private, no-cache" } });

  const { database } = await getDatabaseForSpace(spaceId);
  const channelIds = voiceChannels.map((channel) => channel.id);
  const states = await database.select({
    channelId: voiceStates.channelId,
    userId: voiceStates.userId,
    breakout: voiceStates.breakout,
    displayName: users.displayName,
    username: users.username,
    avatarUrl: users.avatarUrl,
    accentColor: users.accentColor,
    clanTag: clans.tag,
    clanTagColor: clans.tagColor,
    selfMuted: voiceStates.selfMuted,
    selfDeafened: voiceStates.selfDeafened,
    streaming: voiceStates.streaming,
    speaking: voiceStates.speaking,
    lastHeartbeatAt: voiceStates.lastHeartbeatAt,
  }).from(voiceStates)
    .innerJoin(users, eq(users.id, voiceStates.userId))
    .leftJoin(clanMembers, eq(clanMembers.userId, users.id))
    .leftJoin(clans, eq(clans.id, clanMembers.clanId))
    .where(inArray(voiceStates.channelId, channelIds));

  let liveByChannel: CachedRooms["byChannel"];
  try {
    liveByChannel = await liveParticipantsForSpace(spaceId, new Set(channelIds));
  } catch {
    return NextResponse.json({ channels: {}, limits, manage, message: "Не удалось получить состояние голосовых комнат." }, { status: 503, headers: { "cache-control": "private, no-cache" } });
  }

  const liveIds = new Set(Object.values(liveByChannel).flat().map((entry) => entry.participant.identity));
  const staleCutoff = new Date(Date.now() - STALE_STATE_MS);
  const staleIds = states.filter((state) => !liveIds.has(state.userId) && state.lastHeartbeatAt < staleCutoff).map((state) => state.userId);
  if (staleIds.length) {
    await database.delete(voiceStates).where(and(inArray(voiceStates.userId, staleIds), lt(voiceStates.lastHeartbeatAt, staleCutoff))).catch(() => undefined);
  }

  const stateByUser = new Map(states.map((state) => [state.userId, state]));
  const output: Record<string, VoicePresence[]> = {};
  for (const channel of voiceChannels) {
    output[channel.id] = normalizeVoicePresence((liveByChannel[channel.id] ?? []).map(({ participant, breakout }) => {
      const state = stateByUser.get(participant.identity);
      const microphone = participant.tracks.find((track) => track.source === TrackSource.MICROPHONE);
      const sharing = participant.tracks.some((track) => track.source === TrackSource.SCREEN_SHARE && !track.muted);
      return {
        id: participant.identity,
        name: state?.displayName || participant.name || participant.identity,
        username: state?.username ?? null,
        avatarUrl: state?.avatarUrl ?? null,
        clanTag: state?.clanTag ?? null,
        clanTagColor: state?.clanTagColor ?? null,
        accentColor: state?.accentColor ?? null,
        breakout,
        muted: state?.selfMuted ?? (!microphone || Boolean(microphone.muted)),
        deafened: state?.selfDeafened ?? false,
        camera: participant.tracks.some((track) => track.source === TrackSource.CAMERA && !track.muted),
        sharing,
        streaming: Boolean(state?.streaming || sharing),
        speaking: false,
      };
    }));
  }

  const payload = JSON.stringify({ channels: output, limits, manage });
  const etag = `"${createHash("sha1").update(payload).digest("hex")}"`;
  if (request.headers.get("if-none-match") === etag) {
    return new NextResponse(null, { status: 304, headers: { etag, "cache-control": "private, no-cache" } });
  }
  return new NextResponse(payload, {
    status: 200,
    headers: { "content-type": "application/json; charset=utf-8", etag, "cache-control": "private, no-cache" },
  });
}
