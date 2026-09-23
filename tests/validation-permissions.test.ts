import { describe, expect, it } from "vitest";
import { loginSchema, registerSchema } from "../lib/auth-validation";
import { updateAccountSchema, updatePasswordSchema } from "../lib/account-validation";
import { createCategorySchema, createChannelSchema, createSpaceSchema, updateSpaceSchema } from "../lib/space-validation";
import { combinePermissions, DEFAULT_MEMBER_PERMISSIONS, hasPermission, Permission } from "../lib/permissions";
import { decodeDirectMessage, encodeDirectMessage, normalizeDirectAttachments, normalizeDirectMessage } from "../lib/direct-message";
import { isProtectedRoute, loginPathFor } from "../lib/route-access";

describe("authentication validation", () => {
  it("normalizes registration email and accepts a valid account", () => {
    const parsed = registerSchema.parse({
      email: "  User@Example.com ".trim(),
      username: "Flip_User",
      displayName: "Flip User",
      password: "strong-password",
      acceptedTerms: true,
      acceptedPrivacy: true,
    });
    expect(parsed.email).toBe("user@example.com");
    expect(parsed.username).toBe("Flip_User");
  });

  it("rejects short passwords, invalid usernames and missing consent", () => {
    expect(registerSchema.safeParse({
      email: "user@example.com",
      username: "a!",
      displayName: "U",
      password: "short",
      acceptedTerms: false,
      acceptedPrivacy: true,
    }).success).toBe(false);
  });

  it("accepts OTP on login but rejects empty passwords", () => {
    expect(loginSchema.safeParse({ email: "user@example.com", password: "secret", otp: "123456" }).success).toBe(true);
    expect(loginSchema.safeParse({ email: "user@example.com", password: "" }).success).toBe(false);
  });
});

describe("account validation", () => {
  it("accepts a bounded editable profile", () => {
    expect(updateAccountSchema.safeParse({
      displayName: "Alexander",
      username: "flipdanger",
      bio: "Создаю FlipZero",
    }).success).toBe(true);
  });

  it("rejects invalid usernames and oversized bios", () => {
    expect(updateAccountSchema.safeParse({ displayName: "Alex", username: "bad name", bio: "" }).success).toBe(false);
    expect(updateAccountSchema.safeParse({ displayName: "Alex", username: "alex", bio: "x".repeat(501) }).success).toBe(false);
  });

  it("requires a sufficiently long new password", () => {
    expect(updatePasswordSchema.safeParse({ currentPassword: "old-password", newPassword: "1234567890" }).success).toBe(true);
    expect(updatePasswordSchema.safeParse({ currentPassword: "old-password", newPassword: "123" }).success).toBe(false);
  });
});

describe("space and channel validation", () => {
  it("normalizes channel whitespace into hyphens", () => {
    const parsed = createChannelSchema.parse({
      name: "Общий чат",
      topic: "Главный канал",
      kind: "text",
      parentId: null,
    });
    expect(parsed.name).toBe("Общий-чат");
  });

  it("accepts supported channel kinds and rejects unsupported ones", () => {
    for (const kind of ["text", "forum", "voice", "stage", "announcement", "board"]) {
      expect(createChannelSchema.safeParse({ name: "channel", kind }).success).toBe(true);
    }
    expect(createChannelSchema.safeParse({ name: "channel", kind: "video" }).success).toBe(false);
  });

  it("requires UUID category parent IDs", () => {
    expect(createChannelSchema.safeParse({ name: "channel", kind: "text", parentId: "not-a-uuid" }).success).toBe(false);
  });

  it("enforces space visibility and accent color", () => {
    expect(createSpaceSchema.safeParse({ name: "FlipZero", visibility: "public", accentColor: "#00d4ff" }).success).toBe(true);
    expect(createSpaceSchema.safeParse({ name: "FlipZero", visibility: "world", accentColor: "#00d4ff" }).success).toBe(false);
    expect(updateSpaceSchema.safeParse({ name: "FlipZero", description: "", visibility: "public", accentColor: "blue" }).success).toBe(false);
  });

  it("bounds category names", () => {
    expect(createCategorySchema.safeParse({ name: "Проекты" }).success).toBe(true);
    expect(createCategorySchema.safeParse({ name: "x".repeat(33) }).success).toBe(false);
  });
});

describe("permission model", () => {
  it("combines independent permissions", () => {
    const value = combinePermissions(Permission.ViewChannels, Permission.SendMessages, Permission.ManageMessages);
    expect(hasPermission(value, Permission.ViewChannels)).toBe(true);
    expect(hasPermission(value, Permission.SendMessages)).toBe(true);
    expect(hasPermission(value, Permission.ManageRoles)).toBe(false);
  });

  it("administrator bypasses individual permission checks", () => {
    expect(hasPermission(Permission.Administrator, Permission.BanMembers)).toBe(true);
    expect(hasPermission(Permission.Administrator, Permission.ManageSpace)).toBe(true);
  });

  it("default members can chat and use voice but cannot moderate", () => {
    expect(hasPermission(DEFAULT_MEMBER_PERMISSIONS, Permission.ViewChannels)).toBe(true);
    expect(hasPermission(DEFAULT_MEMBER_PERMISSIONS, Permission.SendMessages)).toBe(true);
    expect(hasPermission(DEFAULT_MEMBER_PERMISSIONS, Permission.ConnectVoice)).toBe(true);
    expect(hasPermission(DEFAULT_MEMBER_PERMISSIONS, Permission.AttachFiles)).toBe(true);
    expect(hasPermission(DEFAULT_MEMBER_PERMISSIONS, Permission.AddReactions)).toBe(true);
    expect(hasPermission(DEFAULT_MEMBER_PERMISSIONS, Permission.BanMembers)).toBe(false);
    expect(hasPermission(DEFAULT_MEMBER_PERMISSIONS, Permission.ManageRoles)).toBe(false);
  });
});

describe("limits and protected routes", () => {
  it("enforces the 4000-character hard ceiling for direct messages", () => {
    expect(normalizeDirectMessage("x".repeat(4000))?.length).toBe(4000);
    expect(normalizeDirectMessage("x".repeat(4001))).toBeNull();
    expect(normalizeDirectMessage("x".repeat(1001), 1000)).toBeNull();
  });

  it("round-trips validated direct-message attachments", () => {
    const attachments = normalizeDirectAttachments([{
      type: "image",
      url: "/api/v1/media/123e4567-e89b-12d3-a456-426614174000",
      name: "preview.png",
      mimeType: "image/png",
      size: 1024,
    }]);
    expect(attachments).toHaveLength(1);
    const decoded = decodeDirectMessage(encodeDirectMessage("Фото", attachments));
    expect(decoded.text).toBe("Фото");
    expect(decoded.attachments[0]?.name).toBe("preview.png");
  });

  it("protects OAuth consent and install pages", () => {
    expect(isProtectedRoute("/oauth/authorize")).toBe(true);
    expect(isProtectedRoute("/oauth/install")).toBe(true);
    expect(loginPathFor("/oauth/authorize", "?client_id=abc")).toBe("/login?next=%2Foauth%2Fauthorize%3Fclient_id%3Dabc");
  });
});
