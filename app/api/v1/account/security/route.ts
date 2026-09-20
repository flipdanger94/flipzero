import { createHash, randomBytes } from "node:crypto";
import QRCode from "qrcode";
import { and, desc, eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getDatabase } from "@/db/client";
import { loginHistory, sessions, users } from "@/db/schema";
import { getCurrentUser, SESSION_COOKIE } from "@/lib/auth";
import { createTotpSecret, decryptTotpSecret, encryptTotpSecret, hashBackupCode, verifyTotp } from "@/lib/totp";

const hashToken = (value: string) => createHash("sha256").update(value).digest("hex");
export async function GET() {
  const user = await getCurrentUser(); if (!user) return NextResponse.json({ code: "UNAUTHENTICATED", message: "Требуется вход." }, { status: 401 });
  const token = (await cookies()).get(SESSION_COOKIE)?.value; const currentHash = token ? hashToken(token) : ""; const database = getDatabase();
  const [sessionRows, historyRows] = await Promise.all([
    database.select({ id: sessions.id, tokenHash: sessions.tokenHash, userAgent: sessions.userAgent, ipHash: sessions.ipHash, createdAt: sessions.createdAt, expiresAt: sessions.expiresAt }).from(sessions).where(eq(sessions.userId, user.id)).orderBy(desc(sessions.createdAt)),
    database.select({ id: loginHistory.id, userAgent: loginHistory.userAgent, ipHash: loginHistory.ipHash, successful: loginHistory.successful, createdAt: loginHistory.createdAt }).from(loginHistory).where(eq(loginHistory.userId, user.id)).orderBy(desc(loginHistory.createdAt)).limit(20),
  ]);
  return NextResponse.json({ totpEnabled: user.totpEnabled, sessions: sessionRows.map(({ tokenHash, ...row }) => ({ ...row, current: tokenHash === currentHash })), loginHistory: historyRows });
}

export async function POST(request: Request) {
  const user = await getCurrentUser(); if (!user) return NextResponse.json({ code: "UNAUTHENTICATED", message: "Требуется вход." }, { status: 401 });
  const body = await request.json().catch(() => null); const action = body?.action; const database = getDatabase();
  if (action === "begin_2fa") {
    const secret = createTotpSecret(); const uri = `otpauth://totp/FlipZero:${encodeURIComponent(user.email)}?secret=${secret}&issuer=FlipZero&algorithm=SHA1&digits=6&period=30`;
    await database.update(users).set({ totpSecretEncrypted: encryptTotpSecret(secret), totpEnabled: false, backupCodeHashes: [] }).where(eq(users.id, user.id));
    return NextResponse.json({ secret, uri, qrDataUrl: await QRCode.toDataURL(uri, { width: 220, margin: 1, color: { dark: "#11131a", light: "#ffffff" } }) });
  }
  if (action === "confirm_2fa") {
    const [account] = await database.select({ encrypted: users.totpSecretEncrypted }).from(users).where(eq(users.id, user.id)).limit(1); if (!account?.encrypted || typeof body?.code !== "string" || !verifyTotp(decryptTotpSecret(account.encrypted), body.code)) return NextResponse.json({ code: "INVALID_OTP", message: "Неверный код приложения." }, { status: 400 });
    const codes = Array.from({ length: 8 }, () => `${randomBytes(3).toString("hex").toUpperCase()}-${randomBytes(3).toString("hex").toUpperCase()}`); await database.update(users).set({ totpEnabled: true, backupCodeHashes: codes.map(hashBackupCode) }).where(eq(users.id, user.id)); return NextResponse.json({ enabled: true, backupCodes: codes });
  }
  if (action === "disable_2fa") { await database.update(users).set({ totpEnabled: false, totpSecretEncrypted: null, backupCodeHashes: [] }).where(eq(users.id, user.id)); return NextResponse.json({ enabled: false }); }
  if (action === "end_session" && typeof body?.sessionId === "string") { await database.delete(sessions).where(and(eq(sessions.id, body.sessionId), eq(sessions.userId, user.id))); return NextResponse.json({ ok: true }); }
  return NextResponse.json({ code: "INVALID_ACTION", message: "Неизвестное действие." }, { status: 400 });
}
