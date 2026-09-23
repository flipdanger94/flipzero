import { Permission } from "@/lib/permissions";

export function canManageRole(owner: boolean, actorTop: number, targetPosition: number) {
  return owner || targetPosition < actorTop;
}

export function canGrantRolePermissions(owner: boolean, actorPermissions: number, requested: number) {
  return owner || ((requested & Permission.Administrator) === 0 && (requested & ~actorPermissions) === 0);
}
