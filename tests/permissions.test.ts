import { describe, expect, it } from "vitest";
import {
  ALL_PERMISSION_MASK,
  CHANNEL_PERMISSION_MASK,
  DEFAULT_MEMBER_PERMISSIONS,
  expandPermissions,
  hasPermission,
  Permission,
} from "../lib/permissions";
import { roleSchema } from "../lib/role-validation";

describe("server permissions", () => {
  it("treats Administrator as every known permission", () => {
    const effective = expandPermissions(Permission.Administrator);
    expect(effective).toBe(ALL_PERMISSION_MASK);
    expect(hasPermission(Permission.Administrator, Permission.ManageSpace)).toBe(true);
    expect(hasPermission(Permission.Administrator, Permission.BanMembers)).toBe(true);
    expect(hasPermission(Permission.Administrator, Permission.Stream)).toBe(true);
  });

  it("keeps channel overrides limited to channel-scoped permissions", () => {
    expect(CHANNEL_PERMISSION_MASK & Permission.ViewChannels).toBe(Permission.ViewChannels);
    expect(CHANNEL_PERMISSION_MASK & Permission.SendMessages).toBe(Permission.SendMessages);
    expect(CHANNEL_PERMISSION_MASK & Permission.ManageMessages).toBe(Permission.ManageMessages);
    expect(CHANNEL_PERMISSION_MASK & Permission.ConnectVoice).toBe(Permission.ConnectVoice);
    expect(CHANNEL_PERMISSION_MASK & Permission.SpeakVoice).toBe(Permission.SpeakVoice);
    expect(CHANNEL_PERMISSION_MASK & Permission.Stream).toBe(Permission.Stream);

    expect(CHANNEL_PERMISSION_MASK & Permission.ManageChannels).toBe(0);
    expect(CHANNEL_PERMISSION_MASK & Permission.ManageRoles).toBe(0);
    expect(CHANNEL_PERMISSION_MASK & Permission.ManageSpace).toBe(0);
    expect(CHANNEL_PERMISSION_MASK & Permission.CreateInvites).toBe(0);
    expect(CHANNEL_PERMISSION_MASK & Permission.KickMembers).toBe(0);
    expect(CHANNEL_PERMISSION_MASK & Permission.BanMembers).toBe(0);
    expect(CHANNEL_PERMISSION_MASK & Permission.ModerateMembers).toBe(0);
    expect(CHANNEL_PERMISSION_MASK & Permission.Administrator).toBe(0);
  });

  it("gives default members only normal participation permissions", () => {
    expect(hasPermission(DEFAULT_MEMBER_PERMISSIONS, Permission.ViewChannels)).toBe(true);
    expect(hasPermission(DEFAULT_MEMBER_PERMISSIONS, Permission.SendMessages)).toBe(true);
    expect(hasPermission(DEFAULT_MEMBER_PERMISSIONS, Permission.ConnectVoice)).toBe(true);
    expect(hasPermission(DEFAULT_MEMBER_PERMISSIONS, Permission.SpeakVoice)).toBe(true);
    expect(hasPermission(DEFAULT_MEMBER_PERMISSIONS, Permission.ManageChannels)).toBe(false);
    expect(hasPermission(DEFAULT_MEMBER_PERMISSIONS, Permission.ManageRoles)).toBe(false);
    expect(hasPermission(DEFAULT_MEMBER_PERMISSIONS, Permission.BanMembers)).toBe(false);
  });

  it("rejects unknown permission bits in role payloads", () => {
    const valid = roleSchema.safeParse({
      name: "Moderator",
      color: "#7c6df2",
      permissions: Permission.ViewChannels | Permission.ManageMessages,
    });
    expect(valid.success).toBe(true);

    const unknownBit = 1 << 20;
    const invalid = roleSchema.safeParse({
      name: "Escalated",
      color: "#7c6df2",
      permissions: Permission.ViewChannels | unknownBit,
    });
    expect(invalid.success).toBe(false);
  });
});
