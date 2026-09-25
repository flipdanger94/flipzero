import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getStoreSnapshot } from "@/lib/store";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ code: "UNAUTHENTICATED", message: "Требуется вход." }, { status: 401 });
  const url = new URL(request.url);
  const offset = Number(url.searchParams.get("offset") ?? "0");
  const limit = Number(url.searchParams.get("limit") ?? "24");
  const data = await getStoreSnapshot(user.id, {
    q: url.searchParams.get("q"),
    category: url.searchParams.get("category"),
    slot: url.searchParams.get("slot"),
    rarity: url.searchParams.get("rarity"),
    sort: url.searchParams.get("sort"),
    offset: Number.isFinite(offset) ? offset : 0,
    limit: Number.isFinite(limit) ? limit : 24,
  });
  return NextResponse.json(data);
}
