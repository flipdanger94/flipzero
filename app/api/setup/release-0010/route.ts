import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { and, eq, gt } from "drizzle-orm";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getDatabase } from "@/db/client";
import { sessions, users } from "@/db/schema";
import { SESSION_COOKIE } from "@/lib/auth";

export async function POST() {
  const expectedEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  if (!expectedEmail) return NextResponse.json({ message: "ADMIN_EMAIL не настроен." }, { status: 503 });
  if (!process.env.DATABASE_URL) return NextResponse.json({ message: "DATABASE_URL не настроен." }, { status: 503 });
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return NextResponse.json({ message: "Сначала войдите в аккаунт администратора." }, { status: 401 });
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const database = getDatabase();
  const [account] = await database.select({ id: users.id, email: users.email }).from(sessions).innerJoin(users, eq(sessions.userId, users.id)).where(and(eq(sessions.tokenHash, tokenHash), gt(sessions.expiresAt, new Date()))).limit(1);
  if (!account || account.email.toLowerCase() !== expectedEmail) return NextResponse.json({ message: "Этот аккаунт не может выполнить установку." }, { status: 403 });

  const migrationUrl = new URL("../../../../drizzle/0010_superflip_social_admin.sql", import.meta.url);
  const migration = await readFile(fileURLToPath(migrationUrl), "utf8");
  const { default: postgres } = await import("postgres");
  const client = postgres(process.env.DATABASE_URL!, { max: 1, prepare: false });
  try {
    await client.unsafe(migration);
    await client`UPDATE users SET platform_role = 'admin', updated_at = now() WHERE id = ${account.id}`;
  } finally {
    await client.end();
  }
  return NextResponse.json({ ok: true, message: "Миграция применена, роль администратора назначена." });
}
