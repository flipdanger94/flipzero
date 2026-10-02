import "server-only";
import { randomUUID } from "node:crypto";
import { and, eq, gt, inArray, isNotNull, isNull, lt, sql } from "drizzle-orm";
import { getDatabase } from "@/db/client";
import { mediaAssets, passwordResetAttempts } from "@/db/schema";

export async function cleanupPendingAttachments() {
  const db = getDatabase();
  const expired = lt(mediaAssets.createdAt, new Date(Date.now() - 24 * 60 * 60_000));
  const noLiveMessage = sql`not exists (
      select 1 from media_attachment_links l
      left join messages m on l.context_type='channel' and m.id=l.message_id and m.channel_id=l.context_id and m.deleted_at is null
      left join clan_messages c on l.context_type='clan' and c.id=l.message_id and c.clan_id=l.context_id and c.deleted_at is null
      left join direct_messages d on l.context_type='direct' and d.id=l.message_id and d.conversation_id=l.context_id and d.deleted_at is null
      where l.asset_id=${mediaAssets.id} and (m.id is not null or c.id is not null or d.id is not null)
    )`;
  await db.delete(mediaAssets).where(and(eq(mediaAssets.purpose, "attachment"), isNull(mediaAssets.attachedAt), expired, noLiveMessage));
  // Take row locks before rechecking orphaned sent files in a fresh statement.
  // A simultaneous reattachment either keeps the file or fails before sending.
  await db.transaction(async tx => {
    const rows = await tx.select({ id: mediaAssets.id }).from(mediaAssets)
      .where(and(eq(mediaAssets.purpose, "attachment"), isNotNull(mediaAssets.attachedAt), expired, noLiveMessage))
      .orderBy(mediaAssets.id).limit(100).for("update", { skipLocked: true });
    if (rows.length) await tx.delete(mediaAssets).where(and(inArray(mediaAssets.id, rows.map(row => row.id)), noLiveMessage));
  });
}

// Serialize quota checks across all instances; never load file bytes to count storage.
export async function storeAttachment(userId: string, id: string, bytes: Buffer, contentType: string, premium: boolean) {
  const quotaBytes = (premium ? 256 : 64) * 1024 * 1024;
  return getDatabase().transaction(async tx => {
    const key = `upload:${userId}`;
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))`);
    const [attempts] = await tx.select({ value: sql<number>`count(*)::int` }).from(passwordResetAttempts)
      .where(and(eq(passwordResetAttempts.ipHash, key), gt(passwordResetAttempts.createdAt, new Date(Date.now() - 15 * 60_000))));
    if (Number(attempts.value) >= 20) return { ok: false as const, reason: "rate" as const, quotaBytes };
    await tx.insert(passwordResetAttempts).values({ id: randomUUID(), ipHash: key, emailHash: key });
    const [storage] = await tx.select({ bytes: sql<number>`coalesce(sum(octet_length(${mediaAssets.bytes})), 0)::bigint` })
      .from(mediaAssets).where(and(eq(mediaAssets.ownerId, userId), eq(mediaAssets.purpose, "attachment")));
    if (Number(storage.bytes) + bytes.length > quotaBytes) return { ok: false as const, reason: "quota" as const, quotaBytes };
    await tx.insert(mediaAssets).values({ id, bytes, contentType, ownerId: userId, purpose: "attachment" });
    return { ok: true as const, quotaBytes };
  });
}
