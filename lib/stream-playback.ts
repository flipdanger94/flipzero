import { Track } from "livekit-client";

export function isScreenSource(source: Track.Source) {
  return (
    source === Track.Source.ScreenShare ||
    source === Track.Source.ScreenShareAudio
  );
}

export function selectScreenSubscriptions(
  participants: Iterable<{
    identity: string;
    trackPublications: Map<
      string,
      { source: Track.Source; setSubscribed: (subscribed: boolean) => void }
    >;
  }>,
  selectedId: string,
) {
  for (const participant of participants) {
    for (const publication of participant.trackPublications.values()) {
      if (isScreenSource(publication.source))
        publication.setSubscribed(participant.identity === selectedId);
    }
  }
}

export function playbackSettings(
  isScreen: boolean,
  deafened: boolean,
  outputVolume: number,
  streamMuted: boolean,
  streamVolume: number,
) {
  return {
    muted: deafened || (isScreen && streamMuted),
    volume:
      Math.max(0, Math.min(1, outputVolume)) *
      (isScreen ? Math.max(0, Math.min(1, streamVolume / 100)) : 1),
  };
}
