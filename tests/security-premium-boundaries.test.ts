import { describe, expect, it } from "vitest";
import { isTrustedMutationRequest } from "../lib/security-controls";
import { isSuperFlipActive, normalizeSuperFlipGiftReason, parseSuperFlipGiftPeriod, STANDARD_CAPABILITIES, subscriptionExpiry, superFlipGiftNotificationBody, SUPERFLIP_CAPABILITIES } from "../lib/superflip";

describe("trusted mutation origin boundaries", () => {
  it("accepts same-origin HTTPS requests", () => {
    const request = new Request("https://flipzero.app/api/v1/profile", {
      method: "POST",
      headers: {
        origin: "https://flipzero.app",
        "sec-fetch-site": "same-origin",
      },
    });
    expect(isTrustedMutationRequest(request)).toBe(true);
  });

  it("uses x-forwarded-host as the expected public host", () => {
    const request = new Request("http://internal:3000/api/v1/profile", {
      method: "POST",
      headers: {
        origin: "https://flipzero.app",
        "x-forwarded-host": "flipzero.app",
        "sec-fetch-site": "same-origin",
      },
    });
    expect(isTrustedMutationRequest(request)).toBe(true);
  });

  it("rejects cross-site and host-mismatched requests", () => {
    const crossSite = new Request("https://flipzero.app/api/v1/profile", {
      method: "POST",
      headers: {
        origin: "https://evil.example",
        "sec-fetch-site": "cross-site",
      },
    });
    const wrongHost = new Request("https://flipzero.app/api/v1/profile", {
      method: "POST",
      headers: {
        origin: "https://evil.example",
        "sec-fetch-site": "same-origin",
      },
    });
    expect(isTrustedMutationRequest(crossSite)).toBe(false);
    expect(isTrustedMutationRequest(wrongHost)).toBe(false);
  });

  it("allows server-to-server requests without an Origin header", () => {
    expect(isTrustedMutationRequest(new Request("https://flipzero.app/api/v1/profile", { method: "POST" }))).toBe(true);
  });
});

describe("SuperFlip entitlement boundaries", () => {
  const now = new Date("2026-09-22T12:00:00Z");

  it("rejects revoked grants even when they have not expired", () => {
    expect(isSuperFlipActive([{
      expiresAt: new Date("2026-10-22T12:00:00Z"),
      revokedAt: new Date("2026-09-21T12:00:00Z"),
    }], now)).toBe(false);
  });

  it("treats an expiry equal to now as expired", () => {
    expect(isSuperFlipActive([{ expiresAt: now, revokedAt: null }], now)).toBe(false);
  });

  it("accepts non-expiring unrevoked grants", () => {
    expect(isSuperFlipActive([{ expiresAt: null, revokedAt: null }], now)).toBe(true);
  });

  it("keeps premium limits strictly above standard limits", () => {
    expect(SUPERFLIP_CAPABILITIES.directMessageLimit).toBeGreaterThan(STANDARD_CAPABILITIES.directMessageLimit);
    expect(SUPERFLIP_CAPABILITIES.profileBioLimit).toBeGreaterThan(STANDARD_CAPABILITIES.profileBioLimit);
    expect(SUPERFLIP_CAPABILITIES.avatarUploadMb).toBeGreaterThan(STANDARD_CAPABILITIES.avatarUploadMb);
    expect(SUPERFLIP_CAPABILITIES.bannerUploadMb).toBeGreaterThan(STANDARD_CAPABILITIES.bannerUploadMb);
    expect(SUPERFLIP_CAPABILITIES.animatedProfileMedia).toBe(true);
    expect(STANDARD_CAPABILITIES.animatedProfileMedia).toBe(false);
  });

  it("clamps subscription months to the supported range", () => {
    expect(subscriptionExpiry(0, now).toISOString()).toBe(subscriptionExpiry(1, now).toISOString());
    expect(subscriptionExpiry(999, now).toISOString()).toBe(subscriptionExpiry(120, now).toISOString());
  });

  it("requires a non-empty gift reason and accepts only supported periods", () => {
    expect(normalizeSuperFlipGiftReason(undefined)).toBeNull();
    expect(normalizeSuperFlipGiftReason("   ")).toBeNull();
    expect(normalizeSuperFlipGiftReason("  Подарок за тестирование  ")).toBe("Подарок за тестирование");
    expect(normalizeSuperFlipGiftReason("x".repeat(600))).toHaveLength(500);
    expect(parseSuperFlipGiftPeriod("month")).toBe("month");
    expect(parseSuperFlipGiftPeriod("year")).toBe("year");
    expect(parseSuperFlipGiftPeriod("forever")).toBe("forever");
    expect(parseSuperFlipGiftPeriod("week")).toBeNull();
  });

  it("builds a user-facing gift notification with the period and reason", () => {
    expect(superFlipGiftNotificationBody("year", "За вклад в сообщество")).toBe("Срок: 1 год. Причина: За вклад в сообщество");
  });
});
