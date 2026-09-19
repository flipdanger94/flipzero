import { compare, hash } from "bcryptjs";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDatabase } from "@/db/client";
import { users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { updatePasswordSchema } from "@/lib/account-validation";

export async function POST(request: Request) {
  const current = await getCurrentUser();
  if (!current) return NextResponse.json({ code: "UNAUTHENTICATED", message: "Требуется вход." }, { status: 401 });
  const parsed = updatePasswordSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ code: "INVALID_INPUT", message: "Проверьте пароли. Новый пароль должен содержать не менее 10 символов." }, { status: 400 });

  const database = getDatabase();
  const [account] = await database.select({ passwordHash: users.passwordHash }).from(users).where(eq(users.id, current.id)).limit(1);
  if (!account?.passwordHash || !(await compare(parsed.data.currentPassword, account.passwordHash))) return NextResponse.json({ code: "INVALID_CREDENTIALS", message: "Текущий пароль указан неверно." }, { status: 401 });
  if (parsed.data.currentPassword === parsed.data.newPassword) return NextResponse.json({ code: "SAME_PASSWORD", message: "Придумайте новый пароль, отличный от текущего." }, { status: 400 });
  await database.update(users).set({ passwordHash: await hash(parsed.data.newPassword, 12), updatedAt: new Date() }).where(eq(users.id, current.id));
  return NextResponse.json({ success: true });
}
