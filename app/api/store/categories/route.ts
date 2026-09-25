import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getStoreCategories } from "@/lib/store";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ code: "UNAUTHENTICATED", message: "Требуется вход." }, { status: 401 });
  return NextResponse.json(await getStoreCategories(user.id));
}
