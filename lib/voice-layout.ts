export type VoiceGridLayoutKey = "one" | "two" | "three" | "four" | "five-nine" | "ten-plus";

export function voiceGridLayout(participantCount: number): { key: VoiceGridLayoutKey; columns: number } {
  const count = Math.max(0, Math.floor(participantCount));
  if (count <= 1) return { key: "one", columns: 1 };
  if (count === 2) return { key: "two", columns: 2 };
  if (count === 3) return { key: "three", columns: 3 };
  if (count === 4) return { key: "four", columns: 2 };
  if (count <= 9) return { key: "five-nine", columns: 3 };
  return { key: "ten-plus", columns: 4 };
}
