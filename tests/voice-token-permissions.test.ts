import { readFile } from "node:fs/promises";
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
    expect(publishSourcesForPermissions(Permission.SpeakVoice | Permission.Stream)).toEqual([
      TrackSource.MICROPHONE,
      TrackSource.CAMERA,
      TrackSource.SCREEN_SHARE,
      TrackSource.SCREEN_SHARE_AUDIO,
    ]);
  });

  it("documents camera as part of SpeakVoice because there is no separate camera permission", () => {
    expect(publishSourcesForPermissions(Permission.SpeakVoice)).toContain(TrackSource.CAMERA);
    expect(publishSourcesForPermissions(Permission.Stream)).not.toContain(TrackSource.CAMERA);
  });

  it("constrains clan voice tokens to explicit publish sources and short TTL", async () => {
    const source = await readFile("app/api/v1/clans/[clanId]/voice-token/route.ts", "utf8");
    expect(source).toContain("canPublishSources:[TrackSource.MICROPHONE,TrackSource.CAMERA,TrackSource.SCREEN_SHARE,TrackSource.SCREEN_SHARE_AUDIO]");
    expect(source).toContain('ttl:"20m"');
  });

  it("keeps channel capacity reservation atomic", async () => {
    const source = await readFile("app/api/v1/channels/[channelId]/voice/route.ts", "utf8");
    expect(source).toContain("pg_advisory_xact_lock");
    expect(source).toContain("canJoinVoiceChannel");
  });
});
