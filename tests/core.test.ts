import { describe, expect, it } from "vitest";
import { hasAdminRole } from "../lib/access";
import { normalizeDirectMessage } from "../lib/direct-message";
import { isSuperFlipActive, subscriptionExpiry } from "../lib/superflip";

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
