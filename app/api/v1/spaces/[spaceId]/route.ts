import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDatabase } from "@/db/client";
import { spaces } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { updateSpaceSchema } from "@/lib/space-validation";

export async function PATCH(request: Request, { params }: { params: Promise<{ spaceId: string }> }) {
  const [user, { spaceId }] = await Promise.all([getCurrentUser(), params]);
  if (!user) return NextResponse.json({ code: "UNAUTHENTICATED", message: "Требуется вход." }, { status: 401 });
  const parsed = updateSpaceSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ code: "INVALID_INPUT", message: "Проверьте настройки пространства.", issues: parsed.error.flatten() }, { status: 400 });

  const database = getDatabase();
  const [space] = await database.select({ ownerId: spaces.ownerId }).from(spaces).where(eq(spaces.id, spaceId)).limit(1);
  if (!space) return NextResponse.json({ code: "NOT_FOUND", message: "Пространство не найдено." }, { status: 404 });
  if (space.ownerId !== user.id) return NextResponse.json({ code: "FORBIDDEN", message: "Изменять пространство может только владелец." }, { status: 403 });

  const [updated] = await database.update(spaces).set({
    name: parsed.data.name,
    description: parsed.data.description || null,
    visibility: parsed.data.visibility,
    accentColor: parsed.data.accentColor,
    updatedAt: new Date(),
  }).where(eq(spaces.id, spaceId)).returning({ id: spaces.id, name: spaces.name, description: spaces.description, visibility: spaces.visibility, accentColor: spaces.accentColor });
  return NextResponse.json({ space: updated });
}
