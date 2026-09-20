import { and, ilike, ne } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDatabase } from "@/db/client";
import { users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";

export async function GET(request: Request) {
  const user = await getCurrentUser(); if (!user) return NextResponse.json({ message: "Требуется вход." }, { status: 401 });
  const query = new URL(request.url).searchParams.get("q")?.trim().slice(0, 80) ?? "";
  if (query.length < 2) return NextResponse.json({ users: [] });
  const rows = await getDatabase().select({ id: users.id, username: users.username, displayName: users.displayName, avatarUrl: users.avatarUrl }).from(users).where(and(ne(users.id, user.id), ilike(users.username, `%${query}%`))).limit(20);
  return NextResponse.json({ users: rows });
}
