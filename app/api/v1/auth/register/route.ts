import { randomUUID } from "node:crypto";
import { hash } from "bcryptjs";
import { eq, or } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDatabase } from "@/db/client";
import { users } from "@/db/schema";
import { createSession } from "@/lib/auth";
import { registerSchema } from "@/lib/auth-validation";
import { isTrustedMutationRequest } from "@/lib/security-controls";
import { consumeAuthAttempt } from "@/lib/auth-rate-limit";

export async function POST(request: Request) {
  if (process.env.CODESPACES !== "true" && process.env.NODE_ENV === "production" && !isTrustedMutationRequest(request)) return NextResponse.json({ code: "UNTRUSTED_ORIGIN", message: "Запрос отклонён. Обновите страницу и попробуйте снова." }, { status: 403 });
  const parsed = registerSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ code: "INVALID_INPUT", message: "Проверьте данные регистрации.", issues: parsed.error.flatten() }, { status: 400 });
  if (!await consumeAuthAttempt(request, "register")) return NextResponse.json({ code: "TOO_MANY_ATTEMPTS", message: "Слишком много попыток регистрации. Повторите через 15 минут." }, { status: 429, headers: { "Retry-After": "900", "Cache-Control": "no-store" } });
  const existing = await getDatabase().select({ id: users.id }).from(users).where(or(eq(users.email, parsed.data.email), eq(users.username, parsed.data.username))).limit(1);
  if (existing.length) return NextResponse.json({ code: "ACCOUNT_EXISTS", message: "Email или имя пользователя уже заняты." }, { status: 409 });
  const userId = randomUUID();
  const { password } = parsed.data;
  const profile = { email: parsed.data.email, username: parsed.data.username, displayName: parsed.data.displayName };
  await getDatabase().insert(users).values({ ...profile, id: userId, passwordHash: await hash(password, 12) });
  await createSession(userId);
  return NextResponse.json({ user: { id: userId, ...profile } }, { status: 201 });
}
