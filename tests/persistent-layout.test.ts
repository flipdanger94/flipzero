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

  it("keeps an active voice room mounted while text channels are browsed", async () => {
    const [shell, productCss] = await Promise.all([
      readFile("components/flipzero-app.tsx", "utf8"),
      readFile("app/product-theme.css", "utf8"),
    ]);

    expect(shell).toContain("const voiceHostChannel = activeVoiceChannel ?? connectedVoiceChannel");
    expect(shell).toContain("voice-room-host-background");
    expect(shell).toContain('["voice", "stage"].includes(channel.kind) ? openVoiceChannel(channel) : selectChannel');
    expect(productCss).toContain("grid-template-columns:minmax(0,1fr) auto auto");
    expect(productCss).toContain(".video-grid>.remote-video:empty");
    expect(productCss).toContain(".video-grid>.local-screen:not(.visible)");
  });

  it("keeps one wider desktop rail and account dock on platform views", async () => {
    const [shell, runtime] = await Promise.all([
      readFile("components/flipzero-app.tsx", "utf8"),
      readFile("app/runtime-theme.css", "utf8"),
    ]);

    expect(shell.match(/<nav className="space-rail"/g)?.length).toBe(1);
    expect(runtime).toContain("grid-template-columns:76px 272px");
    expect(runtime).toContain(".app-shell.platform-view-active>.space-rail");
    expect(runtime).toContain("left:76px;bottom:0;width:272px");
    expect(runtime).toContain("grid-template-columns:minmax(96px,1fr) 50px 50px 38px");
    expect(runtime).toContain("width:272px");
  });

  it("uses second-level desktop navigation for admin and clans", async () => {
    const [admin, platformCss] = await Promise.all([
      readFile("components/admin-dialog.tsx", "utf8"),
      readFile("app/platform-shell.css", "utf8"),
    ]);

    expect(admin).toContain('className="admin-body"');
    expect(platformCss).toContain("grid-template-columns: 272px minmax(0, 1fr)");
    expect(platformCss).toContain(".platform-pane-active .clan-section-layout");
  });
});
