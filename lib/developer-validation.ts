import { isIP } from "node:net";

export const API_TOKEN_SCOPES = ["profile:read", "spaces:read"] as const;
export const OAUTH_SCOPES = ["identify", "profile:read", "spaces:read"] as const;
export const WEBHOOK_EVENTS = ["message.created", "member.joined", "member.left", "space.updated"] as const;

type ValidationResult<T> = { ok: true; value: T } | { ok: false; message: string };

function normalizeAllowedList(input: unknown, allowed: readonly string[], fallback: readonly string[] = []): string[] {
  if (!Array.isArray(input)) return [...fallback];
  const unique = new Set<string>();
  for (const value of input) {
    if (typeof value === "string" && allowed.includes(value)) unique.add(value);
  }
  return [...unique];
}

export function normalizeApiTokenScopes(input: unknown) {
  const scopes = normalizeAllowedList(input, API_TOKEN_SCOPES, API_TOKEN_SCOPES);
  return scopes.length ? scopes : [...API_TOKEN_SCOPES];
}

export function normalizeOAuthScopes(input: unknown) {
  const scopes = normalizeAllowedList(input, OAUTH_SCOPES, ["identify"]);
  return scopes.length ? scopes : ["identify"];
}

export function normalizeWebhookEvents(input: unknown) {
  return normalizeAllowedList(input, WEBHOOK_EVENTS);
}

export function validateRedirectUris(input: unknown): ValidationResult<string[]> {
  if (!Array.isArray(input)) return { ok: false, message: "Передайте список redirect URI." };
  if (input.length > 10) return { ok: false, message: "Можно указать не более 10 redirect URI." };

  const normalized: string[] = [];
  for (const value of input) {
    if (typeof value !== "string" || !value.trim()) continue;
    const raw = value.trim();
    try {
      const url = new URL(raw);
      const isLocal = url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "[::1]";
      if (url.protocol !== "https:" && !(isLocal && url.protocol === "http:")) {
        return { ok: false, message: "Redirect URI должен использовать HTTPS. HTTP разрешён только для localhost." };
      }
      if (url.username || url.password || url.hash) {
        return { ok: false, message: "Redirect URI не должен содержать credentials или fragment." };
      }
      normalized.push(url.toString());
    } catch {
      return { ok: false, message: `Некорректный redirect URI: ${raw}` };
    }
  }

  const unique = [...new Set(normalized)];
  if (!unique.length) return { ok: false, message: "Добавьте хотя бы один redirect URI." };
  return { ok: true, value: unique };
}

export function isPrivateWebhookIp(address: string) {
  if (isIP(address) === 4) {
    const octets = address.split(".").map(Number);
    const [a, b] = octets;
    return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) || (a === 198 && (b === 18 || b === 19)) || a >= 224;
  }
  const normalized = address.toLowerCase();
  if (normalized === "::1" || normalized === "::") return true;
  if (normalized.startsWith("fc") || normalized.startsWith("fd") || normalized.startsWith("fe8") || normalized.startsWith("fe9") || normalized.startsWith("fea") || normalized.startsWith("feb")) return true;
  if (normalized.startsWith("::ffff:")) {
    const mapped = normalized.slice(7);
    return isIP(mapped) === 4 ? isPrivateWebhookIp(mapped) : true;
  }
  return false;
}

function blockedWebhookHost(hostname: string) {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) return true;
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host)) return true;
  if (host.includes(":")) return true;
  return false;
}

export function validateWebhookUrl(input: unknown): ValidationResult<string> {
  if (typeof input !== "string" || !input.trim()) return { ok: false, message: "Укажите URL webhook." };
  try {
    const url = new URL(input.trim());
    if (url.protocol !== "https:") return { ok: false, message: "Webhook URL должен использовать HTTPS." };
    if (blockedWebhookHost(url.hostname)) return { ok: false, message: "Webhook URL должен указывать на публичный HTTPS hostname, а не локальный или IP-адрес." };
    if (url.username || url.password || url.hash) return { ok: false, message: "Webhook URL не должен содержать credentials или fragment." };
    return { ok: true, value: url.toString() };
  } catch {
    return { ok: false, message: "Некорректный URL webhook." };
  }
}
