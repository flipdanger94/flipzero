import { describe, expect, it } from "vitest";
import { createHash, createHmac } from "node:crypto";
import { hash } from "bcryptjs";
import { hasAdminRole } from "../lib/access";
import { normalizeDirectMessage } from "../lib/direct-message";
import { isCurrentSessionToken, verifyCurrentPassword } from "../lib/security-controls";
import { isSuperFlipActive, subscriptionExpiry } from "../lib/superflip";
import { createTotpSecret, decryptTotpSecret, encryptTotpSecret, hashBackupCode, verifyTotp } from "../lib/totp";

describe("SuperFlip grants", () => {
  it("accepts an unrevoked future grant and rejects an expired grant", () => {
    const now = new Date("2026-09-20T00:00:00Z");
    expect(isSuperFlipActive([{ expiresAt: new Date("2026-10-20T00:00:00Z"), revokedAt: null }], now)).toBe(true);
    expect(isSuperFlipActive([{ expiresAt: new Date("2026-08-20T00:00:00Z"), revokedAt: null }], now)).toBe(false);
    expect(subscriptionExpiry(1, now).toISOString()).toBe("2026-10-20T00:00:00.000Z");
  });
});

describe("admin permissions", () => {
  it("allows only the persisted admin role", () => {
    expect(hasAdminRole({ platformRole: "admin" })).toBe(true);
    expect(hasAdminRole({ platformRole: "user" })).toBe(false);
    expect(hasAdminRole(null)).toBe(false);
  });
});

describe("direct message sending", () => {
  it("normalizes valid text and rejects empty or oversized messages", () => {
    expect(normalizeDirectMessage("  Привет!  ")).toBe("Привет!");
    expect(normalizeDirectMessage("   ")).toBeNull();
    expect(normalizeDirectMessage("x".repeat(4001))).toBeNull();
  });
});

describe("account security", () => {
  it("encrypts TOTP secrets and verifies a valid time-based code", () => {
    process.env.TOTP_ENCRYPTION_KEY = "test-only-key-that-is-long-enough-for-encryption";
    const secret = createTotpSecret();
    const encrypted = encryptTotpSecret(secret);
    expect(encrypted).not.toContain(secret);
    expect(decryptTotpSecret(encrypted)).toBe(secret);
    expect(verifyTotp(secret, totpCode(secret, 1_800_000), 1_800_000)).toBe(true);
    expect(verifyTotp(secret, "000000", 1_800_000)).toBe(false);
  });

  it("normalizes backup codes before hashing", () => {
    expect(hashBackupCode("ab12-cd34")).toBe(hashBackupCode(" AB12-CD34 "));
  });

  it("requires the current password before disabling 2FA", async () => {
    const passwordHash = await hash("correct horse battery staple", 4);
    await expect(verifyCurrentPassword("correct horse battery staple", passwordHash)).resolves.toBe(true);
    await expect(verifyCurrentPassword("wrong password", passwordHash)).resolves.toBe(false);
    await expect(verifyCurrentPassword(null, passwordHash)).resolves.toBe(false);
  });

  it("recognizes and protects the current session token", () => {
    const token = "current-session-token";
    const tokenHash = createHash("sha256").update(token).digest("hex");
    expect(isCurrentSessionToken(tokenHash, token)).toBe(true);
    expect(isCurrentSessionToken(tokenHash, "another-token")).toBe(false);
    expect(isCurrentSessionToken("", null)).toBe(false);
  });
});

function totpCode(secret: string, now: number) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const char of secret) bits += alphabet.indexOf(char).toString(2).padStart(5, "0");
  const bytes: number[] = [];
  for (let index = 0; index + 8 <= bits.length; index += 8) bytes.push(Number.parseInt(bits.slice(index, index + 8), 2));
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(now / 30_000)));
  const digest = createHmac("sha1", Buffer.from(bytes)).update(counter).digest();
  const offset = digest[digest.length - 1] & 15;
  return ((digest.readUInt32BE(offset) & 0x7fffffff) % 1_000_000).toString().padStart(6, "0");
}
