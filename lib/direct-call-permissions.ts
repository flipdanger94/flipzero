import { TrackSource } from "livekit-server-sdk";

export function directCallPublishSources(video: boolean) {
  return [
    TrackSource.MICROPHONE,
    ...(video ? [TrackSource.CAMERA] : []),
    TrackSource.SCREEN_SHARE,
    TrackSource.SCREEN_SHARE_AUDIO,
  ];
}
