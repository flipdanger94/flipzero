import "server-only";

export const PATHS = ["social", "voice", "organizer", "creator"] as const;
export type ProgressPath = (typeof PATHS)[number];

export const PATH_META: Record<ProgressPath, { label: string; icon: string; description: string }> = {
  social: { label: "Общительность", icon: "💬", description: "Сообщения и реакции" },
  voice: { label: "Голос", icon: "🎙", description: "Активность в голосовых" },
  organizer: { label: "Организатор", icon: "◆", description: "События и приглашения" },
  creator: { label: "Творчество", icon: "✦", description: "Публикации и идеи" },
};

export function totalXpForLevel(level: number) {
  return Math.floor(100 * Math.pow(Math.max(1, level) - 1, 1.5));
}

export function levelFromXp(xp: number) {
  let level = 1;
  while (level < 100 && xp >= totalXpForLevel(level + 1)) level += 1;
  return level;
}

export function levelProgress(xp: number) {
  const level = levelFromXp(xp);
  const start = totalXpForLevel(level);
  const end = totalXpForLevel(level + 1);
  return { level, current: xp - start, required: Math.max(1, end - start), percent: Math.min(100, Math.round(((xp - start) / Math.max(1, end - start)) * 100)) };
}

export function pathForSource(source: string): ProgressPath {
  if (["voice_minute", "stage_speaker"].includes(source)) return "voice";
  if (["event_hosted", "invite_joined"].includes(source)) return "organizer";
  if (["forum_post", "creative_post"].includes(source)) return "creator";
  return "social";
}

export const SOURCE_XP: Record<string, number> = {
  message: 15,
  reaction_received: 8,
  voice_minute: 3,
  event_hosted: 100,
  invite_joined: 50,
  forum_post: 25,
  creative_post: 30,
};
