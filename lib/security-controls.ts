import "server-only";
import { createHash } from "node:crypto";
import { compare } from "bcryptjs";

export function isTrustedMutationRequest(request: Request) {
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite === "cross-site") return false;

  const origin = request.headers.get("origin");
  if (!origin) return true;

  try {
    const originUrl = new URL(origin);
    const requestUrl = new URL(request.url);
    const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
    const expectedHost = forwardedHost || requestUrl.host;
    return originUrl.protocol === "https:" || requestUrl.protocol !== "https:"
      ? originUrl.host === expectedHost
      : false;
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
