import { and, eq } from "drizzle-orm";
import { AccessToken } from "livekit-server-sdk";
import { NextResponse } from "next/server";
import { getDatabase } from "@/db/client";
import { channels, members } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";

export async function POST(_: Request, { params }: { params: Promise<{ channelId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ message: "Требуется вход." }, { status: 401 });
  const { channelId } = await params;
  const [channel] = await getDatabase().select({ id: channels.id, spaceId: channels.spaceId }).from(channels).innerJoin(members, and(eq(members.spaceId, channels.spaceId), eq(members.userId, user.id))).where(and(eq(channels.id, channelId), eq(channels.kind, "voice"))).limit(1);
  if (!channel) return NextResponse.json({ message: "Голосовой канал недоступен." }, { status: 403 });
  const url = process.env.LIVEKIT_URL; const apiKey = process.env.LIVEKIT_API_KEY; const apiSecret = process.env.LIVEKIT_API_SECRET;
  if (!url || !apiKey || !apiSecret) return NextResponse.json({ code: "VOICE_NOT_CONFIGURED", message: "Голосовой сервер ещё не подключён." }, { status: 503 });
  const room = `${channel.spaceId}:${channel.id}`;
  const accessToken = new AccessToken(apiKey, apiSecret, { identity: user.id, name: user.displayName, ttl: "2h", metadata: JSON.stringify({ username: user.username, channelId }) });
  accessToken.addGrant({ roomJoin: true, room, canPublish: true, canSubscribe: true });
  return NextResponse.json({ token: await accessToken.toJwt(), url, room });
}
