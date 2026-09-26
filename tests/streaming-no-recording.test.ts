import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("streaming without recording", () => {
  const source = readFileSync("components/voice-room.tsx", "utf8");

  it("does not expose recording consent UI or signaling", () => {
    expect(source).not.toContain("recording-consent");
    expect(source).not.toContain("requestRecordingConsent");
    expect(source).not.toContain("Согласие на запись");
    expect(source).not.toContain(">Запись<");
  });

  it("keeps fullscreen stream viewer and multi-stream switching", () => {
    expect(source).toContain("voice-stream-fullscreen-bar");
    expect(source).toContain("activeStreams.map");
    expect(source).toContain('event.key === "Escape"');
  });
});
