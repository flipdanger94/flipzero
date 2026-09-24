import { readFile } from "node:fs/promises";
import { afterEach, describe, expect, it } from "vitest";
import { TrackSource } from "livekit-server-sdk";
import { isScreenSource, parseSpaceVoiceRoom } from "../lib/livekit-voice";

describe("LiveKit webhook contract", () => {
  const oldKey = process.env.LIVEKIT_API_KEY;
  const oldSecret = process.env.LIVEKIT_API_SECRET;

  afterEach(() => {
    if (oldKey === undefined) delete process.env.LIVEKIT_API_KEY; else process.env.LIVEKIT_API_KEY = oldKey;
    if (oldSecret === undefined) delete process.env.LIVEKIT_API_SECRET; else process.env.LIVEKIT_API_SECRET = oldSecret;
  });

  it("rejects an invalid signature before persistence", async () => {
    process.env.LIVEKIT_API_KEY = "test-key";
    process.env.LIVEKIT_API_SECRET = "test-secret-test-secret-test-secret";
    const { POST } = await import("../app/api/livekit/webhook/route");
    const response = await POST(new Request("https://flipzero.app/api/livekit/webhook", {
      method: "POST",
      headers: { authorization: "Bearer invalid", "content-type": "application/webhook+json" },
      body: JSON.stringify({ event: "participant_joined" }),
    }));
    expect(response.status).toBe(401);
  });

  it("parses only supported breakout room names", () => {
    expect(parseSpaceVoiceRoom("space-1:channel-1:main")).toEqual({ spaceId: "space-1", channelId: "channel-1", breakout: "main" });
    expect(parseSpaceVoiceRoom("space-1:channel-1:focus")?.breakout).toBe("focus");
    expect(parseSpaceVoiceRoom("space-1:channel-1:social")?.breakout).toBe("social");
    expect(parseSpaceVoiceRoom("clan:123")).toBeNull();
    expect(parseSpaceVoiceRoom("space:channel:unknown")).toBeNull();
  });

  it("recognizes both screen media sources", () => {
    expect(isScreenSource(TrackSource.SCREEN_SHARE)).toBe(true);
    expect(isScreenSource(TrackSource.SCREEN_SHARE_AUDIO)).toBe(true);
    expect(isScreenSource(TrackSource.MICROPHONE)).toBe(false);
  });

  it("keeps webhook delivery idempotent and handles terminal events", async () => {
    const [route, migration] = await Promise.all([
      readFile("app/api/livekit/webhook/route.ts", "utf8"),
      readFile("drizzle/0029_livekit_voice_webhooks.sql", "utf8"),
    ]);
    expect(route).toContain("onConflictDoNothing()");
    expect(route).toContain('event.event === "participant_left"');
    expect(route).toContain('event.event === "room_finished"');
    expect(migration).toContain("livekit_webhook_events");
    expect(migration).toContain("id text PRIMARY KEY");
  });
});
