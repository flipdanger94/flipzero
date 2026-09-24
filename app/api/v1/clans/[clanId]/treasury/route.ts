import { randomUUID } from "node:crypto";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDatabase } from "@/db/client";
import { clans, clanTreasuryEntries, clanUpgrades } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { CLAN_UPGRADES } from "@/lib/clan-governance-config";
import { getClanRole } from "@/lib/clans";
import { debitCoins } from "@/lib/economy";
import { isTrustedMutationRequest } from "@/lib/security-controls";
const target=(key:string)=>CLAN_UPGRADES[key as keyof typeof CLAN_UPGRADES];
export async function GET(_:Request,{params}:{params:Promise<{clanId:string}>}){
 const user=await getCurrentUser(),{clanId}=await params;if(!user||!await getClanRole(user.id,clanId))return NextResponse.json({message:"Нет доступа."},{status:403});
 const db=getDatabase();const [[clan],entries,upgrades]=await Promise.all([
  db.select({treasury:clans.treasury,officerTreasuryAccess:clans.officerTreasuryAccess}).from(clans).where(eq(clans.id,clanId)).limit(1),
  db.select().from(clanTreasuryEntries).where(eq(clanTreasuryEntries.clanId,clanId)).orderBy(desc(clanTreasuryEntries.createdAt)).limit(50),
  db.select().from(clanUpgrades).where(eq(clanUpgrades.clanId,clanId)),
 ]);return NextResponse.json({balance:clan?.treasury??0,officerTreasuryAccess:clan?.officerTreasuryAccess??false,entries,upgrades,catalog:CLAN_UPGRADES});
}
export async function POST(request:Request,{params}:{params:Promise<{clanId:string}>}){
 if(!isTrustedMutationRequest(request))return NextResponse.json({message:"Запрос отклонён."},{status:403});
 const user=await getCurrentUser(),{clanId}=await params;if(!user)return NextResponse.json({message:"Требуется вход."},{status:401});
 const role=await getClanRole(user.id,clanId);if(!role)return NextResponse.json({message:"Нет доступа."},{status:403});
 const body=await request.json().catch(()=>null);const action=body?.action,key=String(body?.idempotencyKey??"");if(!/^[a-zA-Z0-9:_-]{8,100}$/.test(key))return NextResponse.json({message:"Некорректный ключ операции."},{status:400});
 const db=getDatabase();
 try{const status=await db.transaction(async tx=>{
   await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${user.id}))`);
   const [existing]=await tx.select({id:clanTreasuryEntries.id}).from(clanTreasuryEntries).where(eq(clanTreasuryEntries.idempotencyKey,`${user.id}:${key}`)).limit(1);
   if(existing)return "duplicate";
   const [clan]=await tx.select({treasury:clans.treasury,officerTreasuryAccess:clans.officerTreasuryAccess}).from(clans).where(eq(clans.id,clanId)).limit(1);
   if(!clan)return "missing";
   if(action==="donate"){
     const amount=Number(body?.amount);if(!Number.isSafeInteger(amount)||amount<1||amount>5000)return "invalid";
     const day=new Date();day.setUTCHours(0,0,0,0);
     const [daily]=await tx.select({sum:sql<number>`coalesce(sum(${clanTreasuryEntries.amount}),0)::int`}).from(clanTreasuryEntries).where(and(eq(clanTreasuryEntries.userId,user.id),gte(clanTreasuryEntries.createdAt,day),sql`${clanTreasuryEntries.amount}>0`));
     if((daily?.sum??0)+amount>5000)return "limit";
     if(!await debitCoins(tx,user.id,amount,"Вклад в казну клана",`treasury:${key}`))return "funds";
     await tx.update(clans).set({treasury:sql`${clans.treasury}+${amount}`}).where(eq(clans.id,clanId));
     await tx.insert(clanTreasuryEntries).values({id:randomUUID(),clanId,userId:user.id,amount,reason:"Вклад участника",idempotencyKey:`${user.id}:${key}`});return "ok";
   }
   if(action==="upgrade"){
     if(role!=="leader"&&!(role==="officer"&&clan.officerTreasuryAccess))return "forbidden";
     const upgradeKey=String(body?.upgradeKey??""),upgrade=target(upgradeKey);if(!upgrade)return "invalid";
     const [current]=await tx.select({level:clanUpgrades.level}).from(clanUpgrades).where(and(eq(clanUpgrades.clanId,clanId),eq(clanUpgrades.upgradeKey,upgradeKey))).limit(1);
     const level=current?.level??0,price=upgrade.prices[level];if(!price)return "max";
     const [paid]=await tx.update(clans).set({treasury:sql`${clans.treasury}-${price}`}).where(and(eq(clans.id,clanId),gte(clans.treasury,price))).returning({id:clans.id});if(!paid)return "funds";
     await tx.insert(clanUpgrades).values({clanId,upgradeKey,level:1}).onConflictDoUpdate({target:[clanUpgrades.clanId,clanUpgrades.upgradeKey],set:{level:sql`${clanUpgrades.level}+1`}});
     await tx.insert(clanTreasuryEntries).values({id:randomUUID(),clanId,userId:user.id,amount:-price,reason:`Улучшение: ${upgrade.label}, уровень ${level+1}`,idempotencyKey:`${user.id}:${key}`});return "ok";
   }
   return "invalid";
 });return status==="ok"?NextResponse.json({ok:true}):NextResponse.json({message:({duplicate:"Операция уже выполнена.",missing:"Клан не найден.",invalid:"Некорректное действие.",limit:"Достигнут суточный лимит вклада.",funds:"Недостаточно монет.",forbidden:"Недостаточно прав.",max:"Достигнут максимальный уровень."} as Record<string,string>)[status]},{status:409});}
 catch{return NextResponse.json({message:"Операция не выполнена."},{status:500})}
}
export async function PATCH(request:Request,{params}:{params:Promise<{clanId:string}>}){
 if(!isTrustedMutationRequest(request))return NextResponse.json({message:"Запрос отклонён."},{status:403});
 const user=await getCurrentUser(),{clanId}=await params;if(!user||await getClanRole(user.id,clanId)!=="leader")return NextResponse.json({message:"Только лидер."},{status:403});
 const body=await request.json().catch(()=>null);if(typeof body?.officerTreasuryAccess!=="boolean")return NextResponse.json({message:"Некорректная настройка."},{status:400});
 await getDatabase().update(clans).set({officerTreasuryAccess:body.officerTreasuryAccess}).where(eq(clans.id,clanId));return NextResponse.json({ok:true});
}
