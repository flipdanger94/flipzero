import "server-only";

import { randomUUID } from "node:crypto";
import { and, count, eq, gt, sql } from "drizzle-orm";
import { getDatabase } from "../db/client";
import { passwordResetAttempts } from "../db/schema";
import { requestFingerprint } from "./security-controls";

const WINDOW_MS = 15 * 60_000;
const limits = { login: 20, register: 5 } as const;

/** Shared across Vercel instances; the existing attempts table is indexed by ip_hash. */
export async function consumeAuthAttempt(request: Request, action: keyof typeof limits) {
  const key = `${action}:${requestFingerprint(request)}`;
  return getDatabase().transaction(async (tx) => {
    // Serialize requests for this IP and action, including requests on other instances.
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))`);
    const [attempts] = await tx.select({ value: count() }).from(passwordResetAttempts)
      .where(and(eq(passwordResetAttempts.ipHash, key), gt(passwordResetAttempts.createdAt, new Date(Date.now() - WINDOW_MS))));
    if (Number(attempts?.value ?? 0) >= limits[action]) return false;
    await tx.insert(passwordResetAttempts).values({ id: randomUUID(), ipHash: key, emailHash: key });
    return true;
  });
}
