import { and, eq } from "drizzle-orm";
import { AccessToken, RoomServiceClient } from "livekit-server-sdk";
import { NextResponse } from "next/server";
import { getDatabase } from "@/db/client";
import { getDatabaseForSpace } from "@/db/topology";
import { channels, clanMembers, clans, members, users, voiceStates } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { isTrustedMutationRequest } from "@/lib/security-controls";
import { getChannelPermissions } from "@/lib/space-permissions";
import { hasPermission, Permission } from "@/lib/permissions";
import { publishSourcesForPermissions } from "@/lib/voice-grants";
import { VOICE_BREAKOUTS } from "@/lib/livekit-voice";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ channelId: string }> },
) {
  if (!isTrustedMutationRequest(request)) return NextResponse.json({ message: "Запрос отклонён." }, { status: 403 });
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ message: "Требуется вход." }, { status: 401 });

  const { channelId } = await params;
  const primary = getDatabase();
  const [channel] = await primary.select({ id: channels.id, spaceId: channels.spaceId })
    .from(channels)
    .innerJoin(members, and(eq(members.spaceId, channels.spaceId), eq(members.userId, user.id)))
    .where(and(eq(channels.id, channelId), eq(channels.kind, "voice")))
    .limit(1);
  if (!channel) return NextResponse.json({ message: "Голосовой канал недоступен." }, { status: 403 });

  const access = await getChannelPermissions(channelId, user.id);
  if (!access.spaceId || !hasPermission(access.permissions, Permission.ViewChannels) || !hasPermission(access.permissions, Permission.ConnectVoice)) {
    return NextResponse.json({ code: "FORBIDDEN", message: "Нет права подключаться к этому голосовому каналу." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const breakout = VOICE_BREAKOUTS.includes(body?.breakout) ? body.breakout : "main";
  const { database } = await getDatabaseForSpace(channel.spaceId);
  const [reservation] = await database.select({ channelId: voiceStates.channelId, breakout: voiceStates.breakout })
    .from(voiceStates).where(eq(voiceStates.userId, user.id)).limit(1);
  if (!reservation || reservation.channelId !== channelId) {
    return NextResponse.json({ code: "VOICE_JOIN_REQUIRED", message: "Сначала зарезервируйте место в голосовом канале." }, { status: 409 });
  }
  if (reservation.breakout !== breakout) {
    await database.update(voiceStates).set({ breakout, lastHeartbeatAt: new Date(), updatedAt: new Date() }).where(eq(voiceStates.userId, user.id));
  }

  const url = process.env.LIVEKIT_URL;
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  if (!url || !apiKey || !apiSecret) return NextResponse.json({ code: "VOICE_NOT_CONFIGURED", message: "Голосовой сервер ещё не подключён." }, { status: 503 });

  const room = `${channel.spaceId}:${channel.id}:${breakout}`;
  try {
    const serviceUrl = new URL(url);
    serviceUrl.protocol = "https:";
    const service = new RoomServiceClient(serviceUrl.origin, apiKey, apiSecret, { requestTimeout: 5, failover: false });
    const rooms = await service.listRooms([]);
    await Promise.all(rooms
      .filter((item) => item.name.startsWith(`${channel.spaceId}:`) && item.name !== room)
      .map((item) => service.removeParticipant(item.name, user.id).catch(() => undefined)));
  } catch {
    return NextResponse.json({ code: "VOICE_SERVICE_UNAVAILABLE", message: "Голосовой сервер временно недоступен." }, { status: 503 });
  }

  const [profile] = await primary.select({
    avatarUrl: users.avatarUrl,
    accentColor: users.accentColor,
    clanTag: clans.tag,
    clanTagColor: clans.tagColor,
  }).from(users)
    .leftJoin(clanMembers, eq(clanMembers.userId, users.id))
    .leftJoin(clans, eq(clans.id, clanMembers.clanId))
    .where(eq(users.id, user.id)).limit(1);

  const accessToken = new AccessToken(apiKey, apiSecret, {
    identity: user.id,
    name: user.displayName,
    ttl: "20m",
    metadata: JSON.stringify({
      username: user.username,
      channelId,
      breakout,
      avatarUrl: profile?.avatarUrl ?? null,
      accentColor: profile?.accentColor ?? null,
      clanTag: profile?.clanTag ?? null,
      clanTagColor: profile?.clanTagColor ?? null,
    }),
  });
  const publishSources = publishSourcesForPermissions(access.permissions);
  accessToken.addGrant({
    roomJoin: true,
    room,
    canPublish: publishSources.length > 0,
    canPublishSources: publishSources,
    canSubscribe: true,
    canUpdateOwnMetadata: true,
  });
  return NextResponse.json({ token: await accessToken.toJwt(), url, room, expiresInSeconds: 1200 });
}
