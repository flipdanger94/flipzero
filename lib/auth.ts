import "server-only";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { cookies, headers } from "next/headers";
import { and, eq, gt } from "drizzle-orm";
import { getDatabase } from "@/db/client";
import { sessions, users } from "@/db/schema";

export const SESSION_COOKIE = "flipzero_session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 30;
const hashValue = (value: string) => createHash("sha256").update(value).digest("hex");

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const requestHeaders = await headers();
  await getDatabase().insert(sessions).values({ id: randomUUID(), userId, tokenHash: hashValue(token), userAgent: requestHeaders.get("user-agent")?.slice(0, 500), ipHash: requestHeaders.get("x-forwarded-for") ? hashValue(requestHeaders.get("x-forwarded-for")!.split(",")[0].trim()) : null, expiresAt: new Date(Date.now() + SESSION_MAX_AGE * 1000) });
  (await cookies()).set(SESSION_COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: SESSION_MAX_AGE });
}

export async function deleteSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) await getDatabase().delete(sessions).where(eq(sessions.tokenHash, hashValue(token)));
  cookieStore.delete(SESSION_COOKIE);
}

export async function getCurrentUser() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const [result] = await getDatabase().select({ id: users.id, email: users.email, username: users.username, displayName: users.displayName, avatarUrl: users.avatarUrl, globalLevel: users.globalLevel, globalXp: users.globalXp }).from(sessions).innerJoin(users, eq(sessions.userId, users.id)).where(and(eq(sessions.tokenHash, hashValue(token)), gt(sessions.expiresAt, new Date()))).limit(1);
  return result ?? null;
}
