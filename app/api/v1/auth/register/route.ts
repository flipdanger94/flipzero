import { randomUUID } from "node:crypto";
import { hash } from "bcryptjs";
import { eq, or } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDatabase } from "@/db/client";
import { users } from "@/db/schema";
import { createSession } from "@/lib/auth";
import { registerSchema } from "@/lib/auth-validation";

export async function POST(request: Request) {
  const parsed = registerSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ code: "INVALID_INPUT", message: "Проверьте данные регистрации.", issues: parsed.error.flatten() }, { status: 400 });
  const existing = await getDatabase().select({ id: users.id }).from(users).where(or(eq(users.email, parsed.data.email), eq(users.username, parsed.data.username))).limit(1);
  if (existing.length) return NextResponse.json({ code: "ACCOUNT_EXISTS", message: "Email или имя пользователя уже заняты." }, { status: 409 });
  const userId = randomUUID();
  const { password, ...profile } = parsed.data;
  await getDatabase().insert(users).values({ ...profile, id: userId, passwordHash: await hash(password, 12) });
  await createSession(userId);
  return NextResponse.json({ user: { id: userId, ...profile } }, { status: 201 });
}
