export const MAX_DIRECT_MESSAGE_LENGTH = 4000;

export function normalizeDirectMessage(value: unknown) {
  if (typeof value !== "string") return null;
  const text = value.trim();
  if (!text || text.length > MAX_DIRECT_MESSAGE_LENGTH) return null;
  return text;
}
