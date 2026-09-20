import { compare } from "bcryptjs";
import { createHash, randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getDatabase } from "@/db/client";
import { loginHistory, users } from "@/db/schema";
import { createSession } from "@/lib/auth";
import { loginSchema } from "@/lib/auth-validation";
import { decryptTotpSecret, hashBackupCode, verifyTotp } from "@/lib/totp";

export async function POST(request: Request) {
  const parsed = loginSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ code: "INVALID_INPUT", message: "Проверьте email и пароль." }, { status: 400 });
  const database = getDatabase(); const requestHeaders = await headers(); const userAgent = requestHeaders.get("user-agent")?.slice(0, 500) ?? null; const forwarded = requestHeaders.get("x-forwarded-for")?.split(",")[0].trim(); const ipHash = forwarded ? createHash("sha256").update(forwarded).digest("hex") : null;
  const [user] = await database.select().from(users).where(eq(users.email, parsed.data.email)).limit(1);
  if (!user?.passwordHash || !(await compare(parsed.data.password, user.passwordHash))) { if (user) await database.insert(loginHistory).values({ id: randomUUID(), userId: user.id, userAgent, ipHash, successful: false }); return NextResponse.json({ code: "INVALID_CREDENTIALS", message: "Неверный email или пароль." }, { status: 401 }); }
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
