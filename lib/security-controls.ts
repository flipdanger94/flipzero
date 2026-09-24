import "server-only";
import { createHash } from "node:crypto";
import { compare } from "bcryptjs";

export function isTrustedMutationRequest(request: Request) {
  const fetchSite = request.headers.get("sec-fetch-site");

  // Fetch Metadata is the strongest signal when the browser sends it.
  // Explicitly reject cross-site mutations, while allowing same-origin,
  // same-site and browser/user initiated requests.
  if (fetchSite === "cross-site") return false;
  const origin = request.headers.get("origin");
  if (!origin) return true;

  try {
    const originUrl = new URL(origin);
    const requestUrl = new URL(request.url);
    const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
    const host = request.headers.get("host")?.trim();
    const allowedHosts = new Set([forwardedHost, host, requestUrl.host].filter((value): value is string => Boolean(value)));

    if (allowedHosts.has(originUrl.host)) {
      if (originUrl.protocol === "https:") return true;
      return originUrl.protocol === requestUrl.protocol;
    }

    if (fetchSite === "same-origin" && ["127.0.0.1", "localhost"].includes(requestUrl.hostname) && originUrl.protocol === "https:" && originUrl.hostname.endsWith(".app.github.dev")) return true;

    // GitHub Codespaces terminates TLS and may rewrite Host/request.url to an
    // internal address before Next.js receives the request. In that runtime,
    // trust only the public Codespaces HTTPS origin; cross-site browser
    // requests were already rejected above by Sec-Fetch-Site.
    if (process.env.CODESPACES === "true" && originUrl.protocol === "https:" && originUrl.hostname.endsWith(".app.github.dev")) {
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

export function requestFingerprint(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const address = forwarded || request.headers.get("x-real-ip") || "unknown";
  return createHash("sha256").update(address).digest("hex");
}

export async function verifyCurrentPassword(password: unknown, passwordHash: string | null | undefined) {
  return typeof password === "string" && password.length > 0 && Boolean(passwordHash) && compare(password, passwordHash!);
}

export function isCurrentSessionToken(targetTokenHash: string, currentToken: string | null | undefined) {
  if (!currentToken) return false;
  return targetTokenHash === createHash("sha256").update(currentToken).digest("hex");
}
