import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("voice client reliability contract", () => {
  it("uses a leave beacon on pagehide and pauses heartbeat on hidden tabs", async () => {
    const source = await readFile("components/voice-room.tsx", "utf8");
    expect(source).toContain('voice?leave=1');
    expect(source).toContain('JSON.stringify({ leave: true })');
    expect(source).toContain('document.visibilityState !== "visible"');
    expect(source).toContain("45_000");
  });

  it("retries unexpected disconnects with a fresh token flow", async () => {
    const source = await readFile("components/voice-room.tsx", "utf8");
    expect(source).toContain("intentionalLeaveRef");
    expect(source).toContain("reconnectAttemptsRef");
    expect(source).toContain("joinRef.current()");
    expect(source).toContain("Попытка");
  });

  it("subscribes screen share only after explicit viewing", async () => {
    const source = await readFile("components/voice-room.tsx", "utf8");
    expect(source).toContain("autoSubscribe: false");
    expect(source).toContain("Track.Source.ScreenShareAudio");
    expect(source).toContain("publication.setSubscribed(participant.identity === selectedStreamRef.current)");
    expect(source).toContain("Смотреть стрим");
  });

  it("renders camera and screen share only inside participant cards", async () => {
    const [source, theme] = await Promise.all([
      readFile("components/voice-room.tsx", "utf8"),
      readFile("app/product-theme.css", "utf8"),
    ]);
    expect(source).toContain('data-voice-media-source="camera"');
    expect(source).toContain('data-voice-media-source="screen"');
    expect(source).toContain("voice-tile-stream-actions");
    expect(source).not.toContain('className="remote-video"');
    expect(theme).toContain(".voice-room-side{display:none!important}");
    expect(theme).toContain(".voice-room-connected.is-focus .voice-tile:not(.is-media-focus){display:none}");
  });

  it("offers camera preflight and screen quality settings", async () => {
    const source = await readFile("components/voice-room.tsx", "utf8");
    expect(source).toContain("ПРЕДПРОСМОТР КАМЕРЫ");
    expect(source).toContain("NotReadableError");
    expect(source).toContain("systemAudio");
    expect(source).toContain("screenFps");
    expect(source).toContain("screenQuality");
  });

  it("reuses the voice surface for clan voice and keeps it mounted across navigation", async () => {
    const [room, clan, app] = await Promise.all([
      readFile("components/voice-room.tsx", "utf8"),
      readFile("components/clan-hub.tsx", "utf8"),
      readFile("components/flipzero-app.tsx", "utf8"),
    ]);
    expect(room).toContain("resolvedTokenUrl");
    expect(room).toContain("stateUrl?: string | null");
    expect(clan).toContain("Клановый войс");
    expect(clan).toContain("stateUrl={null}");
    expect(app).toContain("clanMounted");
    expect(app).toContain("platform-pane-hidden");
  });
});
