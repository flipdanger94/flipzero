import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("persistent application shell contract", () => {
  it("mounts FlipZeroApp once in the shared route-group layout", async () => {
    const [layout, appPage, channelPage, shell] = await Promise.all([
      readFile("app/(flipzero)/layout.tsx", "utf8"),
      readFile("app/(flipzero)/app/page.tsx", "utf8"),
      readFile("app/(flipzero)/channels/[spaceId]/[[...channelId]]/page.tsx", "utf8"),
      readFile("components/flipzero-app.tsx", "utf8"),
    ]);

    expect(layout).toContain("<FlipZeroApp />");
    expect(appPage).not.toContain("FlipZeroApp");
    expect(channelPage).not.toContain("FlipZeroApp");
    expect(channelPage).toContain("getCurrentUser");
    expect(channelPage).toContain("members.spaceId");
    expect(shell.match(/<UserDock\b/g)?.length).toBe(1);
  });

  it("keeps desktop voice status singular and voice participants in both room and sidebar", async () => {
    const [appCss, room, shell] = await Promise.all([
      readFile("app/app-shell.css", "utf8"),
      readFile("components/voice-room.tsx", "utf8"),
      readFile("components/flipzero-app.tsx", "utf8"),
    ]);

    expect(appCss).toContain(".mobile-voice-session{display:none}");
    expect(room).toContain("presence?.length ? presence : localPresence");
    expect(room).toContain("data-participant-count");
    expect(shell).toContain("voice-channel-participants");
    expect(shell).toContain("participant.streaming || participant.sharing");
  });

  it("uses second-level desktop navigation for admin and clans", async () => {
    const [admin, platformCss] = await Promise.all([
      readFile("components/admin-dialog.tsx", "utf8"),
      readFile("app/platform-shell.css", "utf8"),
    ]);

    expect(admin).toContain('className="admin-body"');
    expect(platformCss).toContain("grid-template-columns: 248px minmax(0, 1fr)");
    expect(platformCss).toContain(".platform-pane-active .clan-member-view > .clan-tabs");
  });
});
