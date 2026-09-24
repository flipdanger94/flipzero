import { beforeEach, describe, expect, it, vi } from "vitest";

const events: Array<Record<string, unknown>> = [];
const delivered = new Set<string>();
const inserts: Array<Record<string, unknown>> = [];
const updates: Array<Record<string, unknown>> = [];
const finalized: Array<Record<string, unknown>> = [];

vi.mock("livekit-server-sdk", () => ({
  TrackSource: { MICROPHONE: 2, CAMERA: 1, SCREEN_SHARE: 3, SCREEN_SHARE_AUDIO: 4 },
  WebhookReceiver: class {
    async receive(_body: string, authorization: string) {
      if (authorization !== "Bearer valid") throw new Error("bad signature");
      const event = events.shift();
      if (!event) throw new Error("no event");
      return event;
    }
  },
}));

vi.mock("../lib/voice-xp", () => ({
  finalizeVoiceXp: async (_tx: unknown, input: Record<string, unknown>) => {
    finalized.push(input);
    return { minutes: 0, xp: 0 };
  },
}));

vi.mock("../db/client", () => ({
  getDatabase: () => ({
    insert: () => ({
      values: (value: Record<string, unknown>) => {
        inserts.push(value);
        return {
          onConflictDoNothing: () => ({
            returning: async () => {
              const id = String(value.id ?? "");
              if (delivered.has(id)) return [];
              delivered.add(id);
              return [{ id }];
            },
          }),
          onConflictDoUpdate: async () => undefined,
        };
      },
    }),
    update: () => ({
      set: (value: Record<string, unknown>) => {
        updates.push(value);
        return { where: async () => undefined };
      },
    }),
    delete: () => ({ where: async () => undefined }),
    transaction: async (callback: (tx: unknown) => Promise<unknown>) => callback({}),
    select: () => ({ from: () => ({ where: async () => [] }) }),
  }),
}));

import { POST } from "../app/api/livekit/webhook/route";

function request(body = "{}") {
  return new Request("https://flipzero.app/api/livekit/webhook", {
    method: "POST",
    headers: { authorization: "Bearer valid" },
    body,
  });
}

describe("LiveKit webhook", () => {
  beforeEach(() => {
    events.length = 0;
    delivered.clear();
    inserts.length = 0;
    updates.length = 0;
    finalized.length = 0;
    process.env.LIVEKIT_API_KEY = "key";
    process.env.LIVEKIT_API_SECRET = "secret";
  });

  it("rejects an invalid signature before touching storage", async () => {
    const response = await POST(new Request("https://flipzero.app/api/livekit/webhook", {
      method: "POST",
      headers: { authorization: "Bearer invalid" },
      body: "{}",
    }));
    expect(response.status).toBe(401);
    expect(inserts).toHaveLength(0);
  });

  it("deduplicates repeated deliveries by webhook event id", async () => {
    const event = { id: "evt-1", event: "participant_joined", room: { name: "space:channel:main" }, participant: { identity: "user-1" } };
    events.push(event, event);
    const first = await POST(request("one"));
    const second = await POST(request("one"));
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(await second.json()).toMatchObject({ duplicate: true });
  });

  it("handles join, track publication and leave in delivery order", async () => {
    events.push(
      { id: "evt-join", event: "participant_joined", room: { name: "space:channel:main" }, participant: { identity: "user-1" } },
      { id: "evt-track", event: "track_published", room: { name: "space:channel:main" }, participant: { identity: "user-1" }, track: { source: 3 } },
      { id: "evt-left", event: "participant_left", room: { name: "space:channel:main" }, participant: { identity: "user-1" } },
    );
    await POST(request("join"));
    await POST(request("track"));
    await POST(request("left"));
    expect(inserts.some((value) => value.userId === "user-1" && value.channelId === "channel")).toBe(true);
    expect(updates.some((value) => value.streaming === true)).toBe(true);
    expect(finalized).toEqual([{ userId: "user-1", channelId: "channel", spaceId: "space" }]);
  });
});
