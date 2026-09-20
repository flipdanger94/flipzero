import "server-only";
import { createHash } from "node:crypto";
import { compare } from "bcryptjs";

export async function verifyCurrentPassword(password: unknown, passwordHash: string | null | undefined) {
  return typeof password === "string" && password.length > 0 && Boolean(passwordHash) && compare(password, passwordHash!);
}

export function isCurrentSessionToken(targetTokenHash: string, currentToken: string | null | undefined) {
  if (!currentToken) return false;
  return targetTokenHash === createHash("sha256").update(currentToken).digest("hex");
}
