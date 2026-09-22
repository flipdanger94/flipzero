import { and, eq, inArray } from "drizzle-orm";
import { AccessToken, RoomServiceClient, TrackSource } from "livekit-server-sdk";
import { NextResponse } from "next/server";
import { getDatabase } from "@/db/client";
import { channels, members } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { isTrustedMutationRequest } from "@/lib/security-controls";
import { getChannelPermissions } from "@/lib/space-permissions";
import { hasPermission, Permission } from "@/lib/permissions";
import { getActiveTimeout } from "@/lib/moderation-access";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ channelId: string }> },
) {
  if (!isTrustedMutationRequest(request)) return NextResponse.json({ message: "Запрос отклонён." }, { status: 403 });
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json({ message: "Требуется вход." }, { status: 401 });
  const { channelId } = await params;
  const [channel] = await getDatabase()
    .select({ id: channels.id, spaceId: channels.spaceId })
    .from(channels)
    .innerJoin(
      members,
      and(eq(members.spaceId, channels.spaceId), eq(members.userId, user.id)),
    )
    .where(and(eq(channels.id, channelId), inArray(channels.kind, ["voice", "stage"])))
    .limit(1);
  if (!channel)
    return NextResponse.json(
      { message: "Голосовой канал недоступен." },
      { status: 403 },
    );
  const permissionState = await getChannelPermissions(channelId, user.id);
  if (!permissionState.spaceId || !hasPermission(permissionState.permissions, Permission.ViewChannels) || !hasPermission(permissionState.permissions, Permission.ConnectVoice)) return NextResponse.json({ code: "FORBIDDEN", message: "Нет права подключаться к голосовому каналу." }, { status: 403 });
  const timedOutUntil = permissionState.owner ? null : await getActiveTimeout(channel.spaceId, user.id);
  if (timedOutUntil) return NextResponse.json({ code: "TIMED_OUT", message: `Доступ к голосовым каналам ограничен до ${timedOutUntil.toLocaleString("ru-RU")}.` }, { status: 403 });
  const canSpeak = hasPermission(permissionState.permissions, Permission.SpeakVoice);
  const canStream = hasPermission(permissionState.permissions, Permission.Stream);
  const url = process.env.LIVEKIT_URL;
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  if (!url || !apiKey || !apiSecret)
    return NextResponse.json(
      {
        code: "VOICE_NOT_CONFIGURED",
        message: "Голосовой сервер ещё не подключён.",
      },
      { status: 503 },
    );
  const body = await request.json().catch(() => null);
  const breakout = ["main", "focus", "social"].includes(body?.breakout)
    ? body.breakout
    : "main";
  const room = `${channel.spaceId}:${channel.id}:${breakout}`;
  try {
    const serviceUrl = new URL(url); serviceUrl.protocol = "https:";
    const service = new RoomServiceClient(serviceUrl.origin, apiKey, apiSecret, { requestTimeout: 5, failover: false });
    const rooms = await service.listRooms([]);
    const revokeTokenTs = BigInt(Math.floor(Date.now() / 1000));
    await Promise.all(rooms.filter((item) => item.name.startsWith(`${channel.spaceId}:`) && item.name !== room).map((item) => service.removeParticipant(item.name, user.id, { revokeTokenTs }).catch(() => undefined)));
  } catch {
    return NextResponse.json({ code: "VOICE_SERVICE_UNAVAILABLE", message: "Голосовой сервер временно недоступен." }, { status: 503 });
  }
  const accessToken = new AccessToken(apiKey, apiSecret, {
    identity: user.id,
    name: user.displayName,
    ttl: "2h",
    metadata: JSON.stringify({ username: user.username, channelId }),
  });
  const canPublishSources: TrackSource[] = [];
  if (canSpeak) canPublishSources.push(TrackSource.MICROPHONE);
  if (canStream) canPublishSources.push(TrackSource.CAMERA, TrackSource.SCREEN_SHARE, TrackSource.SCREEN_SHARE_AUDIO);
  accessToken.addGrant({
    roomJoin: true,
    room,
    canPublish: canPublishSources.length > 0,
    canPublishSources,
    canSubscribe: true,
    canPublishData: true,
  });
  return NextResponse.json({ token: await accessToken.toJwt(), url, room, capabilities: { speak: canSpeak, stream: canStream } });
}
