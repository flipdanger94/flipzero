import "server-only";
import { and, eq } from "drizzle-orm";
import { RoomServiceClient } from "livekit-server-sdk";
import { getDatabase } from "@/db/client";
import { channels, voiceStates } from "@/db/schema";

function getVoiceAdminClient() {
  const url = process.env.LIVEKIT_URL;
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  if (!url || !apiKey || !apiSecret) return null;
  const serviceUrl = new URL(url);
  serviceUrl.protocol = "https:";
  return new RoomServiceClient(serviceUrl.origin, apiKey, apiSecret, { requestTimeout: 5, failover: false });
}

export async function evictParticipantFromSpaceVoice(spaceId: string, userId: string) {
  const db = getDatabase();
  const [state] = await db.select({ channelId: voiceStates.channelId }).from(voiceStates)
    .innerJoin(channels, eq(channels.id, voiceStates.channelId))
    .where(and(eq(voiceStates.userId, userId), eq(channels.spaceId, spaceId)))
    .limit(1);
  if (state) await db.delete(voiceStates).where(eq(voiceStates.userId, userId));


  const service = getVoiceAdminClient();
  if (!service) return;
  try {
    const rooms = await service.listRooms([]);
    await Promise.allSettled(
      rooms
        .filter((room) => room.name.startsWith(`${spaceId}:`))
        .map((room) => service.removeParticipant(room.name, userId, { revokeTokenTs: BigInt(Math.floor(Date.now() / 1000)) })),
    );
  } catch {
    // Voice cleanup must not roll back the primary moderation/member operation.
  }
}


export async function resetChannelVoiceRooms(spaceId: string, channelId: string) {
  const db = getDatabase();
  await db.delete(voiceStates).where(eq(voiceStates.channelId, channelId));
  const service = getVoiceAdminClient();
  if (!service) return;
  try {
    const prefix = `${spaceId}:${channelId}:`;
    const rooms = await service.listRooms([]);
    await Promise.allSettled(
      rooms.filter((room) => room.name.startsWith(prefix)).map((room) => service.deleteRoom(room.name)),
    );
  } catch {
    // Permission changes still persist even if LiveKit is temporarily unavailable.
  }
}

export async function deleteSpaceVoiceRooms(spaceId: string) {
  const service = getVoiceAdminClient();
  if (!service) return;
  try {
    const rooms = await service.listRooms([]);
    await Promise.allSettled(
      rooms.filter((room) => room.name.startsWith(`${spaceId}:`)).map((room) => service.deleteRoom(room.name)),
    );
  } catch {
    // Deleting the database space remains authoritative.
  }
}
