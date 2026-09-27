import { describe, expect, it, vi } from "vitest";
import { Track } from "livekit-client";
import {
  playbackSettings,
  selectScreenSubscriptions,
} from "@/lib/stream-playback";

describe("stream playback", () => {
  it("switches both screen tracks and leaves microphone subscriptions alone", () => {
    const make = (identity: string) => ({
      identity,
      trackPublications: new Map(
        [
          Track.Source.ScreenShare,
          Track.Source.ScreenShareAudio,
          Track.Source.Microphone,
        ].map((source) => [source, { source, setSubscribed: vi.fn() }]),
      ),
    });
    const first = make("first"),
      second = make("second");
    selectScreenSubscriptions([first, second], "first");
    selectScreenSubscriptions([first, second], "second");
    for (const source of [
      Track.Source.ScreenShare,
      Track.Source.ScreenShareAudio,
    ]) {
      expect(
        first.trackPublications.get(source)!.setSubscribed,
      ).toHaveBeenLastCalledWith(false);
      expect(
        second.trackPublications.get(source)!.setSubscribed,
      ).toHaveBeenLastCalledWith(true);
    }
    expect(
      first.trackPublications.get(Track.Source.Microphone)!.setSubscribed,
    ).not.toHaveBeenCalled();
    selectScreenSubscriptions([first, second], "");
    expect(
      second.trackPublications.get(Track.Source.ScreenShareAudio)!
        .setSubscribed,
    ).toHaveBeenLastCalledWith(false);
  });
  it("stream mute does not mute the broadcaster's microphone", () => {
    expect(playbackSettings(true, false, 0.8, true, 50)).toEqual({
      muted: true,
      volume: 0.4,
    });
    expect(playbackSettings(false, false, 0.8, true, 50)).toEqual({
      muted: false,
      volume: 0.8,
    });
  });
  it("deafen overrides both sources, undeafen preserves stream mute", () => {
    expect(playbackSettings(false, true, 1, false, 100).muted).toBe(true);
    expect(playbackSettings(true, true, 1, false, 100).muted).toBe(true);
    expect(playbackSettings(true, false, 1, true, 100).muted).toBe(true);
  });
});
