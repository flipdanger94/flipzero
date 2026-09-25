import { TrackSource } from "livekit-server-sdk";

export const VOICE_BREAKOUTS = ["main", "focus", "social"] as const;
export type VoiceBreakout = (typeof VOICE_BREAKOUTS)[number];

export function parseSpaceVoiceRoom(roomName: string) {
  const parts = roomName.split(":");
  if (parts.length !== 3) return null;
  const [spaceId, channelId, breakout] = parts;
  if (!spaceId || !channelId || !VOICE_BREAKOUTS.includes(breakout as VoiceBreakout)) return null;
  return { spaceId, channelId, breakout: breakout as VoiceBreakout };
}

export function isScreenSource(source: TrackSource | number | undefined) {
  return source === TrackSource.SCREEN_SHARE || source === TrackSource.SCREEN_SHARE_AUDIO;
}
