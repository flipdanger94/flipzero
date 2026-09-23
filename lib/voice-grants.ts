import { TrackSource } from "livekit-server-sdk";
import { hasPermission, Permission } from "./permissions";

export function publishSourcesForPermissions(permissions: number) {
  const sources: TrackSource[] = [];
  if (hasPermission(permissions, Permission.SpeakVoice)) sources.push(TrackSource.MICROPHONE, TrackSource.CAMERA);
  if (hasPermission(permissions, Permission.Stream)) sources.push(TrackSource.SCREEN_SHARE, TrackSource.SCREEN_SHARE_AUDIO);
  return sources;
}
