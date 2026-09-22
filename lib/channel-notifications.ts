import "server-only";
import { randomUUID } from "node:crypto";
import { and, eq, inArray, or } from "drizzle-orm";
import { getDatabase } from "@/db/client";
import { channelNotificationSettings, members, notifications, spaceNotificationSettings, userBlocks, users } from "@/db/schema";
import { getChannelPermissions } from "@/lib/space-permissions";
import { hasPermission, Permission } from "@/lib/permissions";

type Sender = { id: string; displayName: string; username: string };

export async function createChannelMessageNotifications(input: {
  spaceId: string;
  channelId: string;
  channelName: string;
  messageId: string;
  content: string;
  sender: Sender;
}) {
  const db = getDatabase();
  const mentionNames = [...new Set(Array.from(input.content.matchAll(/@([a-zA-Z0-9_.-]{2,32})/g), (match) => match[1]))].slice(0, 20);

  const [spaceAll, channelAll, mentionedUsers] = await Promise.all([
    db.select({ userId: spaceNotificationSettings.userId }).from(spaceNotificationSettings).where(and(
      eq(spaceNotificationSettings.spaceId, input.spaceId),
      eq(spaceNotificationSettings.mode, "all"),
    )),
    db.select({ userId: channelNotificationSettings.userId }).from(channelNotificationSettings).where(and(
      eq(channelNotificationSettings.channelId, input.channelId),
      eq(channelNotificationSettings.mode, "all"),
    )),
    mentionNames.length
      ? db.select({ id: users.id, username: users.username }).from(users)
          .innerJoin(members, and(eq(members.userId, users.id), eq(members.spaceId, input.spaceId)))
          .where(inArray(users.username, mentionNames))
      : Promise.resolve([]),
  ]);

  const mentionedIds = new Set(mentionedUsers.map((user) => user.id));
  const candidateIds = [...new Set([
    ...spaceAll.map((item) => item.userId),
    ...channelAll.map((item) => item.userId),
    ...mentionedUsers.map((item) => item.id),
  ].filter((id) => id !== input.sender.id))];
  if (!candidateIds.length) return;

  const blockedRelationships = await db.select({ blockerId: userBlocks.blockerId, blockedId: userBlocks.blockedId }).from(userBlocks).where(or(
    and(eq(userBlocks.blockerId, input.sender.id), inArray(userBlocks.blockedId, candidateIds)),
    and(inArray(userBlocks.blockerId, candidateIds), eq(userBlocks.blockedId, input.sender.id)),
  ));
  const blockedRecipientIds = new Set(blockedRelationships.map((row) => row.blockerId === input.sender.id ? row.blockedId : row.blockerId));

  const [spaceModes, channelModes] = await Promise.all([
    db.select({ userId: spaceNotificationSettings.userId, mode: spaceNotificationSettings.mode }).from(spaceNotificationSettings).where(and(
      eq(spaceNotificationSettings.spaceId, input.spaceId),
      inArray(spaceNotificationSettings.userId, candidateIds),
    )),
    db.select({ userId: channelNotificationSettings.userId, mode: channelNotificationSettings.mode }).from(channelNotificationSettings).where(and(
      eq(channelNotificationSettings.channelId, input.channelId),
      inArray(channelNotificationSettings.userId, candidateIds),
    )),
  ]);
  const spaceModeMap = new Map(spaceModes.map((item) => [item.userId, item.mode]));
  const channelModeMap = new Map(channelModes.map((item) => [item.userId, item.mode]));

  const recipients: Array<{ userId: string; mentioned: boolean }> = [];
  for (const userId of candidateIds) {
    if (blockedRecipientIds.has(userId)) continue;
    const serverMode = spaceModeMap.get(userId) ?? "mentions";
    const channelMode = channelModeMap.get(userId);
    const effectiveMode = channelMode === "none" ? "off" : channelMode ?? serverMode;
    const mentioned = mentionedIds.has(userId);
    if (effectiveMode === "off" || (effectiveMode === "mentions" && !mentioned)) continue;
    const permissionState = await getChannelPermissions(input.channelId, userId);
    if (!permissionState.spaceId || !hasPermission(permissionState.permissions, Permission.ViewChannels)) continue;
    recipients.push({ userId, mentioned });
  }
  if (!recipients.length) return;

  const excerpt = input.content.trim().slice(0, 180) || "Голосовое сообщение";
  await db.insert(notifications).values(recipients.map(({ userId, mentioned }) => ({
    id: randomUUID(),
    userId,
    actorId: input.sender.id,
    type: mentioned ? "channel_mention" : "channel_message",
    title: mentioned ? `Вас упомянули в #${input.channelName}` : `Новое сообщение в #${input.channelName}`,
    body: excerpt,
    entityType: "space_channel",
    entityId: `${input.spaceId}:${input.channelId}`,
  })));
}
