import { randomUUID } from "node:crypto";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDatabase } from "@/db/client";
import { achievementDefinitions, clanMembers, clans, members, pathProgress, userAchievements, users, xpEvents } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { levelFromXp, pathForSource, SOURCE_XP } from "@/lib/gamification";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ code: "UNAUTHENTICATED", message: "Требуется вход." }, { status: 401 });
  const body = await request.json().catch(() => null);
  const source = typeof body?.source === "string" ? body.source : "";
  const spaceId = typeof body?.spaceId === "string" ? body.spaceId : null;
  const idempotencyKey = typeof body?.idempotencyKey === "string" ? body.idempotencyKey.slice(0, 120) : randomUUID();
  const amount = SOURCE_XP[source];
  if (!amount || !spaceId) return NextResponse.json({ code: "INVALID_INPUT", message: "Неизвестное действие." }, { status: 400 });

  const database = getDatabase();
  const [membership] = await database.select({ userId: members.userId }).from(members).where(and(eq(members.userId, user.id), eq(members.spaceId, spaceId))).limit(1);
  if (!membership) return NextResponse.json({ code: "FORBIDDEN", message: "Вы не состоите в этом пространстве." }, { status: 403 });

  if (source === "message") {
    const [recent] = await database.select({ id: xpEvents.id }).from(xpEvents).where(and(eq(xpEvents.userId, user.id), eq(xpEvents.spaceId, spaceId), eq(xpEvents.source, source), gte(xpEvents.createdAt, new Date(Date.now() - 30_000)))).orderBy(desc(xpEvents.createdAt)).limit(1);
    if (recent) return NextResponse.json({ awarded: 0, cooldown: true, profile: { globalXp: user.globalXp, globalLevel: user.globalLevel } });
  }

  const path = pathForSource(source);
  const unlocked: string[] = [];
  const result = await database.transaction(async (tx) => {
    const inserted = await tx.insert(xpEvents).values({ id: randomUUID(), userId: user.id, spaceId, source, amount, idempotencyKey }).onConflictDoNothing().returning({ id: xpEvents.id });
    if (!inserted.length) return null;

    await tx.update(users).set({ globalXp: sql`${users.globalXp} + ${amount}`, updatedAt: new Date() }).where(eq(users.id, user.id));
    await tx.update(members).set({ xp: sql`${members.xp} + ${amount}` }).where(and(eq(members.userId, user.id), eq(members.spaceId, spaceId)));
    const [clanContribution] = await tx.update(clanMembers).set({contributionXp:sql`${clanMembers.contributionXp} + ${amount}`}).where(eq(clanMembers.userId,user.id)).returning({clanId:clanMembers.clanId});
    if(clanContribution) await tx.update(clans).set({xp:sql`${clans.xp} + ${amount}`}).where(eq(clans.id,clanContribution.clanId));
    for (const scopeId of ["global", spaceId]) {
      await tx.insert(pathProgress).values({ userId: user.id, scopeId, path, xp: amount, level: 1 }).onConflictDoUpdate({ target: [pathProgress.userId, pathProgress.scopeId, pathProgress.path], set: { xp: sql`${pathProgress.xp} + ${amount}`, updatedAt: new Date() } });
    }

    const [[global], [local], [pathRow]] = await Promise.all([
      tx.select({ xp: users.globalXp, oldLevel: users.globalLevel }).from(users).where(eq(users.id, user.id)).limit(1),
      tx.select({ xp: members.xp, oldLevel: members.level }).from(members).where(and(eq(members.userId, user.id), eq(members.spaceId, spaceId))).limit(1),
      tx.select({ xp: pathProgress.xp }).from(pathProgress).where(and(eq(pathProgress.userId, user.id), eq(pathProgress.scopeId, spaceId), eq(pathProgress.path, path))).limit(1),
    ]);
    const globalLevel = levelFromXp(global.xp);
    const localLevel = levelFromXp(local.xp);
    const pathLevel = levelFromXp(pathRow.xp);
    await Promise.all([
      tx.update(users).set({ globalLevel }).where(eq(users.id, user.id)),
      tx.update(members).set({ level: localLevel }).where(and(eq(members.userId, user.id), eq(members.spaceId, spaceId))),
      tx.update(pathProgress).set({ level: pathLevel }).where(and(eq(pathProgress.userId, user.id), eq(pathProgress.scopeId, spaceId), eq(pathProgress.path, path))),
    ]);

    const [{ count }] = await tx.select({ count: sql<number>`count(*)::int` }).from(xpEvents).where(and(eq(xpEvents.userId, user.id), eq(xpEvents.source, source)));
    const definitions = await tx.select().from(achievementDefinitions).where(sql`${achievementDefinitions.spaceId} IS NULL OR ${achievementDefinitions.spaceId} = ${spaceId}`);
    for (const definition of definitions.filter((item) => item.eventSource === source || item.eventSource === "level")) {
      const progress = definition.eventSource === "level" ? globalLevel : count;
      const justUnlocked = progress >= definition.target;
      const rows = await tx.insert(userAchievements).values({ userId: user.id, achievementId: definition.id, progress: Math.min(progress, definition.target), unlockedAt: justUnlocked ? new Date() : null }).onConflictDoUpdate({ target: [userAchievements.userId, userAchievements.achievementId], set: { progress: Math.min(progress, definition.target), unlockedAt: justUnlocked ? sql`coalesce(${userAchievements.unlockedAt}, now())` : userAchievements.unlockedAt, updatedAt: new Date() } }).returning({ unlockedAt: userAchievements.unlockedAt });
      if (justUnlocked && rows[0]?.unlockedAt) unlocked.push(definition.name);
    }
    return { globalXp: global.xp, globalLevel, localXp: local.xp, localLevel, levelUp: globalLevel > global.oldLevel || localLevel > local.oldLevel };
  });

  if (!result) return NextResponse.json({ awarded: 0, duplicate: true });
  return NextResponse.json({ awarded: amount, path, unlocked: [...new Set(unlocked)], profile: result });
}
