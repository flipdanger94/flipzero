import "server-only";
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from "node:crypto";

function encryptionKey() {
  const source = process.env.DEVELOPER_SECRET_KEY ?? process.env.SESSION_SECRET;
  if (!source) throw new Error("DEVELOPER_SECRET_KEY or SESSION_SECRET is not configured");
  return createHash("sha256").update(source).digest();
}

export function encryptDeveloperSecret(secret: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), encrypted].map((part) => part.toString("base64url")).join(".");
}

export function decryptDeveloperSecret(payload: string) {
  const [iv, tag, encrypted] = payload.split(".").map((part) => Buffer.from(part, "base64url"));
  if (!iv || !tag || !encrypted) throw new Error("Invalid developer secret payload");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}

export function signDeveloperPayload(secret: string, payload: string) {
  return createHmac("sha256", secret).update(payload).digest("hex");
}
