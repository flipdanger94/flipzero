export type VoicePresence = {
  id: string;
  name: string;
  username?: string | null;
  avatarUrl?: string | null;
  clanTag?: string | null;
  clanTagColor?: string | null;
  accentColor?: string | null;
  breakout?: "main" | "focus" | "social";
  muted: boolean;
  deafened?: boolean;
  camera: boolean;
  sharing: boolean;
  streaming?: boolean;
  speaking: boolean;
};

export function normalizeVoicePresence(items: VoicePresence[]): VoicePresence[] {
  const byUser = new Map<string, VoicePresence>();
  for (const item of items) {
    if (!item?.id) continue;
    const previous = byUser.get(item.id);
    if (!previous) {
      byUser.set(item.id, {
        ...item,
        streaming: Boolean(item.streaming || item.sharing),
        deafened: Boolean(item.deafened),
      });
      continue;
    }
    byUser.set(item.id, {
      ...previous,
      ...item,
      name: item.name || previous.name,
      username: item.username ?? previous.username,
      avatarUrl: item.avatarUrl ?? previous.avatarUrl,
      clanTag: item.clanTag ?? previous.clanTag,
      clanTagColor: item.clanTagColor ?? previous.clanTagColor,
      accentColor: item.accentColor ?? previous.accentColor,
      breakout: item.breakout ?? previous.breakout,
      muted: previous.muted && item.muted,
      deafened: Boolean(previous.deafened && item.deafened),
      camera: previous.camera || item.camera,
      sharing: previous.sharing || item.sharing,
      streaming: Boolean(previous.streaming || item.streaming || previous.sharing || item.sharing),
      speaking: previous.speaking || item.speaking,
    });
  }
  return [...byUser.values()];
}
