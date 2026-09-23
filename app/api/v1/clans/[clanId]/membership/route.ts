import { randomUUID } from "node:crypto";
import { and, eq, inArray, lt, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDatabase } from "@/db/client";
import { clanMembers, clanRequests, clans, notifications, users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { CLAN_MEMBER_LIMIT, canModerateClan, getClanMembership, getClanRole } from "@/lib/clans";
import { isTrustedMutationRequest } from "@/lib/security-controls";

async function addMemberAtomically(clanId:string,userId:string,role:"member"|"officer"="member") {
  const db=getDatabase();
  await db.transaction(async(tx)=>{
    const [slot]=await tx.update(clans).set({memberCount:sql`${clans.memberCount}+1`,updatedAt:new Date()})
      .where(and(eq(clans.id,clanId),lt(clans.memberCount,CLAN_MEMBER_LIMIT))).returning({id:clans.id});
    if(!slot) throw new Error("CLAN_FULL");
    await tx.insert(clanMembers).values({clanId,userId,role});
  });
}

export async function POST(request:Request,{params}:{params:Promise<{clanId:string}>}) {
  if(!isTrustedMutationRequest(request)) return NextResponse.json({message:"Запрос отклонён."},{status:403});
  const user=await getCurrentUser();
  if(!user) return NextResponse.json({message:"Требуется вход."},{status:401});
  const {clanId}=await params;
  const body=await request.json().catch(()=>null);
  const action=String(body?.action??"");
  const db=getDatabase();
  const [clan]=await db.select().from(clans).where(eq(clans.id,clanId)).limit(1);
  if(!clan) return NextResponse.json({message:"Клан не найден."},{status:404});

  if(action==="join"){
    if(clan.joinType!=="open") return NextResponse.json({message:"Этот клан не поддерживает мгновенное вступление."},{status:409});
    try{await addMemberAtomically(clanId,user.id);}
    catch(error){
      const message=String((error as Error).message);
      if(message.includes("CLAN_FULL")) return NextResponse.json({message:"Клан заполнен."},{status:409});
      if(message.includes("clan_members_user_unique")) return NextResponse.json({message:"Вы уже состоите в клане."},{status:409});
      return NextResponse.json({message:"Не удалось вступить в клан."},{status:500});
    }
    return NextResponse.json({ok:true,membership:{clanId,role:"member"}});
  }

  if(action==="apply"){
    if(clan.joinType!=="application") return NextResponse.json({message:"В этот клан нельзя подать заявку."},{status:409});
    if(clan.memberCount>=CLAN_MEMBER_LIMIT) return NextResponse.json({message:"Клан заполнен."},{status:409});
    if(await getClanMembership(user.id)) return NextResponse.json({message:"Вы уже состоите в клане."},{status:409});
    try{
      const id=randomUUID();
      await db.insert(clanRequests).values({id,clanId,userId:user.id,actorId:user.id,kind:"application"});
      const moderators=await db.select({userId:clanMembers.userId}).from(clanMembers).where(and(eq(clanMembers.clanId,clanId),inArray(clanMembers.role,["leader","officer"])));
      if(moderators.length) await db.insert(notifications).values(moderators.map(mod=>({id:randomUUID(),userId:mod.userId,actorId:user.id,type:"clan_application",title:"Новая заявка в клан",body:`${user.displayName} хочет вступить в [${clan.tag}] ${clan.name}.`,entityType:"clan",entityId:clanId})));
      return NextResponse.json({ok:true,requestId:id},{status:201});
    }catch{return NextResponse.json({message:"Заявка уже отправлена."},{status:409});}
  }

  if(action==="invite"){
    const actorRole=await getClanRole(user.id,clanId);
    if(!actorRole||!canModerateClan(actorRole)) return NextResponse.json({message:"Приглашать могут лидер и офицеры."},{status:403});
    if(clan.memberCount>=CLAN_MEMBER_LIMIT) return NextResponse.json({message:"Клан заполнен."},{status:409});
    const username=String(body?.username??"").trim();
    const [target]=await db.select({id:users.id,displayName:users.displayName}).from(users).where(eq(users.username,username)).limit(1);
    if(!target) return NextResponse.json({message:"Пользователь не найден."},{status:404});
    if(await getClanMembership(target.id)) return NextResponse.json({message:"Пользователь уже состоит в клане."},{status:409});
    try{
      const id=randomUUID();
      await db.insert(clanRequests).values({id,clanId,userId:target.id,actorId:user.id,kind:"invite"});
      await db.insert(notifications).values({id:randomUUID(),userId:target.id,actorId:user.id,type:"clan_invite",title:"Приглашение в клан",body:`Вас пригласили в [${clan.tag}] ${clan.name}.`,entityType:"clan",entityId:clanId});
      return NextResponse.json({ok:true,requestId:id},{status:201});
    }catch{return NextResponse.json({message:"Приглашение уже отправлено."},{status:409});}
  }

  if(action==="accept_invite"){
    const requestId=String(body?.requestId??"");
    const [invite]=await db.select().from(clanRequests).where(and(eq(clanRequests.id,requestId),eq(clanRequests.clanId,clanId),eq(clanRequests.userId,user.id),eq(clanRequests.kind,"invite"),eq(clanRequests.status,"pending"))).limit(1);
    if(!invite) return NextResponse.json({message:"Приглашение не найдено."},{status:404});
    try{
      await db.transaction(async(tx)=>{
        const [slot]=await tx.update(clans).set({memberCount:sql`${clans.memberCount}+1`,updatedAt:new Date()}).where(and(eq(clans.id,clanId),lt(clans.memberCount,CLAN_MEMBER_LIMIT))).returning({id:clans.id});
        if(!slot) throw new Error("CLAN_FULL");
        await tx.insert(clanMembers).values({clanId,userId:user.id,role:"member"});
        await tx.update(clanRequests).set({status:"accepted",respondedAt:new Date()}).where(eq(clanRequests.id,requestId));
      });
      return NextResponse.json({ok:true});
    }catch(error){
      const message=String((error as Error).message);
      if(message.includes("CLAN_FULL")) return NextResponse.json({message:"Клан заполнен."},{status:409});
      if(message.includes("clan_members_user_unique")) return NextResponse.json({message:"Вы уже состоите в клане."},{status:409});
      return NextResponse.json({message:"Не удалось принять приглашение."},{status:500});
    }
  }

  return NextResponse.json({message:"Неизвестное действие."},{status:400});
}

export async function PATCH(request:Request,{params}:{params:Promise<{clanId:string}>}) {
  if(!isTrustedMutationRequest(request)) return NextResponse.json({message:"Запрос отклонён."},{status:403});
  const user=await getCurrentUser();
  if(!user) return NextResponse.json({message:"Требуется вход."},{status:401});
  const {clanId}=await params;
  const body=await request.json().catch(()=>null);
  const action=String(body?.action??""), targetUserId=String(body?.userId??"");
  const db=getDatabase();
  const actorRole=await getClanRole(user.id,clanId);
  if(!actorRole||!canModerateClan(actorRole)) return NextResponse.json({message:"Недостаточно прав."},{status:403});
  const [target]=await db.select({role:clanMembers.role,displayName:users.displayName}).from(clanMembers).innerJoin(users,eq(users.id,clanMembers.userId)).where(and(eq(clanMembers.clanId,clanId),eq(clanMembers.userId,targetUserId))).limit(1);
  if(!target) return NextResponse.json({message:"Участник не найден."},{status:404});
  if(target.role==="leader") return NextResponse.json({message:"Нельзя применить это действие к лидеру."},{status:403});

  if(action==="kick"){
    if(actorRole==="officer"&&target.role!=="member") return NextResponse.json({message:"Офицер может исключать только обычных участников."},{status:403});
    await db.transaction(async(tx)=>{
      await tx.delete(clanMembers).where(and(eq(clanMembers.clanId,clanId),eq(clanMembers.userId,targetUserId)));
      await tx.update(clans).set({memberCount:sql`greatest(${clans.memberCount}-1,0)`,updatedAt:new Date()}).where(eq(clans.id,clanId));
      await tx.insert(notifications).values({id:randomUUID(),userId:targetUserId,actorId:user.id,type:"clan_kicked",title:"Вы исключены из клана",body:"Вы больше не состоите в клане.",entityType:"clan",entityId:clanId});
    });
    return NextResponse.json({ok:true});
  }
  if(actorRole!=="leader") return NextResponse.json({message:"Это действие доступно только лидеру."},{status:403});
  if(action==="promote"&&target.role==="member"){
    await db.update(clanMembers).set({role:"officer"}).where(and(eq(clanMembers.clanId,clanId),eq(clanMembers.userId,targetUserId)));return NextResponse.json({ok:true});
  }
  if(action==="demote"&&target.role==="officer"){
    await db.update(clanMembers).set({role:"member"}).where(and(eq(clanMembers.clanId,clanId),eq(clanMembers.userId,targetUserId)));return NextResponse.json({ok:true});
  }
  if(action==="transfer"){
    await db.transaction(async(tx)=>{
      await tx.update(clanMembers).set({role:"officer"}).where(and(eq(clanMembers.clanId,clanId),eq(clanMembers.userId,user.id)));
      await tx.update(clanMembers).set({role:"leader"}).where(and(eq(clanMembers.clanId,clanId),eq(clanMembers.userId,targetUserId)));
      await tx.update(clans).set({leaderId:targetUserId,updatedAt:new Date()}).where(eq(clans.id,clanId));
      await tx.insert(notifications).values({id:randomUUID(),userId:targetUserId,actorId:user.id,type:"clan_leadership",title:"Вы стали лидером клана",body:"Вам передано лидерство клана.",entityType:"clan",entityId:clanId});
    });
    return NextResponse.json({ok:true});
  }
  return NextResponse.json({message:"Действие неприменимо к этой роли."},{status:409});
}

export async function DELETE(request:Request,{params}:{params:Promise<{clanId:string}>}) {
  if(!isTrustedMutationRequest(request)) return NextResponse.json({message:"Запрос отклонён."},{status:403});
  const user=await getCurrentUser();
  if(!user) return NextResponse.json({message:"Требуется вход."},{status:401});
  const {clanId}=await params;
  const role=await getClanRole(user.id,clanId);
  if(!role) return NextResponse.json({message:"Вы не состоите в этом клане."},{status:404});
  if(role==="leader") return NextResponse.json({message:"Лидер должен передать лидерство или удалить клан."},{status:409});
  const db=getDatabase();
  await db.transaction(async(tx)=>{
    await tx.delete(clanMembers).where(and(eq(clanMembers.clanId,clanId),eq(clanMembers.userId,user.id)));
    await tx.update(clans).set({memberCount:sql`greatest(${clans.memberCount}-1,0)`,updatedAt:new Date()}).where(eq(clans.id,clanId));
  });
  return NextResponse.json({ok:true});
}
