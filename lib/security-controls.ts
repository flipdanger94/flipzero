import "server-only";
import { createHash } from "node:crypto";
import { compare } from "bcryptjs";

export function isTrustedMutationRequest(request: Request) {
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite === "cross-site") return false;
  if (fetchSite === "same-origin") return true;

  const origin = request.headers.get("origin");
  if (!origin) return true;

  try {
    const originUrl = new URL(origin);
    const requestUrl = new URL(request.url);
    const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
    const host = request.headers.get("host")?.trim();
    const allowedHosts = new Set([forwardedHost, host, requestUrl.host].filter((value): value is string => Boolean(value)));

    if (!allowedHosts.has(originUrl.host)) return false;

    // Reverse proxies such as GitHub Codespaces terminate HTTPS before the
    // request reaches Next.js, so request.url may be http://localhost while
    // the browser Origin remains the public https://*.app.github.dev host.
    // Matching the externally forwarded/Host value keeps the mutation
    // same-origin without rejecting that proxy setup.
    if (originUrl.protocol === "https:") return true;
    return originUrl.protocol === requestUrl.protocol;
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
