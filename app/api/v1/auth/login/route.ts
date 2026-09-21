import { compare } from "bcryptjs";
import { randomUUID } from "node:crypto";
import { and, count, eq, gte } from "drizzle-orm";
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getDatabase } from "@/db/client";
import { loginHistory, users } from "@/db/schema";
import { createSession } from "@/lib/auth";
import { loginSchema } from "@/lib/auth-validation";
import { decryptTotpSecret, hashBackupCode, verifyTotp } from "@/lib/totp";
import { isTrustedMutationRequest, requestFingerprint } from "@/lib/security-controls";

const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_ATTEMPT_LIMIT = 8;
const DUMMY_PASSWORD_HASH = "$2b$12$KIXQq8WvJHQ1E5jPvT3aK.BuJIkKGEVbTQAtpQkHhB5IKUD2cG5oW";

export async function POST(request: Request) {
  if (!isTrustedMutationRequest(request)) return NextResponse.json({ code: "UNTRUSTED_ORIGIN", message: "Запрос отклонён. Обновите страницу и попробуйте снова." }, { status: 403 });
  const parsed = loginSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ code: "INVALID_INPUT", message: "Проверьте email и пароль." }, { status: 400 });
  const database = getDatabase(); const requestHeaders = await headers(); const userAgent = requestHeaders.get("user-agent")?.slice(0, 500) ?? null; const ipHash = requestFingerprint(request);
  const [user] = await database.select().from(users).where(eq(users.email, parsed.data.email)).limit(1);
  if (user) {
    const [attempts] = await database.select({ value: count() }).from(loginHistory).where(and(eq(loginHistory.userId, user.id), eq(loginHistory.successful, false), gte(loginHistory.createdAt, new Date(Date.now() - LOGIN_WINDOW_MS))));
    if (Number(attempts?.value ?? 0) >= LOGIN_ATTEMPT_LIMIT) return NextResponse.json({ code: "TOO_MANY_ATTEMPTS", message: "Слишком много попыток. Повторите вход через 15 минут." }, { status: 429, headers: { "Retry-After": "900" } });
  }
  const passwordMatches = await compare(parsed.data.password, user?.passwordHash || DUMMY_PASSWORD_HASH);
  if (!user?.passwordHash || !passwordMatches) { if (user) await database.insert(loginHistory).values({ id: randomUUID(), userId: user.id, userAgent, ipHash, successful: false }); return NextResponse.json({ code: "INVALID_CREDENTIALS", message: "Неверный email или пароль." }, { status: 401 }); }
  if (user.bannedAt) return NextResponse.json({ code: "ACCOUNT_BANNED", message: "Аккаунт заблокирован администратором." }, { status: 403 });
  if (user.totpEnabled) {
    if (!parsed.data.otp) return NextResponse.json({ code: "TWO_FACTOR_REQUIRED", message: "Введите код двухфакторной аутентификации." }, { status: 428 });
    const backupHash = hashBackupCode(parsed.data.otp); const backupIndex = user.backupCodeHashes.indexOf(backupHash); const validTotp = Boolean(user.totpSecretEncrypted && verifyTotp(decryptTotpSecret(user.totpSecretEncrypted), parsed.data.otp));
    if (!validTotp && backupIndex < 0) { await database.insert(loginHistory).values({ id: randomUUID(), userId: user.id, userAgent, ipHash, successful: false }); return NextResponse.json({ code: "INVALID_OTP", message: "Неверный одноразовый или резервный код." }, { status: 401 }); }
    if (backupIndex >= 0) await database.update(users).set({ backupCodeHashes: user.backupCodeHashes.filter((_, index) => index !== backupIndex) }).where(eq(users.id, user.id));
  }
  await createSession(user.id);
  await database.insert(loginHistory).values({ id: randomUUID(), userId: user.id, userAgent, ipHash, successful: true });
  return NextResponse.json({ user: { id: user.id, email: user.email, username: user.username, displayName: user.displayName } });
}
