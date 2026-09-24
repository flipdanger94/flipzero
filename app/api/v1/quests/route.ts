import { randomUUID } from "node:crypto";
import { and, eq, gte, lt, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDatabase } from "@/db/client";
import { clanMembers, clans, questClaims, users, xpEvents } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { creditCoins } from "@/lib/economy";
import { awardClanContribution } from "@/lib/clan-season";
import { ECONOMY, QUEST_CATALOG } from "@/lib/economy-config";
import { levelFromXp } from "@/lib/gamification";
import { getSuperFlipCapabilities } from "@/lib/superflip";
import { isTrustedMutationRequest } from "@/lib/security-controls";

type Quest=(typeof QUEST_CATALOG)[number];
function period(quest:Quest,now=new Date()){
  const start=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate()));
  if(quest.period==="weekly")start.setUTCDate(start.getUTCDate()-(start.getUTCDay()+6)%7);
  const end=new Date(start);end.setUTCDate(end.getUTCDate()+(quest.period==="daily"?1:7));
  return {start,end,key:start.toISOString().slice(0,10)};
}
async function progress(userId:string,quest:Quest,db= getDatabase()){
  const {start,end}=period(quest);
  const [row]=await db.select({count:quest.source==="voice_minute"?sql<number>`coalesce(sum(${xpEvents.amount}),0)::int`:sql<number>`count(*)::int`}).from(xpEvents).where(and(eq(xpEvents.userId,userId),eq(xpEvents.source,quest.source),gte(xpEvents.createdAt,start),lt(xpEvents.createdAt,end)));
  return Math.min(quest.target,row?.count??0);
}
export async function GET(){
  const user=await getCurrentUser();if(!user)return NextResponse.json({message:"Требуется вход."},{status:401});
  const db=getDatabase();const claims=await db.select({questKey:questClaims.questKey,periodKey:questClaims.periodKey}).from(questClaims).where(eq(questClaims.userId,user.id));
  const quests=await Promise.all(QUEST_CATALOG.map(async quest=>({...quest,progress:await progress(user.id,quest),periodKey:period(quest).key,claimed:claims.some(claim=>claim.questKey===quest.key&&claim.periodKey===period(quest).key)})));
  const dailyDays=[...new Set(claims.filter(claim=>QUEST_CATALOG.some(quest=>quest.period==="daily"&&quest.key===claim.questKey)).map(claim=>claim.periodKey))].sort().reverse();
  let streak=0;const day=new Date();day.setUTCHours(0,0,0,0);if(!dailyDays.includes(day.toISOString().slice(0,10)))day.setUTCDate(day.getUTCDate()-1);
  while(dailyDays.includes(day.toISOString().slice(0,10))){streak++;day.setUTCDate(day.getUTCDate()-1)}
  return NextResponse.json({quests,streak});
}
export async function POST(request:Request){
  if(!isTrustedMutationRequest(request))return NextResponse.json({message:"Запрос отклонён."},{status:403});
  const user=await getCurrentUser();if(!user)return NextResponse.json({message:"Требуется вход."},{status:401});
  const body=await request.json().catch(()=>null);const quest=QUEST_CATALOG.find(item=>item.key===body?.questKey);
  if(!quest)return NextResponse.json({message:"Задание не найдено."},{status:404});
  const db=getDatabase();const superflip=await getSuperFlipCapabilities(user.id);
  try{
    const awarded=await db.transaction(async tx=>{
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${user.id}))`);
      const {start,end,key}=period(quest);
      const [count]=await tx.select({count:quest.source==="voice_minute"?sql<number>`coalesce(sum(${xpEvents.amount}),0)::int`:sql<number>`count(*)::int`}).from(xpEvents).where(and(eq(xpEvents.userId,user.id),eq(xpEvents.source,quest.source),gte(xpEvents.createdAt,start),lt(xpEvents.createdAt,end)));
      if((count?.count??0)<quest.target)return "incomplete" as const;
      const [claim]=await tx.insert(questClaims).values({id:randomUUID(),userId:user.id,questKey:quest.key,periodKey:key}).onConflictDoNothing().returning({id:questClaims.id});
      if(!claim)return "claimed" as const;
      const xp=Math.round(quest.xp*(superflip.active?ECONOMY.superFlipRewardMultiplier:1));
      const coins=Math.round(quest.coins*(superflip.active?ECONOMY.superFlipRewardMultiplier:1));
      await tx.insert(xpEvents).values({id:randomUUID(),userId:user.id,source:"quest",amount:xp,idempotencyKey:`quest:${user.id}:${quest.key}:${key}`});
      const [updated]=await tx.update(users).set({globalXp:sql`${users.globalXp}+${xp}`}).where(eq(users.id,user.id)).returning({globalXp:users.globalXp});
      await tx.update(users).set({globalLevel:levelFromXp(updated.globalXp)}).where(eq(users.id,user.id));
      await awardClanContribution(tx,user.id,xp);
      await creditCoins(tx,user.id,coins,`Квест: ${quest.title}`,`quest:${quest.key}:${key}`);
      let streakCoins=0;
      if(quest.period==="daily"){
        const past=await tx.select({periodKey:questClaims.periodKey,questKey:questClaims.questKey}).from(questClaims).where(eq(questClaims.userId,user.id));
        const days=new Set(past.filter(row=>QUEST_CATALOG.some(item=>item.period==="daily"&&item.key===row.questKey)).map(row=>row.periodKey));
        let daysInRow=1;const previous=new Date(start);previous.setUTCDate(previous.getUTCDate()-1);
        while(days.has(previous.toISOString().slice(0,10))&&daysInRow<30){daysInRow++;previous.setUTCDate(previous.getUTCDate()-1)}
        const bonus=Math.min(ECONOMY.streakMaxBonus,5*daysInRow);
        if(await creditCoins(tx,user.id,bonus,`Серия ${daysInRow} дн.`,`streak:${key}`))streakCoins=bonus;
      }
      return {xp,coins,streakCoins};
    });
    if(awarded==="incomplete")return NextResponse.json({message:"Задание ещё не выполнено."},{status:409});
    if(awarded==="claimed")return NextResponse.json({message:"Награда уже получена."},{status:409});
    return NextResponse.json({awarded});
  }catch{return NextResponse.json({message:"Не удалось начислить награду."},{status:500})}
}
