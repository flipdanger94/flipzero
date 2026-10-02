import { beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ schemaReady: true, databaseDown: false, voiceDown: false, probes: 0 }));
vi.mock("../db/client", () => ({
  getDatabase: () => ({
    transaction: async (run: (tx: unknown) => Promise<unknown>) => {
      if (state.databaseDown) throw new Error("Database unavailable");
      let query = 0;
      return run({ execute: async () => {
        query++;
        if (query === 2) return [{ ready: state.schemaReady }];
        return [{ total: 1, migrating: 0 }];
      } });
    },
  }),
}));
vi.mock("livekit-server-sdk", () => ({
  RoomServiceClient: class {
    async listRooms() {
      state.probes++;
      if (state.voiceDown) throw new Error("LiveKit unavailable");
      return [];
    }
  },
}));
import { GET } from "../app/api/health/route";
import { GET as liveness } from "../app/api/health/live/route";
beforeEach(() => {
  state.schemaReady = true; state.databaseDown = false; state.voiceDown = false; state.probes = 0;
  process.env.LIVEKIT_URL = "wss://voice.test.invalid";
  process.env.LIVEKIT_API_KEY = Math.random().toString();
  process.env.LIVEKIT_API_SECRET = "test-only-secret";
});
describe("readiness distinguishes dependency failures", () => {
  it("reports reachable dependencies without claiming chat delivery was probed", async () => {
    const response = await GET(new Request("https://flipzero.test/api/health"));
    expect(response.status).toBe(200);
    expect((await response.json()).checks).toMatchObject({ schema: { status: "ok" }, voice: { status: "ok" }, chat: { status: "not_probed" } });
    await GET(new Request("https://flipzero.test/api/health"));
    expect(state.probes).toBe(1);
  });
  it("returns 503 for a missing schema despite a reachable database", async () => {
    state.schemaReady = false;
    const response = await GET(new Request("https://flipzero.test/api/health"));
    expect(response.status).toBe(503);
    expect((await response.json()).checks.schema.status).toBe("error");
  });
  it("returns 503 for a failed LiveKit probe despite configured credentials", async () => {
    state.voiceDown = true;
    const response = await GET(new Request("https://flipzero.test/api/health"));
    expect(response.status).toBe(503);
    expect((await response.json()).checks.voice.status).toBe("error");
  });
  it("keeps process liveness separate from unavailable dependencies", async () => {
    state.databaseDown = true;
    expect((await GET(new Request("https://flipzero.test/api/health"))).status).toBe(503);
    expect((await liveness()).status).toBe(200);
  });
});
