export const CLAN_LEVEL_THRESHOLDS = [0, 1000, 3000, 7000, 15000, 30000, 50000, 80000, 120000, 180000, 250000, 350000, 500000, 700000, 950000] as const;
export function clanLevel(xp: number) {
  let level = 1;
  for (let i = 1; i < CLAN_LEVEL_THRESHOLDS.length; i++) {
    if (xp < CLAN_LEVEL_THRESHOLDS[i]) break;
    level = i + 1;
  }
  return level;
}
export const CLAN_TAG_ICONS = ["shield", "crown", "swords", "flame", "zap", "skull", "star"] as const;
export function validTagColor(value: unknown): value is string {
  return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value);
}
export function validTagIcon(value: unknown): value is typeof CLAN_TAG_ICONS[number] {
  return typeof value === "string" && CLAN_TAG_ICONS.includes(value as typeof CLAN_TAG_ICONS[number]);
}
