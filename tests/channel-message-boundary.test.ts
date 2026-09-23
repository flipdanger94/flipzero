import { beforeEach, describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import { channels, messages, reactions } from "../db/schema";

const state = vi.hoisted(() => ({ targetExists: false, inserts: 0, targetQuery: "" }));

vi.mock("../lib/auth", () => ({ getCurrentUser: async () => ({ id: "user-1", username: "test", displayName: "Test" }) }));
vi.mock("../lib/space-permissions", () => ({ getChannelPermissions: async () => ({ owner: true, permissions: 0 }), hasPermission: () => true, SpacePermission: { ViewChannels: 1, SEND_MESSAGES: 2 } }));
vi.mock("../db/client", () => ({ getDatabase: () => ({
  select: () => ({ from: (table: unknown) => {
    const query = {
      innerJoin: () => query,
      where: (condition: Parameters<PgDialect["sqlToQuery"]>[0]) => {
        if (table === messages) state.targetQuery = new PgDialect().sqlToQuery(condition).sql;
        return query;
      },
      limit: async () => table === channels ? [{ id: "channel-1", spaceId: "space-1", kind: "text", ownerId: "user-1" }] : table === messages && state.targetExists ? [{ id: "message-1" }] : [],
    };
    return query;
  } }),
  insert: (table: unknown) => ({ values: async () => { if (table === reactions) state.inserts++; } }),
}) }));

import { POST } from "../app/api/v1/channels/[channelId]/messages/route";

describe("channel message references", () => {
  beforeEach(() => { state.targetExists = false; state.inserts = 0; state.targetQuery = ""; });

  it("rejects a reaction when the message is not visible in the requested channel", async () => {
    const request = new Request("https://flipzero.app/api/v1/channels/channel-1/messages", {
      method: "POST", headers: { origin: "https://flipzero.app", "content-type": "application/json" },
      body: JSON.stringify({ action: "react", messageId: "message-1", emoji: "❤️" }),
    });
    const response = await POST(request, { params: Promise.resolve({ channelId: "channel-1" }) });
    expect(response?.status).toBe(404);
    expect(state.inserts).toBe(0);
    expect(state.targetQuery).toContain("channel_id");
    expect(state.targetQuery).toContain("deleted_at");
  });

  it("rejects a reply pointing to a message in another channel", async () => {
    const request = new Request("https://flipzero.app/api/v1/channels/channel-1/messages", {
      method: "POST", headers: { origin: "https://flipzero.app", "content-type": "application/json" },
      body: JSON.stringify({ content: "Ответ", replyToId: "message-1" }),
    });
    const response = await POST(request, { params: Promise.resolve({ channelId: "channel-1" }) });
    expect(response?.status).toBe(400);
    expect((await response!.json()).code).toBe("INVALID_MESSAGE_REFERENCE");
    expect(state.targetQuery).toContain("channel_id");
  });
});
