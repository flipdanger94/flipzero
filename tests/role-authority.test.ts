import { describe, expect, it } from "vitest";
import { Permission } from "../lib/permissions";
import { canGrantRolePermissions, canManageRole } from "../lib/role-authority";

describe("role management boundaries", () => {
  it("prevents managing equal or higher roles", () => {
    expect(canManageRole(false, 5, 4)).toBe(true);
    expect(canManageRole(false, 5, 5)).toBe(false);
    expect(canManageRole(false, 5, 6)).toBe(false);
    expect(canManageRole(true, 5, 6)).toBe(true);
  });

  it("prevents granting rights the actor does not have or administrator", () => {
    const actor = Permission.ManageRoles | Permission.ViewChannels;
    expect(canGrantRolePermissions(false, actor, Permission.ViewChannels)).toBe(true);
    expect(canGrantRolePermissions(false, actor, Permission.KickMembers)).toBe(false);
    expect(canGrantRolePermissions(false, actor, Permission.Administrator)).toBe(false);
    expect(canGrantRolePermissions(true, actor, Permission.Administrator)).toBe(true);
  });
});
