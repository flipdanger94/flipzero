import { randomUUID } from "node:crypto";
import { and, eq, ilike, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDatabase } from "@/db/client";
import { members, roles, memberRoles, spaces, users, xpEvents } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { levelFromXp } from "@/lib/gamification";

export async function POST(request: Request) {
  const user = await getCurrentUser(); if (!user) return NextResponse.json({ code: "UNAUTHENTICATED", message: "Требуется вход." }, { status: 401 });
  const body = await request.json().catch(() => null); const step = Number(body?.step); if (!Number.isInteger(step) || step < 1 || step > 4) return NextResponse.json({ code: "INVALID_STEP", message: "Неизвестный шаг." }, { status: 400 });
  const database = getDatabase();
  if (step === 2 && typeof body?.bio === "string") await database.update(users).set({ bio: body.bio.trim().slice(0, 190) || null }).where(eq(users.id, user.id));
  if (step === 3 && body?.joinDemo) {
    const [demo] = await database.select({ id: spaces.id }).from(spaces).where(ilike(spaces.name, "FlipZero HQ")).limit(1);
    if (demo) await database.transaction(async (tx) => { const inserted = await tx.insert(members).values({ userId: user.id, spaceId: demo.id }).onConflictDoNothing().returning({ userId: members.userId }); if (inserted.length) { const [role] = await tx.select({ id: roles.id }).from(roles).where(and(eq(roles.spaceId, demo.id), eq(roles.name, "Участник"))).limit(1); if (role) await tx.insert(memberRoles).values({ userId: user.id, spaceId: demo.id, roleId: role.id }).onConflictDoNothing(); } });
  }
  const idempotencyKey = `onboarding:${user.id}:${step}`; const award = await database.insert(xpEvents).values({ id: randomUUID(), userId: user.id, source: "onboarding", amount: 50, idempotencyKey }).onConflictDoNothing().returning({ id: xpEvents.id });
  if (award.length) { await database.update(users).set({ globalXp: sql`${users.globalXp} + 50` }).where(eq(users.id, user.id)); const [row] = await database.select({ xp: users.globalXp }).from(users).where(eq(users.id, user.id)).limit(1); await database.update(users).set({ globalLevel: levelFromXp(row.xp) }).where(eq(users.id, user.id)); }
  const completed = step === 4; await database.update(users).set({ onboardingStep: step, onboardingCompleted: completed, updatedAt: new Date() }).where(eq(users.id, user.id));
  return NextResponse.json({ step, completed, awarded: award.length ? 50 : 0 });
}
