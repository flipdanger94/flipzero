import { createHash } from "node:crypto";

export function createPkceS256Challenge(verifier: string) {
  return createHash("sha256").update(verifier).digest("base64url");
}
