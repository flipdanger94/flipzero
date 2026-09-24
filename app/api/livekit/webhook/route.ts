import { createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { TrackSource, WebhookReceiver } from "livekit-server-sdk";
import { NextResponse } from "next/server";
import { getDatabase } from "@/db/client";
import { livekitWebhookEvents, voiceStates } from "@/db/schema";
import { finalizeVoiceXp } from "@/lib/voice-xp";

const BREAKOUTS = new Set(["main", "focus", "social"]);

function parseChannelRoom(name: string | undefined) {
  if (!name || name.startsWith("dm:") || name.startsWith("clan:")) return null;
  const parts = name.split(":");
  if (parts.length !== 3 || !BREAKOUTS.has(parts[2])) return null;
  return { spaceId: parts[0], channelId: parts[1], breakout: parts[2] as "main" | "focus" | "social" };
}

export async function POST(request: Request) {
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  if (!apiKey || !apiSecret) {
    return NextResponse.json({ code: "VOICE_NOT_CONFIGURED" }, { status: 503 });
  }

  const rawBody = await request.text();
  const authorization = request.headers.get("authorization") ?? "";
  let event: Awaited<ReturnType<WebhookReceiver["receive"]>>;
  try {
    const receiver = new WebhookReceiver(apiKey, apiSecret);
    event = await receiver.receive(rawBody, authorization);
  } catch {
    return NextResponse.json({ code: "INVALID_SIGNATURE" }, { status: 401 });
  }

  const room = parseChannelRoom(event.room?.name);
  if (!room) return NextResponse.json({ ok: true, ignored: true });

  const database = getDatabase();
  const eventId = event.id || createHash("sha256").update(rawBody).digest("hex");
  const [delivery] = await database
    .insert(livekitWebhookEvents)
    .values({ id: eventId, event: event.event })
    .onConflictDoNothing()
    .returning({ id: livekitWebhookEvents.id });
  if (!delivery) return NextResponse.json({ ok: true, duplicate: true });

  const participantId = event.participant?.identity;
  const now = new Date();

  if (event.event === "participant_joined" && participantId) {
    await database.insert(voiceStates).values({
      userId: participantId,
      channelId: room.channelId,
      breakout: room.breakout,
      updatedAt: now,
    }).onConflictDoUpdate({
      target: voiceStates.userId,
      set: { channelId: room.channelId, breakout: room.breakout, updatedAt: now },
    });
  } else if (event.event === "participant_left" && participantId) {
    await database.transaction((tx) => finalizeVoiceXp(tx, {
      userId: participantId,
      channelId: room.channelId,
      spaceId: room.spaceId,
    }));
  } else if ((event.event === "track_published" || event.event === "track_unpublished") && participantId) {
    const source = event.track?.source;
    if (source === TrackSource.SCREEN_SHARE || source === TrackSource.SCREEN_SHARE_AUDIO) {
      await database.update(voiceStates).set({
        streaming: event.event === "track_published",
        updatedAt: now,
      }).where(and(eq(voiceStates.userId, participantId), eq(voiceStates.channelId, room.channelId)));
    } else {
      await database.update(voiceStates).set({ updatedAt: now }).where(and(
        eq(voiceStates.userId, participantId),
        eq(voiceStates.channelId, room.channelId),
      ));
    }
  } else if (event.event === "room_finished") {
    const sessions = await database.select({ userId: voiceStates.userId }).from(voiceStates).where(and(
      eq(voiceStates.channelId, room.channelId),
      eq(voiceStates.breakout, room.breakout),
    ));
    for (const session of sessions) {
      await database.transaction((tx) => finalizeVoiceXp(tx, {
        userId: session.userId,
        channelId: room.channelId,
        spaceId: room.spaceId,
      }));
    }
  }

  return NextResponse.json({ ok: true });
}
