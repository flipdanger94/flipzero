import { and, eq, ne } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDatabase } from "@/db/client";
import { users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { updateAccountSchema } from "@/lib/account-validation";

export async function PATCH(request: Request) {
  const current = await getCurrentUser();
  if (!current) return NextResponse.json({ code: "UNAUTHENTICATED", message: "Требуется вход." }, { status: 401 });
  const parsed = updateAccountSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ code: "INVALID_INPUT", message: "Проверьте имя, никнейм и описание." }, { status: 400 });

  const database = getDatabase();
  const [taken] = await database.select({ id: users.id }).from(users).where(and(eq(users.username, parsed.data.username), ne(users.id, current.id))).limit(1);
  if (taken) return NextResponse.json({ code: "USERNAME_TAKEN", message: "Этот никнейм уже занят." }, { status: 409 });

  try {
    const [updated] = await database.update(users).set({
      displayName: parsed.data.displayName,
      username: parsed.data.username,
      bio: parsed.data.bio || null,
      updatedAt: new Date(),
    }).where(eq(users.id, current.id)).returning({ displayName: users.displayName, username: users.username, bio: users.bio });
    if (!updated) return NextResponse.json({ code: "NOT_FOUND", message: "Аккаунт не найден." }, { status: 404 });
    return NextResponse.json({ user: { ...current, ...updated } });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "23505") return NextResponse.json({ code: "USERNAME_TAKEN", message: "Этот никнейм уже занят." }, { status: 409 });
    throw error;
  }
}
