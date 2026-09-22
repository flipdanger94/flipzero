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

export function validateWebhookUrl(input: unknown): ValidationResult<string> {
  if (typeof input !== "string" || !input.trim()) return { ok: false, message: "Укажите URL webhook." };
  try {
    const url = new URL(input.trim());
    if (url.protocol !== "https:") return { ok: false, message: "Webhook URL должен использовать HTTPS." };
    if (url.username || url.password || url.hash) return { ok: false, message: "Webhook URL не должен содержать credentials или fragment." };
    return { ok: true, value: url.toString() };
  } catch {
    return { ok: false, message: "Некорректный URL webhook." };
  }
}
