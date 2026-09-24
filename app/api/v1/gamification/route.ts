import { and, desc, eq, or, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDatabase } from "@/db/client";
import { achievementDefinitions, members, pathProgress, profileCosmetics, userAchievements, userProgress, users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { getSuperFlipCapabilities } from "@/lib/superflip";
import { levelProgress, PATH_META, PATHS } from "@/lib/gamification";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ code: "UNAUTHENTICATED", message: "Требуется вход." }, { status: 401 });
  const spaceId = new URL(request.url).searchParams.get("spaceId");
  if (!spaceId) return NextResponse.json({ code: "INVALID_INPUT", message: "Не указано пространство." }, { status: 400 });
  const database = getDatabase();
  await database.insert(userProgress).values({userId:user.id,totalXp:0,level:1}).onConflictDoNothing({target:userProgress.userId});
  const [[member], paths, definitions, progressRows, [cosmetics], [globalProgress], leaderboard] = await Promise.all([
    database.select({ xp: members.xp, level: members.level, joinedAt: members.joinedAt }).from(members).where(and(eq(members.userId, user.id), eq(members.spaceId, spaceId))).limit(1),
    database.select().from(pathProgress).where(and(eq(pathProgress.userId, user.id), eq(pathProgress.scopeId, spaceId))),
    database.select().from(achievementDefinitions).where(or(sql`${achievementDefinitions.spaceId} IS NULL`, eq(achievementDefinitions.spaceId, spaceId))),
    database.select().from(userAchievements).where(eq(userAchievements.userId, user.id)),
    database.select().from(profileCosmetics).where(eq(profileCosmetics.userId, user.id)).limit(1),
    database.select({totalXp:userProgress.totalXp,level:userProgress.level,xpUpdatedAt:userProgress.xpUpdatedAt}).from(userProgress).where(eq(userProgress.userId,user.id)).limit(1),
    database.select({ userId: members.userId, xp: members.xp, level: members.level, displayName: users.displayName, username: users.username, avatarUrl: users.avatarUrl }).from(members).innerJoin(users, eq(users.id, members.userId)).where(eq(members.spaceId, spaceId)).orderBy(desc(members.xp)).limit(25),
  ]);
  if (!member) return NextResponse.json({ code: "FORBIDDEN", message: "Вы не состоите в этом пространстве." }, { status: 403 });

  const achievements = definitions.map((definition) => {
    const progress = progressRows.find((row) => row.achievementId === definition.id);
    return { ...definition, progress: progress?.progress ?? 0, unlockedAt: progress?.unlockedAt ?? null, isShowcased: progress?.isShowcased ?? false };
  });
  return NextResponse.json({
    profile: { ...user, globalXp:globalProgress?.totalXp??0, globalLevel:globalProgress?.level??1, global: levelProgress(globalProgress?.totalXp??0), local: levelProgress(member.xp), joinedAt: member.joinedAt, cosmetics: cosmetics ?? { title: "Путешественник", avatarFrame: "coral", profileEffect: "glow", showcasedPath: "social" } },
    paths: PATHS.map((path) => { const row = paths.find((item) => item.path === path); return { path, ...PATH_META[path], xp: row?.xp ?? 0, ...levelProgress(row?.xp ?? 0) }; }),
    achievements,
    leaderboard: leaderboard.map((entry, index) => ({ ...entry, rank: index + 1, isCurrentUser: entry.userId === user.id })),
  });
}

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ code: "UNAUTHENTICATED", message: "Требуется вход." }, { status: 401 });
  const body = await request.json().catch(() => null);
  const database = getDatabase();
  if (body?.achievementId) {
    const achievementId = String(body.achievementId);
    const [current] = await database.select().from(userAchievements).where(and(eq(userAchievements.userId, user.id), eq(userAchievements.achievementId, achievementId), sql`${userAchievements.unlockedAt} IS NOT NULL`)).limit(1);
    if (!current) return NextResponse.json({ code: "LOCKED", message: "Сначала разблокируйте достижение." }, { status: 409 });
    if (!current.isShowcased) {
      const [{ count }] = await database.select({ count: sql<number>`count(*)::int` }).from(userAchievements).where(and(eq(userAchievements.userId, user.id), eq(userAchievements.isShowcased, true)));
      const limit=(await getSuperFlipCapabilities(user.id)).active?5:3;
      if (count >= limit) return NextResponse.json({ code: "SHOWCASE_FULL", message: `На витрине можно закрепить до ${limit} достижений.` }, { status: 409 });
    }
    await database.update(userAchievements).set({ isShowcased: !current.isShowcased, updatedAt: new Date() }).where(and(eq(userAchievements.userId, user.id), eq(userAchievements.achievementId, achievementId)));
    return NextResponse.json({ isShowcased: !current.isShowcased });
  }
  const titles = ["Путешественник", "Голос сообщества", "Создатель атмосферы", "Легенда FlipZero"];
  const frames = ["coral", "violet", "lime", "sky"];
  const effects = ["glow", "waves", "none"];
  const title = titles.includes(body?.title) ? body.title : "Путешественник";
  const avatarFrame = frames.includes(body?.avatarFrame) ? body.avatarFrame : "coral";
  const profileEffect = effects.includes(body?.profileEffect) ? body.profileEffect : "glow";
  const showcasedPath = PATHS.includes(body?.showcasedPath) ? body.showcasedPath : "social";
  await database.insert(profileCosmetics).values({ userId: user.id, title, avatarFrame, profileEffect, showcasedPath }).onConflictDoUpdate({ target: profileCosmetics.userId, set: { title, avatarFrame, profileEffect, showcasedPath, updatedAt: new Date() } });
  return NextResponse.json({ cosmetics: { title, avatarFrame, profileEffect, showcasedPath } });
}
