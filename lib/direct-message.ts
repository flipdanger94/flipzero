export const MAX_DIRECT_MESSAGE_LENGTH = 4000;

export function normalizeDirectMessage(value: unknown, maxLength = MAX_DIRECT_MESSAGE_LENGTH) {
  if (typeof value !== "string") return null;
  const text = value.trim();
  if (!text || text.length > maxLength) return null;
  return text;
}
