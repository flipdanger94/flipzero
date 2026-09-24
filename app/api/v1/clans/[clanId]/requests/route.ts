import { randomUUID } from "node:crypto";
import { and, eq, lt, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDatabase } from "@/db/client";
import { clanMembers, clanRequests, clans, notifications } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { CLAN_MEMBER_LIMIT, canModerateClan, getClanRole } from "@/lib/clans";
import { isTrustedMutationRequest } from "@/lib/security-controls";

export async function PATCH(request:Request,{params}:{params:Promise<{clanId:string}>}) {
  if(!isTrustedMutationRequest(request)) return NextResponse.json({message:"Запрос отклонён."},{status:403});
  const user=await getCurrentUser();
  if(!user) return NextResponse.json({message:"Требуется вход."},{status:401});
  const {clanId}=await params;
  const role=await getClanRole(user.id,clanId);
  if(!role||!canModerateClan(role)) return NextResponse.json({message:"Недостаточно прав."},{status:403});
  const body=await request.json().catch(()=>null);
  const requestId=String(body?.requestId??""), decision=String(body?.decision??"");
  if(!["accept","decline"].includes(decision)) return NextResponse.json({message:"Некорректное решение."},{status:400});
  const db=getDatabase();
  const [application]=await db.select().from(clanRequests).where(and(eq(clanRequests.id,requestId),eq(clanRequests.clanId,clanId),eq(clanRequests.kind,"application"),eq(clanRequests.status,"pending"))).limit(1);
  if(!application) return NextResponse.json({message:"Заявка не найдена."},{status:404});

  if(decision==="decline"){
    await db.transaction(async(tx)=>{
      await tx.update(clanRequests).set({status:"declined",respondedAt:new Date()}).where(eq(clanRequests.id,requestId));
      await tx.insert(notifications).values({id:randomUUID(),userId:application.userId,actorId:user.id,type:"clan_application_declined",title:"Заявка в клан отклонена",body:"Ваша заявка на вступление была отклонена.",entityType:"clan",entityId:clanId});
    });
    return NextResponse.json({ok:true});
  }

  try{
    await db.transaction(async(tx)=>{
      const [slot]=await tx.update(clans).set({memberCount:sql`${clans.memberCount}+1`,updatedAt:new Date()})
        .where(and(eq(clans.id,clanId),lt(clans.memberCount,CLAN_MEMBER_LIMIT))).returning({id:clans.id});
      if(!slot) throw new Error("CLAN_FULL");
      await tx.insert(clanMembers).values({clanId,userId:application.userId,role:"member"});
      const [welcome]=await tx.select({text:clans.welcomeText,leaderId:clans.leaderId}).from(clans).where(eq(clans.id,clanId)).limit(1);
      if(welcome)await tx.insert(notifications).values({id:randomUUID(),userId:application.userId,actorId:welcome.leaderId,type:"clan_welcome",title:"Добро пожаловать в клан",body:welcome.text,entityType:"clan",entityId:clanId});
      await tx.update(clanRequests).set({status:"cancelled",respondedAt:new Date()}).where(and(eq(clanRequests.userId,application.userId),eq(clanRequests.status,"pending")));
      await tx.update(clanRequests).set({status:"accepted",respondedAt:new Date()}).where(eq(clanRequests.id,requestId));
      await tx.insert(notifications).values({id:randomUUID(),userId:application.userId,actorId:user.id,type:"clan_application_accepted",title:"Заявка в клан принята",body:"Добро пожаловать в клан!",entityType:"clan",entityId:clanId});
    });
    return NextResponse.json({ok:true});
  }catch(error){
    const message=String((error as Error).message);
    if(message.includes("CLAN_FULL")) return NextResponse.json({message:"Клан заполнен."},{status:409});
    if(message.includes("clan_members_user_unique")) return NextResponse.json({message:"Пользователь уже состоит в другом клане."},{status:409});
    return NextResponse.json({message:"Не удалось принять заявку."},{status:500});
  }
}
