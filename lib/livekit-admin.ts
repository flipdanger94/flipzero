import "server-only";
import { and, eq, inArray } from "drizzle-orm";
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

export async function evictParticipantsFromSpaceVoice(spaceId: string, userIds: string[]) {
  const ids = [...new Set(userIds.filter(Boolean))];
  if (!ids.length) return;

  const db = getDatabase();
  const activeStates = await db.select({ userId: voiceStates.userId }).from(voiceStates)
    .innerJoin(channels, eq(channels.id, voiceStates.channelId))
    .where(and(eq(channels.spaceId, spaceId), inArray(voiceStates.userId, ids)));
  const activeIds = [...new Set(activeStates.map((state) => state.userId))];
  if (activeIds.length) await db.delete(voiceStates).where(inArray(voiceStates.userId, activeIds));

  const service = getVoiceAdminClient();
  if (!service) return;
  try {
    const rooms = await service.listRooms([]);
    const matchingRooms = rooms.filter((room) => room.name.startsWith(`${spaceId}:`));
    const revokeTokenTs = BigInt(Math.floor(Date.now() / 1000));
    await Promise.allSettled(
      matchingRooms.flatMap((room) =>
        ids.map((userId) => service.removeParticipant(room.name, userId, { revokeTokenTs })),
      ),
    );
  } catch {
    // Voice cleanup must not roll back the primary moderation/member operation.
  }
}

export async function evictParticipantFromSpaceVoice(spaceId: string, userId: string) {
  await evictParticipantsFromSpaceVoice(spaceId, [userId]);
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
