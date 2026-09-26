import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("store profile WYSIWYG preview", () => {
  const economy = readFileSync("components/personal-economy.tsx", "utf8");
  const profileSurface = readFileSync("components/profile-appearance-surface.tsx", "utf8");
  const liveProfile = readFileSync("components/user-profile-popover.tsx", "utf8");

  it("uses the same profile appearance renderer in store and live profile", () => {
    expect(economy).toContain("<ProfileAppearanceSurface");
    expect(liveProfile).toContain("<ProfileAppearanceSurface");
    expect(profileSurface).toContain("fz-mini-banner");
    expect(profileSurface).toContain("fz-mini-avatar");
    expect(profileSurface).toContain("fz-mini-xp");
  });

  it("loads the full current profile instead of a placeholder identity", () => {
    expect(economy).toContain("/api/v1/users/");
    expect(economy).toContain("setProfile(result.profile)");
    expect(economy).not.toContain("store-preview-profile cosmetic-");
  });

  it("layers selected cosmetics over the currently equipped appearance", () => {
    expect(economy).toContain("Object.values(inventory.equipped)");
    expect(economy).toContain("previewAppliedItems");
    expect(economy).toContain("previewItem.bundleItems");
    expect(economy).toContain("resolved[item.category]=item.preview");
  });

  it("shows all profile-facing cosmetic slots in the preview renderer", () => {
    expect(profileSurface).toContain("cosmetics.banner");
    expect(profileSurface).toContain("cosmetics.avatar_frame");
    expect(profileSurface).toContain("cosmetics.nickname");
    expect(profileSurface).toContain("cosmetics.profile_effect");
    expect(profileSurface).toContain("cosmetics.badge");
    expect(profileSurface).toContain("cosmetics.message_effect");
  });
});
