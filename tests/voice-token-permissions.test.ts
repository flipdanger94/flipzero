import { describe, expect, it, vi } from "vitest";
import { TrackSource } from "livekit-server-sdk";
import { Permission } from "../lib/permissions";
import { publishSourcesForPermissions } from "../lib/voice-grants";

vi.mock("../lib/auth", () => ({ getCurrentUser: async () => ({ id: "user-1" }) }));
vi.mock("../db/client", () => ({ getDatabase: () => ({
  select: () => ({ from: () => ({ innerJoin: () => ({ where: () => ({ limit: async () => [{ id: "channel-1", spaceId: "space-1" }] }) }) }) }),
}) }));
vi.mock("../lib/space-permissions", () => ({
  getChannelPermissions: async () => ({ spaceId: "space-1", permissions: 1 }),
}));

import { POST } from "../app/api/v1/channels/[channelId]/voice-token/route";

describe("voice token permissions", () => {
  it("does not mint a token for a member denied ConnectVoice", async () => {
    const response = await POST(new Request("https://flipzero.app/api/v1/channels/channel-1/voice-token", {
      method: "POST", headers: { origin: "https://flipzero.app" },
    }), { params: Promise.resolve({ channelId: "channel-1" }) });
    expect(response.status).toBe(403);
  });

  it("allows only media sources granted by SpeakVoice and Stream", () => {
    expect(publishSourcesForPermissions(Permission.ViewChannels | Permission.ConnectVoice)).toEqual([]);
    expect(publishSourcesForPermissions(Permission.SpeakVoice)).toEqual([TrackSource.MICROPHONE, TrackSource.CAMERA]);
    expect(publishSourcesForPermissions(Permission.Stream)).toEqual([TrackSource.SCREEN_SHARE, TrackSource.SCREEN_SHARE_AUDIO]);
  });
});
