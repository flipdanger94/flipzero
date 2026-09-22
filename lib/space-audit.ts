import "server-only";
import { randomUUID } from "node:crypto";
import { getDatabase } from "@/db/client";
import { spaceAuditLogs } from "@/db/schema";

export async function writeSpaceAuditLog(input: {
  spaceId: string;
  actorId?: string | null;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const db = getDatabase();
  try {
    await db.insert(spaceAuditLogs).values({
      id: randomUUID(),
      spaceId: input.spaceId,
      actorId: input.actorId ?? null,
      action: input.action,
      targetType: input.targetType ?? null,
      targetId: input.targetId ?? null,
      metadata: input.metadata ?? {},
    });
  } catch {
    // Audit must never turn an already-successful primary server action into a 500
    // while a release migration is pending or the audit store is temporarily unavailable.
  }
}
