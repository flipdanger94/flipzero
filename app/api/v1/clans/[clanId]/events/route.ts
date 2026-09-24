import { randomUUID } from "node:crypto";
import { and, asc, count, eq, gte, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDatabase } from "@/db/client";
import { clanEventRsvps, clanEvents, clanMembers, clanTreasuryEntries, clans, notifications } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { getClanRole } from "@/lib/clans";
import { creditCoins } from "@/lib/economy";
import { isTrustedMutationRequest } from "@/lib/security-controls";
export async function GET(_:Request,{params}:{params:Promise<{clanId:string}>}){
 const user=await getCurrentUser(),{clanId}=await params;if(!user||!await getClanRole(user.id,clanId))return NextResponse.json({message:"Нет доступа."},{status:403});
 const db=getDatabase();const events=await db.select().from(clanEvents).where(eq(clanEvents.clanId,clanId)).orderBy(asc(clanEvents.startAt)).limit(50);
 const rsvps=events.length?await db.select().from(clanEventRsvps).where(sql`${clanEventRsvps.eventId} IN (${sql.join(events.map(e=>sql`${e.id}`),sql`,`)})`):[];
 return NextResponse.json({events:events.map(event=>({...event,going:rsvps.filter(row=>row.eventId===event.id&&row.status==="going").length,myRsvp:rsvps.find(row=>row.eventId===event.id&&row.userId===user.id)?.status??null}))});
}
export async function POST(request:Request,{params}:{params:Promise<{clanId:string}>}){
 if(!isTrustedMutationRequest(request))return NextResponse.json({message:"Запрос отклонён."},{status:403});
 const user=await getCurrentUser(),{clanId}=await params;if(!user)return NextResponse.json({message:"Требуется вход."},{status:401});
 const role=await getClanRole(user.id,clanId),body=await request.json().catch(()=>null);if(!role)return NextResponse.json({message:"Нет доступа."},{status:403});
 const db=getDatabase();
 if(body?.action==="rsvp"){
  const eventId=String(body.eventId??""),status=body.status;
  if(!["going","maybe","declined"].includes(status))return NextResponse.json({message:"Некорректный ответ."},{status:400});
  const result=await db.transaction(async tx=>{
   const [event]=await tx.select().from(clanEvents).where(and(eq(clanEvents.id,eventId),eq(clanEvents.clanId,clanId))).limit(1);
   if(!event||event.completedAt||event.startAt<new Date())return "closed";
   if(status==="going"){
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`event:${eventId}`}))`);
    const [{value}]=await tx.select({value:count()}).from(clanEventRsvps).where(and(eq(clanEventRsvps.eventId,eventId),eq(clanEventRsvps.status,"going")));
    const [current]=await tx.select({status:clanEventRsvps.status}).from(clanEventRsvps).where(and(eq(clanEventRsvps.eventId,eventId),eq(clanEventRsvps.userId,user.id))).limit(1);
    if(current?.status!=="going"&&value>=event.capacity)return "full";
   }
   await tx.insert(clanEventRsvps).values({eventId,userId:user.id,status}).onConflictDoUpdate({target:[clanEventRsvps.eventId,clanEventRsvps.userId],set:{status}});return "ok";
  });return result==="ok"?NextResponse.json({ok:true}):NextResponse.json({message:result==="full"?"Все места заняты.":"Событие завершено."},{status:409});
 }
 if(!["leader","officer"].includes(role))return NextResponse.json({message:"Создавать события могут лидер и офицеры."},{status:403});
 const title=String(body?.title??"").trim(),description=String(body?.description??"").trim(),startAt=new Date(body?.startAt),capacity=Number(body?.capacity),rewardCoins=Number(body?.rewardCoins??0);
 if(!title||title.length>80||description.length>500||!Number.isFinite(startAt.getTime())||startAt.getTime()<Date.now()+60_000||startAt.getTime()>Date.now()+90*86400_000||!Number.isInteger(capacity)||capacity<2||capacity>50||!Number.isInteger(rewardCoins)||rewardCoins<0||rewardCoins>100)return NextResponse.json({message:"Проверьте название, дату, лимит и награду."},{status:400});
 const [event]=await db.insert(clanEvents).values({id:randomUUID(),clanId,creatorId:user.id,title,description,startAt,capacity,rewardCoins}).returning();return NextResponse.json({event},{status:201});
}
export async function PATCH(request:Request,{params}:{params:Promise<{clanId:string}>}){
 if(!isTrustedMutationRequest(request))return NextResponse.json({message:"Запрос отклонён."},{status:403});
 const user=await getCurrentUser(),{clanId}=await params;if(!user)return NextResponse.json({message:"Требуется вход."},{status:401});
 const role=await getClanRole(user.id,clanId);if(!role||role==="member")return NextResponse.json({message:"Нет доступа."},{status:403});
 const body=await request.json().catch(()=>null),eventId=String(body?.eventId??"");const db=getDatabase();
 const result=await db.transaction(async tx=>{
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`event:${eventId}`}))`);
  const [event]=await tx.select().from(clanEvents).where(and(eq(clanEvents.id,eventId),eq(clanEvents.clanId,clanId))).limit(1);
  if(!event||event.completedAt||event.startAt>new Date()||Date.now()-event.startAt.getTime()>24*3600_000)return "invalid";
  const guests=await tx.select({userId:clanEventRsvps.userId}).from(clanEventRsvps).innerJoin(clanMembers,and(eq(clanMembers.clanId,clanId),eq(clanMembers.userId,clanEventRsvps.userId))).where(and(eq(clanEventRsvps.eventId,eventId),eq(clanEventRsvps.status,"going")));
  const total=guests.length*event.rewardCoins;
  if(total){const [paid]=await tx.update(clans).set({treasury:sql`${clans.treasury}-${total}`}).where(and(eq(clans.id,clanId),gte(clans.treasury,total))).returning({id:clans.id});if(!paid)return "funds";await tx.insert(clanTreasuryEntries).values({id:randomUUID(),clanId,userId:user.id,amount:-total,reason:`Событие: ${event.title}`,idempotencyKey:`event:${eventId}`})}
  for(const guest of guests){if(event.rewardCoins)await creditCoins(tx,guest.userId,event.rewardCoins,`Событие клана: ${event.title}`,`event:${eventId}`);await tx.insert(notifications).values({id:randomUUID(),userId:guest.userId,actorId:user.id,type:"clan_event",title:"Событие завершилось",body:`${event.title} — награда ${event.rewardCoins} монет.`,entityType:"clan",entityId:clanId})}
  await tx.update(clanEvents).set({completedAt:new Date()}).where(eq(clanEvents.id,eventId));return "ok";
 });return result==="ok"?NextResponse.json({ok:true}):NextResponse.json({message:result==="funds"?"В казне недостаточно монет для наград.":"Событие ещё не началось или уже завершено."},{status:409});
}
