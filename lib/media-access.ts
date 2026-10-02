import "server-only";
import { and, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { getDatabase } from "@/db/client";
import { clanMembers, clanMessages, directConversationMembers, directMessages, mediaAssets, mediaAttachmentLinks, messages, userBlocks } from "@/db/schema";
import { getChannelPermissions, hasPermission, SpacePermission } from "@/lib/space-permissions";
import type { DirectAttachment } from "@/lib/direct-message";
import type { XpTransaction } from "@/lib/xp";

export class InvalidAttachmentError extends Error {
  constructor() { super("Вложение недоступно. Загрузите файл заново."); }
}

// Lock files before linking: pending-file cleanup must not race message creation.
export async function attachMedia(tx: XpTransaction, userId: string, attachments: DirectAttachment[], contextType: "direct" | "channel" | "clan", contextId: string, messageId: string) {
  if (!attachments.length) return;
  const ids = [...new Set(attachments.map(item => item.url.split("/").at(-1)!))].sort();
  const assets = await tx.select({ id: mediaAssets.id, contentType: mediaAssets.contentType, size: sql<number>`octet_length(${mediaAssets.bytes})` })
    .from(mediaAssets).where(and(inArray(mediaAssets.id, ids), eq(mediaAssets.ownerId, userId), eq(mediaAssets.purpose, "attachment"))).orderBy(mediaAssets.id).for("update");
  if (assets.length !== ids.length || attachments.some(item => {
    const asset = assets.find(row => row.id === item.url.split("/").at(-1)!);
    return !asset || asset.contentType !== item.mimeType || Number(asset.size) !== item.size ||
      item.type !== (asset.contentType.startsWith("image/") ? "image" : asset.contentType.startsWith("audio/") ? "audio" : "file");
  })) throw new InvalidAttachmentError();
  await tx.update(mediaAssets).set({ attachedAt: new Date() }).where(inArray(mediaAssets.id, ids));
  await tx.insert(mediaAttachmentLinks).values(ids.map(assetId => ({ assetId, contextType, contextId, messageId }))).onConflictDoNothing();
}

export async function mayReadAttachment(userId: string, assetId: string, ownerId: string | null, attachedAt: Date | null) {
  const db = getDatabase();
  if (!attachedAt) return ownerId === userId;
  const links = await db.select().from(mediaAttachmentLinks).where(eq(mediaAttachmentLinks.assetId, assetId));
  for (const link of links) {
    if (link.contextType === "channel") {
      const [message] = await db.select({ id: messages.id }).from(messages).where(and(eq(messages.id, link.messageId), eq(messages.channelId, link.contextId), isNull(messages.deletedAt))).limit(1);
      if (!message) continue;
      const access = await getChannelPermissions(link.contextId, userId);
      if (access.owner || (hasPermission(access.permissions, SpacePermission.ViewChannels) && hasPermission(access.permissions, SpacePermission.ReadHistory))) return true;
    } else if (link.contextType === "clan") {
      const [message] = await db.select({ id: clanMessages.id }).from(clanMessages)
        .innerJoin(clanMembers, and(eq(clanMembers.clanId, clanMessages.clanId), eq(clanMembers.userId, userId)))
        .where(and(eq(clanMessages.id, link.messageId), eq(clanMessages.clanId, link.contextId), isNull(clanMessages.deletedAt))).limit(1);
      if (message) return true;
    } else if (link.contextType === "direct") {
      const [message] = await db.select({ senderId: directMessages.senderId, receiverId: directMessages.receiverId }).from(directMessages)
        .innerJoin(directConversationMembers, and(eq(directConversationMembers.conversationId, directMessages.conversationId), eq(directConversationMembers.userId, userId)))
        .where(and(eq(directMessages.id, link.messageId), eq(directMessages.conversationId, link.contextId), isNull(directMessages.deletedAt))).limit(1);
      if (!message) continue;
      const otherId = message.senderId === userId ? message.receiverId : message.senderId;
      const [blocked] = await db.select({ id: userBlocks.blockerId }).from(userBlocks).where(or(
        and(eq(userBlocks.blockerId, userId), eq(userBlocks.blockedId, otherId)),
        and(eq(userBlocks.blockerId, otherId), eq(userBlocks.blockedId, userId)),
      )).limit(1);
      if (!blocked) return true;
    }
  }
  return false;
}
