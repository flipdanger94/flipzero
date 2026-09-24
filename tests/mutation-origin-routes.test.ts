import { describe, expect, it, vi } from "vitest";

vi.mock("../lib/auth", () => ({ getCurrentUser: async () => { throw new Error("Authentication must not run for a cross-site mutation"); } }));

import { POST as sendDirectMessage } from "../app/api/messages/route";
import { POST as joinVoice } from "../app/api/v1/channels/[channelId]/voice/route";
import { POST as uploadMedia } from "../app/api/v1/media/route";
import { isTrustedMutationRequest } from "../lib/security-controls";

describe("mutation origin boundaries", () => {
  it("accepts browser-confirmed same-origin mutations behind a proxy", () => {
    const request = new Request("http://127.0.0.1:3000/api/v1/auth/register", {
      method: "POST",
      headers: {
        origin: "https://example-codespace-3000.app.github.dev",
        "sec-fetch-site": "same-origin",
        host: "127.0.0.1:3000",
      },
    });
    expect(isTrustedMutationRequest(request)).toBe(true);
  });
  it("rejects cross-site direct messages, voice joins and media uploads before authentication", async () => {
    const request = (path: string) => new Request(`https://flipzero.app${path}`, {
      method: "POST", headers: { origin: "https://untrusted.example", "sec-fetch-site": "cross-site" },
    });
    const context = { params: Promise.resolve({ channelId: "voice-1" }) };
    const responses = await Promise.all([
      sendDirectMessage(request("/api/messages")),
      joinVoice(request("/api/v1/channels/voice-1/voice"), context),
      uploadMedia(request("/api/v1/media")),
    ]);
    expect(responses.map((response) => response?.status)).toEqual([403, 403, 403]);
  });
});
