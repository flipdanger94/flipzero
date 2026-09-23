import { compare, hash } from "bcryptjs";
import { createHash, createHmac, randomBytes, randomUUID } from "node:crypto";
import { and, count, eq, gt, lt } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDatabase } from "@/db/client";
import { passwordResetAttempts, passwordResetTokens, sessions, users } from "@/db/schema";
import { isTrustedMutationRequest, requestFingerprint } from "@/lib/security-controls";

const reply = () => NextResponse.json({ message: "Если аккаунт с такой почтой существует, мы отправили ссылку для восстановления." }, { headers: { "Cache-Control": "no-store" } });
const digest = (value: string) => createHash("sha256").update(value).digest("hex");

export async function POST(request: Request) {
  if (!isTrustedMutationRequest(request)) return NextResponse.json({ message: "Запрос отклонён." }, { status: 403 });
  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return NextResponse.json({ message: "Введите корректный email." }, { status: 400 });
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESET_EMAIL_FROM;
  const base = process.env.PASSWORD_RESET_BASE_URL;
  if (!apiKey || !from || !base) return NextResponse.json({ message: "Отправка писем пока не настроена." }, { status: 503 });
  let baseUrl: URL;
  try { baseUrl = new URL(base); if (baseUrl.protocol !== "https:" && process.env.NODE_ENV === "production") throw new Error(); }
  catch { return NextResponse.json({ message: "Адрес сервиса восстановления настроен неверно." }, { status: 503 }); }

  const database = getDatabase();
  await Promise.all([
    database.delete(passwordResetAttempts).where(lt(passwordResetAttempts.createdAt, new Date(Date.now() - 24 * 60 * 60_000))),
    database.delete(passwordResetTokens).where(lt(passwordResetTokens.expiresAt, new Date())),
  ]);
  const since = new Date(Date.now() - 15 * 60_000);
  const ipHash = requestFingerprint(request);
  const emailHash = createHmac("sha256", process.env.SESSION_SECRET || apiKey).update(email).digest("hex");
  const [[ipAttempts], [emailAttempts]] = await Promise.all([
    database.select({ value: count() }).from(passwordResetAttempts).where(and(eq(passwordResetAttempts.ipHash, ipHash), gt(passwordResetAttempts.createdAt, since))),
    database.select({ value: count() }).from(passwordResetAttempts).where(and(eq(passwordResetAttempts.emailHash, emailHash), gt(passwordResetAttempts.createdAt, since))),
  ]);
  if (Number(ipAttempts?.value ?? 0) >= 5 || Number(emailAttempts?.value ?? 0) >= 2) return reply();
  await database.insert(passwordResetAttempts).values({ id: randomUUID(), ipHash, emailHash });
  const [account] = await database.select({ id: users.id, passwordHash: users.passwordHash }).from(users).where(eq(users.email, email)).limit(1);
  if (!account?.passwordHash) return reply();
  const token = randomBytes(32).toString("base64url");
  const id = randomUUID();
  await database.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, account.id));
  await database.insert(passwordResetTokens).values({ id, userId: account.id, tokenHash: digest(token), expiresAt: new Date(Date.now() + 30 * 60_000) });
  const url = new URL("/reset-password", baseUrl);
  url.searchParams.set("token", token);
  try {
    const response = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ from, to: [email], subject: "Восстановление пароля FlipZero", text: `Вы запросили смену пароля. Откройте ссылку в течение 30 минут:\n${url.toString()}\n\nЕсли это были не вы, просто проигнорируйте письмо.` }), signal: AbortSignal.timeout(10_000) });
    if (!response.ok) throw new Error(`Email service returned ${response.status}`);
  } catch (error) {
    await database.delete(passwordResetTokens).where(eq(passwordResetTokens.id, id));
    console.error("Password reset email delivery failed", error);
  }
  return reply();
}

export async function PATCH(request: Request) {
  if (!isTrustedMutationRequest(request)) return NextResponse.json({ message: "Запрос отклонён." }, { status: 403 });
  const body = await request.json().catch(() => null);
  const token = typeof body?.token === "string" ? body.token : "";
  const password = typeof body?.password === "string" ? body.password : "";
  if (!/^[A-Za-z0-9_-]{43}$/.test(token) || password.length < 10 || password.length > 128) return NextResponse.json({ message: "Проверьте ссылку и новый пароль (не менее 10 символов)." }, { status: 400 });
  const database = getDatabase();
  const tokenHash = digest(token);
  const [entry] = await database.select({ userId: passwordResetTokens.userId, expiresAt: passwordResetTokens.expiresAt }).from(passwordResetTokens).where(eq(passwordResetTokens.tokenHash, tokenHash)).limit(1);
  if (!entry || entry.expiresAt <= new Date()) return NextResponse.json({ message: "Ссылка недействительна или срок её действия истёк." }, { status: 400 });
  const [account] = await database.select({ passwordHash: users.passwordHash }).from(users).where(eq(users.id, entry.userId)).limit(1);
  if (account?.passwordHash && await compare(password, account.passwordHash)) return NextResponse.json({ message: "Новый пароль должен отличаться от текущего." }, { status: 400 });
  const passwordHash = await hash(password, 12);
  const success = await database.transaction(async (tx) => {
    const [consumed] = await tx.delete(passwordResetTokens).where(and(eq(passwordResetTokens.tokenHash, tokenHash), gt(passwordResetTokens.expiresAt, new Date()))).returning({ userId: passwordResetTokens.userId });
    if (!consumed) return false;
    await tx.update(users).set({ passwordHash, updatedAt: new Date() }).where(eq(users.id, consumed.userId));
    await tx.delete(sessions).where(eq(sessions.userId, consumed.userId));
    await tx.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, consumed.userId));
    return true;
  });
  return success ? NextResponse.json({ message: "Пароль обновлён. Войдите снова на всех устройствах." }) : NextResponse.json({ message: "Ссылка уже использована или срок её действия истёк." }, { status: 400 });
}
