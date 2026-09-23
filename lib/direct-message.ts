export const MAX_DIRECT_MESSAGE_LENGTH = 4000;
export const MAX_DIRECT_ATTACHMENTS = 4;
export const DIRECT_MESSAGE_ENVELOPE_PREFIX = "__FZDM1__:";

export type DirectAttachment = {
  type: "image" | "audio" | "file";
  url: string;
  name: string;
  mimeType: string;
  size: number;
  duration?: number;
};

export function normalizeDirectMessage(value: unknown, maxLength = MAX_DIRECT_MESSAGE_LENGTH) {
  if (typeof value !== "string") return null;
  const text = value.trim();
  if (!text || text.length > maxLength) return null;
  return text;
}

export function normalizeDirectAttachments(value: unknown): DirectAttachment[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const attachment = item as Record<string, unknown>;
    const type = attachment.type;
    const url = attachment.url;
    const name = attachment.name;
    const mimeType = attachment.mimeType;
    const size = Number(attachment.size);
    const duration = attachment.duration === undefined ? undefined : Number(attachment.duration);
    if (!["image", "audio", "file"].includes(String(type))) return [];
    if (typeof url !== "string" || !/^\/api\/v1\/media\/[0-9a-f-]{36}$/i.test(url)) return [];
    if (typeof name !== "string" || !name.trim() || name.length > 180) return [];
    if (typeof mimeType !== "string" || !mimeType || mimeType.length > 120) return [];
    if (!Number.isSafeInteger(size) || size <= 0 || size > 25 * 1024 * 1024) return [];
    if (duration !== undefined && (!Number.isFinite(duration) || duration <= 0 || duration > 300)) return [];
    return [{ type: type as DirectAttachment["type"], url, name: name.trim(), mimeType, size, ...(duration ? { duration } : {}) }];
  }).slice(0, MAX_DIRECT_ATTACHMENTS);
}

export function encodeDirectMessage(text: string, attachments: DirectAttachment[]) {
  if (!attachments.length) return text;
  return DIRECT_MESSAGE_ENVELOPE_PREFIX + JSON.stringify({ text, attachments });
}

export function decodeDirectMessage(value: string): { text: string; attachments: DirectAttachment[] } {
  if (!value.startsWith(DIRECT_MESSAGE_ENVELOPE_PREFIX)) return { text: value, attachments: [] };
  try {
    const decoded = JSON.parse(value.slice(DIRECT_MESSAGE_ENVELOPE_PREFIX.length)) as { text?: unknown; attachments?: unknown };
    return {
      text: typeof decoded.text === "string" ? decoded.text : "",
      attachments: normalizeDirectAttachments(decoded.attachments),
    };
  } catch {
    return { text: value, attachments: [] };
  }
}

export function directMessagePreview(value: string) {
  const decoded = decodeDirectMessage(value);
  if (decoded.text) return decoded.text;
  const first = decoded.attachments[0];
  if (!first) return "";
  return first.type === "audio" ? "🎤 Голосовое сообщение" : first.type === "image" ? "🖼️ Изображение" : `📎 ${first.name}`;
}
