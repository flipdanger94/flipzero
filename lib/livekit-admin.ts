import "server-only";
import { RoomServiceClient } from "livekit-server-sdk";

function getVoiceAdminClient() {
  const url = process.env.LIVEKIT_URL;
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  if (!url || !apiKey || !apiSecret) return null;
  const serviceUrl = new URL(url);
  serviceUrl.protocol = "https:";
  return new RoomServiceClient(serviceUrl.origin, apiKey, apiSecret, { requestTimeout: 5, failover: false });
}

export async function removeParticipantFromSpaceVoice(spaceId: string, userId: string) {
  const service = getVoiceAdminClient();
  if (!service) return;
  try {
    const rooms = await service.listRooms([]);
    await Promise.allSettled(
      rooms
        .filter((room) => room.name.startsWith(`${spaceId}:`))
        .map((room) => service.removeParticipant(room.name, userId)),
    );
  } catch {
    // Voice cleanup must not roll back the primary moderation/member operation.
  }
}
