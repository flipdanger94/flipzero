export const Permission = {
  ViewChannels: 1 << 0,
  SendMessages: 1 << 1,
  ManageMessages: 1 << 2,
  ManageChannels: 1 << 3,
  ManageRoles: 1 << 4,
  ManageSpace: 1 << 5,
  CreateInvites: 1 << 6,
  KickMembers: 1 << 7,
  BanMembers: 1 << 8,
  ModerateMembers: 1 << 9,
  ConnectVoice: 1 << 10,
  SpeakVoice: 1 << 11,
  Stream: 1 << 12,
  Administrator: 1 << 30,
  // Backward-compatible aliases used by the v1 channel API.
  VIEW_CHANNEL: 1 << 0,
  SEND_MESSAGES: 1 << 1,
  MANAGE_MESSAGES: 1 << 2,
  ADMINISTRATOR: 1 << 30,
} as const;

export type PermissionName = keyof typeof Permission;

export const CHANNEL_PERMISSION_MASK =
  Permission.ViewChannels |
  Permission.SendMessages |
  Permission.ManageMessages |
  Permission.ConnectVoice |
  Permission.SpeakVoice |
  Permission.Stream;

export const ALL_PERMISSION_MASK =
  Permission.ViewChannels |
  Permission.SendMessages |
  Permission.ManageMessages |
  Permission.ManageChannels |
  Permission.ManageRoles |
  Permission.ManageSpace |
  Permission.CreateInvites |
  Permission.KickMembers |
  Permission.BanMembers |
  Permission.ModerateMembers |
  Permission.ConnectVoice |
  Permission.SpeakVoice |
  Permission.Stream |
  Permission.Administrator;

export function expandPermissions(value: number) {
  return (value & Permission.Administrator) === Permission.Administrator ? ALL_PERMISSION_MASK : value;
}

export function hasPermission(value: number, permission: number) {
  return (value & Permission.Administrator) === Permission.Administrator || (value & permission) === permission;
}

export function combinePermissions(...permissions: number[]) {
  return permissions.reduce((value, permission) => value | permission, 0);
}

export const DEFAULT_MEMBER_PERMISSIONS = combinePermissions(
  Permission.ViewChannels,
  Permission.SendMessages,
  Permission.CreateInvites,
  Permission.ConnectVoice,
  Permission.SpeakVoice,
);
