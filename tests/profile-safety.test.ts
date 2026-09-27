import { afterEach, describe, expect, it, vi } from "vitest";
import { parseIgnoredUsers, postProfileSafety } from "@/lib/profile-safety";
afterEach(() => vi.unstubAllGlobals());
describe("profile safety", () => {
  it("recovers malformed local preferences and filters non-user values", () => {
    expect(parseIgnoredUsers('{"bad":true}')).toEqual([]);
    expect(parseIgnoredUsers("broken")).toEqual([]);
    expect(parseIgnoredUsers('["a",123,null,"a","b"]')).toEqual(["a", "b"]);
  });
  it("sends block requests with the selected user and surfaces rejection", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue({
        ok: false,
        json: async () => ({ message: "Недостаточно прав" }),
      });
    vi.stubGlobal("fetch", fetch);
    await expect(
      postProfileSafety("/api/blocks", { userId: "target" }),
    ).rejects.toThrow("Недостаточно прав");
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({
      userId: "target",
    });
  });
  it("sends report target and reason", async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetch);
    await postProfileSafety("/api/reports", {
      targetType: "profile",
      targetId: "target",
      reason: "spam",
    });
    expect(fetch).toHaveBeenCalledWith(
      "/api/reports",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          targetType: "profile",
          targetId: "target",
          reason: "spam",
        }),
      }),
    );
  });
});
