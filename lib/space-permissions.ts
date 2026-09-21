import { and, eq, inArray } from "drizzle-orm";
import { getDatabase } from "@/db/client";
import { channelOverrides, channels, memberRoles, members, roles, spaces } from "@/db/schema";
import { Permission, hasPermission } from "@/lib/permissions";

export const SpacePermission = Permission;\n\nexport async function getChannelPermissions(channelId: string, userId: string) {
  const db = getDatabase();
  const [base] = await db.select({ spaceId: channels.spaceId, ownerId: spaces.ownerId })
    .from(channels).innerJoin(spaces, eq(spaces.id, channels.spaceId))
    .innerJoin(members, and(eq(members.spaceId, channels.spaceId), eq(members.userId, userId)))
    .where(eq(channels.id, channelId)).limit(1);
  if (!base) return { spaceId: null, owner: false, permissions: 0 };
  if (base.ownerId === userId) return { spaceId: base.spaceId, owner: true, permissions: SpacePermission.ADMINISTRATOR };
  const assigned = await db.select({ roleId: memberRoles.roleId }).from(memberRoles)
    .where(and(eq(memberRoles.userId, userId), eq(memberRoles.spaceId, base.spaceId)));
  const roleIds = assigned.map((item) => item.roleId);
  let permissions = 0;
  if (roleIds.length) {
    const roleRows = await db.select({ permissions: roles.permissions }).from(roles)
      .where(and(eq(roles.spaceId, base.spaceId), inArray(roles.id, roleIds)));
    permissions = roleRows.reduce((value, role) => value | Number(role.permissions), 0);
  }
  if ((permissions & SpacePermission.ADMINISTRATOR) !== 0) return { spaceId: base.spaceId, owner: false, permissions };
  const overrides = await db.select().from(channelOverrides).where(eq(channelOverrides.channelId, channelId));
  let roleAllow = 0, roleDeny = 0;
  for (const item of overrides) if (item.targetType === "role" && roleIds.includes(item.targetId)) { roleAllow |= Number(item.allow); roleDeny |= Number(item.deny); }
  permissions = (permissions & ~roleDeny) | roleAllow;
  const memberOverride = overrides.find((item) => item.targetType === "member" && item.targetId === userId);
  if (memberOverride) permissions = (permissions & ~Number(memberOverride.deny)) | Number(memberOverride.allow);
  return { spaceId: base.spaceId, owner: false, permissions };
}

export { hasPermission };\n