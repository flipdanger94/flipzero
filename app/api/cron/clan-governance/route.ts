import { randomUUID, timingSafeEqual } from "node:crypto";
import { and, eq, gt, isNull, lt, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDatabase } from "@/db/client";
import { clanEventRsvps, clanEvents, mediaAssets, notifications, userStories } from "@/db/schema";
import { settleClosedSeasons } from "@/lib/clan-season";
export async function GET(request:Request){
 const secret=process.env.CRON_SECRET,authorization=request.headers.get("authorization")??"";
 if(!secret||authorization.length!==`Bearer ${secret}`.length||!timingSafeEqual(Buffer.from(authorization),Buffer.from(`Bearer ${secret}`)))return NextResponse.json({message:"Нет доступа."},{status:403});
 await settleClosedSeasons();
 const db=getDatabase(),now=new Date(),later=new Date(now.getTime()+25*60*60_000);
 await db.delete(userStories).where(lt(userStories.expiresAt,now));
 await db.delete(mediaAssets).where(and(eq(mediaAssets.purpose,"story"),lt(mediaAssets.createdAt,new Date(now.getTime()-86400_000)),sql`not exists (select 1 from user_stories where image_url = '/api/v1/media/' || ${mediaAssets.id})`));
 const upcoming=await db.select({id:clanEvents.id}).from(clanEvents).where(and(isNull(clanEvents.remindedAt),isNull(clanEvents.completedAt),gt(clanEvents.startAt,now),lt(clanEvents.startAt,later))).limit(100);
 let reminded=0;
 for(const {id} of upcoming){await db.transaction(async tx=>{
   const [event]=await tx.update(clanEvents).set({remindedAt:new Date()}).where(and(eq(clanEvents.id,id),isNull(clanEvents.remindedAt))).returning({id:clanEvents.id,title:clanEvents.title,startAt:clanEvents.startAt,clanId:clanEvents.clanId,creatorId:clanEvents.creatorId});
   if(!event)return;
   const guests=await tx.select({userId:clanEventRsvps.userId}).from(clanEventRsvps).where(and(eq(clanEventRsvps.eventId,id),eq(clanEventRsvps.status,"going")));
   if(guests.length)await tx.insert(notifications).values(guests.map(guest=>({id:randomUUID(),userId:guest.userId,actorId:event.creatorId,type:"clan_event_reminder",title:"Скоро событие клана",body:`${event.title} начнётся ${event.startAt.toLocaleString("ru-RU")}.`,entityType:"clan",entityId:event.clanId})));
   reminded++;
 })}
 return NextResponse.json({ok:true,reminded});
}
