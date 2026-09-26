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
    expect(source).toContain("viewableStreams.map");
    expect(source).toContain('event.key === "Escape"');
  });

  it("never offers the local broadcaster a stream viewer", () => {
    expect(source).toContain('participant.id===selfParticipantId');
    expect(source).toContain("Вы ведёте стрим");
    expect(source).toContain("Остановить демонстрацию");
    expect(source).toContain('participantId === room?.localParticipant.identity');
  });

  it("does not attach the local screen-share track back into the room UI", () => {
    expect(source).toContain('clearParticipantVideo(connectedRoom.localParticipant.identity, "screen")');
    expect(source).not.toContain('if (next) attachLocal(Track.Source.ScreenShare)');
  });
});
