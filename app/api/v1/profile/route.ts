import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { NextResponse } from "next/server";
import { getDatabase } from "@/db/client";
import { users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";

const schema = z.object({
  displayName: z.string().trim().min(2).max(40),
  bio: z.string().trim().max(500),
  avatarUrl: z.string().trim().max(2000000).nullable().optional(),
  bannerUrl: z.string().trim().max(2000000).nullable().optional(),
  profileLocation: z.string().trim().max(80),
  profileStatus: z.string().trim().max(120),
  profileLinks: z.array(z.string().url().max(300)).max(5),
  accentColor: z.string().regex(/^#[0-9a-f]{6}$/i),
});

export async function PATCH(request: Request) {
  const current = await getCurrentUser();
  if (!current) return NextResponse.json({ code: "UNAUTHENTICATED", message: "Требуется вход." }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ code: "INVALID_INPUT", message: "Проверьте данные профиля." }, { status: 400 });
  const db = getDatabase();
  await db.execute(sql`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "profile_location" text; ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "profile_status" text; ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "profile_links" jsonb DEFAULT '[]'::jsonb NOT NULL;`);
  const [profile] = await db.update(users).set({
    ...parsed.data,
    avatarUrl: parsed.data.avatarUrl || null, bannerUrl: parsed.data.bannerUrl || null,
    bio: parsed.data.bio || null, profileLocation: parsed.data.profileLocation || null,
    profileStatus: parsed.data.profileStatus || null, updatedAt: new Date(),
  }).where(eq(users.id, current.id)).returning();
  return NextResponse.json({ profile });
}
