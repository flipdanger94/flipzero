import { and, desc, eq, gte, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDatabase } from "@/db/client";
import { achievementDefinitions, members, messages, pathProgress, userAchievements, xpEvents } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { creditCoins } from "@/lib/economy";
import { awardClanContribution } from "@/lib/clan-season";
import { ECONOMY } from "@/lib/economy-config";
import { getSuperFlipCapabilities } from "@/lib/superflip";
import { levelFromXp, pathForSource, SOURCE_XP } from "@/lib/gamification";
import { awardXp } from "@/lib/xp";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ code: "UNAUTHENTICATED", message: "Требуется вход." }, { status: 401 });
  const body = await request.json().catch(() => null);
  const source = typeof body?.source === "string" ? body.source : "";
  const spaceId = typeof body?.spaceId === "string" ? body.spaceId : null;
  const idempotencyKey = typeof body?.idempotencyKey === "string" ? body.idempotencyKey.slice(0, 120) : "";
  const amount = SOURCE_XP[source];
  if (source!=="message" || !amount || !spaceId || !/^message:[0-9a-f-]{36}$/i.test(idempotencyKey)) return NextResponse.json({ code: "INVALID_INPUT", message: "Неизвестное действие." }, { status: 400 });

  const database = getDatabase();
  const [membership] = await database.select({ userId: members.userId }).from(members).where(and(eq(members.userId, user.id), eq(members.spaceId, spaceId))).limit(1);
  if (!membership) return NextResponse.json({ code: "FORBIDDEN", message: "Вы не состоите в этом пространстве." }, { status: 403 });
  const [proof]=await database.select({id:messages.id}).from(messages).where(and(eq(messages.id,idempotencyKey.slice(8)),eq(messages.authorId,user.id),sql`${messages.deletedAt} IS NULL`,sql`${messages.channelId} IN (SELECT id FROM channels WHERE space_id=${spaceId})`)).limit(1);
  if(!proof)return NextResponse.json({code:"INVALID_PROOF",message:"Сообщение не найдено."},{status:403});
  const superflip=await getSuperFlipCapabilities(user.id);

  const path = pathForSource(source);
  const unlocked: string[] = [];
  const result = await database.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${user.id}))`);
    const [recent]=await tx.select({id:xpEvents.id}).from(xpEvents).where(and(eq(xpEvents.userId,user.id),eq(xpEvents.spaceId,spaceId),eq(xpEvents.source,source),gte(xpEvents.createdAt,new Date(Date.now()-30_000)))).orderBy(desc(xpEvents.createdAt)).limit(1);
    if(recent)return "cooldown" as const;
    const personal = await awardXp({
      userId: user.id,
      source,
      amount,
      dedupeKey: idempotencyKey,
      spaceId,
      meta: { messageId: proof.id },
    }, tx);
    if (!personal.awarded) return null;
    const dayStart=new Date();dayStart.setUTCHours(0,0,0,0);
    const [{earned}]=await tx.select({earned:sql<number>`coalesce(sum(amount),0)::int`}).from(xpEvents).where(and(eq(xpEvents.userId,user.id),eq(xpEvents.source,"message"),gte(xpEvents.createdAt,dayStart)));
    if(earned<=ECONOMY.dailyRewardCap){
      const coinAmount=Math.round(5*(superflip.active?ECONOMY.superFlipRewardMultiplier:1));
      await creditCoins(tx,user.id,coinAmount,"Активность в канале",`activity:${proof.id}`);
    }

    await tx.update(members).set({ xp: sql`${members.xp} + ${amount}` }).where(and(eq(members.userId, user.id), eq(members.spaceId, spaceId)));
    await awardClanContribution(tx,user.id,amount);
    for (const scopeId of ["global", spaceId]) {
      await tx.insert(pathProgress).values({ userId: user.id, scopeId, path, xp: amount, level: 1 }).onConflictDoUpdate({ target: [pathProgress.userId, pathProgress.scopeId, pathProgress.path], set: { xp: sql`${pathProgress.xp} + ${amount}`, updatedAt: new Date() } });
    }

    const [[local], [pathRow]] = await Promise.all([
      tx.select({ xp: members.xp, oldLevel: members.level }).from(members).where(and(eq(members.userId, user.id), eq(members.spaceId, spaceId))).limit(1),
      tx.select({ xp: pathProgress.xp }).from(pathProgress).where(and(eq(pathProgress.userId, user.id), eq(pathProgress.scopeId, spaceId), eq(pathProgress.path, path))).limit(1),
    ]);
    const globalLevel = personal.newLevel;
    const localLevel = levelFromXp(local.xp);
    const pathLevel = levelFromXp(pathRow.xp);
    await Promise.all([
      tx.update(members).set({ level: localLevel }).where(and(eq(members.userId, user.id), eq(members.spaceId, spaceId))),
      tx.update(pathProgress).set({ level: pathLevel }).where(and(eq(pathProgress.userId, user.id), eq(pathProgress.scopeId, spaceId), eq(pathProgress.path, path))),
    ]);

    const [{ count }] = await tx.select({ count: sql<number>`count(*)::int` }).from(xpEvents).where(and(eq(xpEvents.userId, user.id), eq(xpEvents.source, source)));
    const definitions = await tx.select().from(achievementDefinitions).where(sql`${achievementDefinitions.spaceId} IS NULL OR ${achievementDefinitions.spaceId} = ${spaceId}`);
    for (const definition of definitions.filter((item) => item.eventSource === source || item.eventSource === "level")) {
      const progress = definition.eventSource === "level" ? globalLevel : count;
      const justUnlocked = progress >= definition.target;
      const [existing]=await tx.select({unlockedAt:userAchievements.unlockedAt}).from(userAchievements).where(and(eq(userAchievements.userId,user.id),eq(userAchievements.achievementId,definition.id))).limit(1);
      const rows = await tx.insert(userAchievements).values({ userId: user.id, achievementId: definition.id, progress: Math.min(progress, definition.target), unlockedAt: justUnlocked ? new Date() : null }).onConflictDoUpdate({ target: [userAchievements.userId, userAchievements.achievementId], set: { progress: Math.min(progress, definition.target), unlockedAt: justUnlocked ? sql`coalesce(${userAchievements.unlockedAt}, now())` : userAchievements.unlockedAt, updatedAt: new Date() } }).returning({ unlockedAt: userAchievements.unlockedAt });
      if (justUnlocked && rows[0]?.unlockedAt && !existing?.unlockedAt){unlocked.push(definition.name);await creditCoins(tx,user.id,({common:10,rare:25,epic:50,legendary:100} as const)[definition.rarity],`Достижение: ${definition.name}`,`achievement:${definition.id}`)}
    }
    return { globalXp: personal.totalXp, globalLevel, nextLevelXp: personal.nextLevelXp, localXp: local.xp, localLevel, levelUp: personal.leveledUp || localLevel > local.oldLevel };
  });

  if (result==="cooldown")return NextResponse.json({awarded:0,cooldown:true});
  if (!result) return NextResponse.json({ awarded: 0, duplicate: true });
  return NextResponse.json({ awarded: amount, path, unlocked: [...new Set(unlocked)], profile: result });
}
