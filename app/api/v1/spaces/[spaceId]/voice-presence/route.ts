import { createHash } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { RoomServiceClient, TrackSource, type ParticipantInfo } from "livekit-server-sdk";
import { NextResponse } from "next/server";
import { getDatabase } from "@/db/client";
import { channels, members, users, voiceStates } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { getChannelPermissions } from "@/lib/space-permissions";
import { hasPermission, Permission } from "@/lib/permissions";
import { normalizeVoicePresence } from "@/lib/voice-presence";

const BREAKOUTS = new Set(["main", "focus", "social"]);
const LIVEKIT_CACHE_MS = 2500;
const VOICE_STATE_TTL_MS = 90_000;

type LiveSnapshot = Map<string, ParticipantInfo[]>;
type SnapshotCacheEntry = { expiresAt: number; promise: Promise<LiveSnapshot> };
const livekitCache = new Map<string, SnapshotCacheEntry>();

function liveKitService() {
  const url = process.env.LIVEKIT_URL;
  const key = process.env.LIVEKIT_API_KEY;
  const secret = process.env.LIVEKIT_API_SECRET;
  if (!url || !key || !secret) return null;
  const serviceUrl = new URL(url);
  serviceUrl.protocol = "https:";
  return new RoomServiceClient(serviceUrl.origin, key, secret, { requestTimeout: 5, failover: false });
}

async function getLiveSnapshot(spaceId: string, service: RoomServiceClient) {
  const cached = livekitCache.get(spaceId);
  if (cached && cached.expiresAt > Date.now()) return cached.promise;
  const promise = (async () => {
    const rooms = await service.listRooms([]);
    const matching = rooms.filter((room) => {
      if (!room.name.startsWith(`${spaceId}:`)) return false;
      const parts = room.name.split(":");
      return parts.length === 3 && BREAKOUTS.has(parts[2]);
    });
    const entries = await Promise.all(matching.map(async (room) => [
      room.name,
      await service.listParticipants(room.name),
    ] as const));
    return new Map(entries);
  })();
  livekitCache.set(spaceId, { expiresAt: Date.now() + LIVEKIT_CACHE_MS, promise });
  try {
    return await promise;
  } catch (error) {
    livekitCache.delete(spaceId);
    throw error;
  }
}

function metadataFor(participant: ParticipantInfo) {
  try {
    const value = JSON.parse(participant.metadata || "{}") as Record<string, unknown>;
    return {
      avatarUrl: typeof value.avatarUrl === "string" ? value.avatarUrl : null,
      username: typeof value.username === "string" ? value.username : null,
      clanTag: typeof value.clanTag === "string" ? value.clanTag : null,
      clanColor: typeof value.clanColor === "string" ? value.clanColor : null,
    };
  } catch {
    return { avatarUrl: null, username: null, clanTag: null, clanColor: null };
  }
}

function parseRoom(name: string) {
  const [spaceId, channelId, breakout] = name.split(":");
  if (!spaceId || !channelId || !BREAKOUTS.has(breakout)) return null;
  return { spaceId, channelId, breakout: breakout as "main" | "focus" | "social" };
}

export async function GET(request: Request, { params }: { params: Promise<{ spaceId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ message: "Требуется вход." }, { status: 401 });
  const { spaceId } = await params;
  const database = getDatabase();
  const [membership] = await database.select({ userId: members.userId }).from(members).where(and(eq(members.spaceId, spaceId), eq(members.userId, user.id))).limit(1);
  if (!membership) return NextResponse.json({ message: "Нет доступа к сообществу." }, { status: 403 });

  const allVoiceChannels = await database.select({ id: channels.id, userLimit: channels.userLimit }).from(channels).where(and(eq(channels.spaceId, spaceId), inArray(channels.kind, ["voice", "stage"])));
  const permissionRows = await Promise.all(allVoiceChannels.map(async (channel) => ({ channel, state: await getChannelPermissions(channel.id, user.id) })));
  const voiceChannels = permissionRows.filter(({ state }) => state.spaceId === spaceId && hasPermission(state.permissions, Permission.ViewChannels)).map(({ channel }) => channel);
  const limits = Object.fromEntries(voiceChannels.map((channel) => [channel.id, channel.userLimit ?? null]));
  const manage = Object.fromEntries(permissionRows.filter(({ state }) => state.spaceId === spaceId).map(({ channel, state }) => [channel.id, hasPermission(state.permissions, Permission.ManageChannels)]));

  if (!voiceChannels.length) return NextResponse.json({ channels: {}, limits, manage }, { headers: { "cache-control": "private, no-cache" } });
  const service = liveKitService();
  if (!service) return NextResponse.json({ channels: {}, limits, manage }, { headers: { "cache-control": "private, no-cache" } });

  const channelIds = voiceChannels.map((channel) => channel.id);
  const states = await database
    .select({
      channelId: voiceStates.channelId,
      userId: voiceStates.userId,
      breakout: voiceStates.breakout,
      displayName: users.displayName,
      username: users.username,
      avatarUrl: users.avatarUrl,
      selfMuted: voiceStates.selfMuted,
      selfDeafened: voiceStates.selfDeafened,
      streaming: voiceStates.streaming,
      updatedAt: voiceStates.updatedAt,
    })
    .from(voiceStates)
    .innerJoin(users, eq(users.id, voiceStates.userId))
    .where(inArray(voiceStates.channelId, channelIds));

  try {
    const snapshot = await getLiveSnapshot(spaceId, service);
    const allowedRooms = [...snapshot.entries()].filter(([roomName]) => {
      const room = parseRoom(roomName);
      return room?.spaceId === spaceId && channelIds.includes(room.channelId);
    });
    const liveIds = [...new Set(allowedRooms.flatMap(([, participants]) => participants.map((participant) => participant.identity)))];
    const liveProfiles = liveIds.length ? await database.select({
      id: users.id,
      displayName: users.displayName,
      username: users.username,
      avatarUrl: users.avatarUrl,
    }).from(users).where(inArray(users.id, liveIds)) : [];
    const profileById = new Map(liveProfiles.map((profile) => [profile.id, profile]));
    const stateByKey = new Map(states.map((state) => [`${state.channelId}:${state.breakout}:${state.userId}`, state]));
    const liveStateKeys = new Set<string>();

    const byChannel = new Map<string, ReturnType<typeof normalizeVoicePresence>>();
    for (const [roomName, participants] of allowedRooms) {
      const room = parseRoom(roomName);
      if (!room) continue;
      const mapped = participants.map((participant) => {
        const key = `${room.channelId}:${room.breakout}:${participant.identity}`;
        liveStateKeys.add(key);
        const state = stateByKey.get(key);
        const profile = profileById.get(participant.identity);
        const meta = metadataFor(participant);
        const microphone = participant.tracks.find((track) => track.source === TrackSource.MICROPHONE);
        const sharing = participant.tracks.some((track) => track.source === TrackSource.SCREEN_SHARE && !track.muted);
        const attributes = participant.attributes ?? {};
        return {
          id: participant.identity,
          name: state?.displayName || profile?.displayName || participant.name || participant.identity,
          username: state?.username ?? profile?.username ?? meta.username,
          avatarUrl: state?.avatarUrl ?? profile?.avatarUrl ?? meta.avatarUrl,
          clanTag: meta.clanTag,
          clanColor: meta.clanColor,
          breakout: room.breakout,
          muted: state?.selfMuted ?? (!microphone || microphone.muted),
          deafened: attributes.deafened === "true" || state?.selfDeafened === true,
          camera: participant.tracks.some((track) => track.source === TrackSource.CAMERA && !track.muted),
          sharing,
          streaming: state?.streaming || sharing,
          speaking: Boolean(participant.isSpeaking),
        };
      });
      const current = byChannel.get(room.channelId) ?? [];
      byChannel.set(room.channelId, normalizeVoicePresence([...current, ...mapped]));
    }

    const staleBefore = Date.now() - VOICE_STATE_TTL_MS;
    const staleUserIds = states
      .filter((state) => !liveStateKeys.has(`${state.channelId}:${state.breakout}:${state.userId}`) && state.updatedAt.getTime() < staleBefore)
      .map((state) => state.userId);
    if (staleUserIds.length) {
      await database.delete(voiceStates).where(inArray(voiceStates.userId, [...new Set(staleUserIds)]));
    }

    const payload = {
      channels: Object.fromEntries(channelIds.map((channelId) => [channelId, byChannel.get(channelId) ?? []])),
      limits,
      manage,
    };
    const serialized = JSON.stringify(payload);
    const etag = `W/"${createHash("sha1").update(serialized).digest("base64url")}"`;
    if (request.headers.get("if-none-match") === etag) {
      return new NextResponse(null, { status: 304, headers: { etag, "cache-control": "private, no-cache" } });
    }
    return new NextResponse(serialized, {
      status: 200,
      headers: { "content-type": "application/json", etag, "cache-control": "private, no-cache" },
    });
  } catch {
    return NextResponse.json({ channels: {}, limits, manage, message: "Не удалось получить состояние голосовых комнат." }, { status: 503, headers: { "cache-control": "private, no-store" } });
  }
}
