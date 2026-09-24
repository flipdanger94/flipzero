import { createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { TrackSource, WebhookReceiver } from "livekit-server-sdk";
import { getDatabaseForSpace } from "@/db/topology";
import { livekitWebhookEvents, voiceStates } from "@/db/schema";
import { isScreenSource, parseSpaceVoiceRoom } from "@/lib/livekit-voice";

function receiver() {
  const key = process.env.LIVEKIT_API_KEY;
  const secret = process.env.LIVEKIT_API_SECRET;
  if (!key || !secret) return null;
  return new WebhookReceiver(key, secret);
}

export async function POST(request: Request) {
  const webhookReceiver = receiver();
  if (!webhookReceiver) return NextResponse.json({ code: "VOICE_NOT_CONFIGURED" }, { status: 503 });

  const body = await request.text();
  const authorization = request.headers.get("authorization") ?? "";
  let event;
  try {
    event = await webhookReceiver.receive(body, authorization);
  } catch {
    return NextResponse.json({ code: "INVALID_SIGNATURE" }, { status: 401 });
  }

  const roomName = event.room?.name ?? "";
  const parsed = parseSpaceVoiceRoom(roomName);
  if (!parsed) return NextResponse.json({ ok: true, ignored: true });

  const eventId = event.id || createHash("sha256").update(body).digest("hex");
  const { database } = await getDatabaseForSpace(parsed.spaceId);
  const handled = await database.transaction(async (tx) => {
    const [inserted] = await tx.insert(livekitWebhookEvents).values({
      id: eventId,
      eventType: event.event,
      roomName,
    }).onConflictDoNothing().returning({ id: livekitWebhookEvents.id });
    if (!inserted) return false;

    const participantId = event.participant?.identity;
    if (event.event === "participant_joined" && participantId) {
      await tx.insert(voiceStates).values({
        userId: participantId,
        channelId: parsed.channelId,
        breakout: parsed.breakout,
        joinedAt: new Date(),
        lastHeartbeatAt: new Date(),
        updatedAt: new Date(),
      }).onConflictDoUpdate({
        target: voiceStates.userId,
        set: {
          channelId: parsed.channelId,
          breakout: parsed.breakout,
          lastHeartbeatAt: new Date(),
          updatedAt: new Date(),
        },
      });
    } else if (event.event === "participant_left" && participantId) {
      await tx.delete(voiceStates).where(and(eq(voiceStates.userId, participantId), eq(voiceStates.channelId, parsed.channelId)));
    } else if ((event.event === "track_published" || event.event === "track_unpublished") && participantId) {
      const source = event.track?.source as TrackSource | undefined;
      if (isScreenSource(source)) {
        await tx.update(voiceStates).set({
          streaming: event.event === "track_published",
          updatedAt: new Date(),
        }).where(and(eq(voiceStates.userId, participantId), eq(voiceStates.channelId, parsed.channelId)));
      }
      if (source === TrackSource.MICROPHONE && event.event === "track_published") {
        await tx.update(voiceStates).set({ selfMuted: Boolean(event.track?.muted), updatedAt: new Date() })
          .where(and(eq(voiceStates.userId, participantId), eq(voiceStates.channelId, parsed.channelId)));
      }
    } else if (event.event === "room_finished") {
      await tx.delete(voiceStates).where(and(eq(voiceStates.channelId, parsed.channelId), eq(voiceStates.breakout, parsed.breakout)));
    }
    return true;
  });

  return NextResponse.json({ ok: true, duplicate: !handled });
}
