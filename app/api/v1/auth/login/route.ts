import { compare } from "bcryptjs";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDatabase } from "@/db/client";
import { users } from "@/db/schema";
import { createSession } from "@/lib/auth";
import { loginSchema } from "@/lib/auth-validation";

export async function POST(request: Request) {
  const parsed = loginSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ code: "INVALID_INPUT", message: "Проверьте email и пароль." }, { status: 400 });
  const [user] = await getDatabase().select().from(users).where(eq(users.email, parsed.data.email)).limit(1);
  if (!user?.passwordHash || !(await compare(parsed.data.password, user.passwordHash))) return NextResponse.json({ code: "INVALID_CREDENTIALS", message: "Неверный email или пароль." }, { status: 401 });
  if (user.bannedAt) return NextResponse.json({ code: "ACCOUNT_BANNED", message: "Аккаунт заблокирован администратором." }, { status: 403 });
  await createSession(user.id);
  return NextResponse.json({ user: { id: user.id, email: user.email, username: user.username, displayName: user.displayName } });
}
