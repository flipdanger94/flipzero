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
  if (!expectedEmail || !process.env.DATABASE_URL) return NextResponse.json({ message: "Переменные окружения не настроены." }, { status: 503 });
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return NextResponse.json({ message: "Сначала войдите в аккаунт администратора." }, { status: 401 });

  const database = getDatabase();
  const [account] = await database.select({ email: users.email }).from(sessions).innerJoin(users, eq(sessions.userId, users.id)).where(and(
    eq(sessions.tokenHash, createHash("sha256").update(token).digest("hex")),
    gt(sessions.expiresAt, new Date()),
  )).limit(1);
  if (!account || account.email.toLowerCase() !== expectedEmail) return NextResponse.json({ message: "Этот аккаунт не может выполнить установку." }, { status: 403 });

  const migrationFiles = [
    "0014_space_join_requests.sql",
    "0015_space_audit_logs.sql",
    "0016_space_notification_settings.sql",
  ];
  const migrations = await Promise.all(migrationFiles.map((name) => readFile(fileURLToPath(new URL(`../../../../drizzle/${name}`, import.meta.url)), "utf8")));
  const { default: postgres } = await import("postgres");
  const client = postgres(process.env.DATABASE_URL, { max: 1, prepare: false });
  try {
    await client.begin(async (tx) => {
      for (const migration of migrations) await tx.unsafe(migration);
    });
  } finally {
    await client.end();
  }

  return NextResponse.json({ ok: true, message: "Пакет миграций 0014–0016 применён." });
}
