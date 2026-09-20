import { NextResponse } from "next/server";
import { getDatabase } from "@/db/client";
import { superflipWaitlist } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";

export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ code: "UNAUTHENTICATED", message: "Требуется вход." }, { status: 401 });
  await getDatabase().insert(superflipWaitlist).values({ userId: user.id }).onConflictDoNothing();
  return NextResponse.json({ code: "COMING_SOON", message: "SuperFlip скоро появится. Вы добавлены в лист ожидания.", waitlisted: true }, { status: 202 });
}
