import { and, asc, desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDatabase } from "@/db/client";
import { clanMembers, clanRequests, clans, users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { canManageClan, canModerateClan, getClanRole, normalizeClanDescription, normalizeClanJoinType, normalizeClanName, normalizeClanTag } from "@/lib/clans";
import { isTrustedMutationRequest } from "@/lib/security-controls";

export async function GET(_request:Request,{params}:{params:Promise<{clanId:string}>}) {
  const user=await getCurrentUser();
  if(!user) return NextResponse.json({message:"Требуется вход."},{status:401});
  const {clanId}=await params;
  const role=await getClanRole(user.id,clanId);
  if(!role) return NextResponse.json({message:"Доступ только для участников клана."},{status:403});
  const db=getDatabase();
  const [clan]=await db.select().from(clans).where(eq(clans.id,clanId)).limit(1);
  if(!clan) return NextResponse.json({message:"Клан не найден."},{status:404});
  const members=await db.select({
    userId:users.id,username:users.username,displayName:users.displayName,avatarUrl:users.avatarUrl,presence:users.presence,
    globalLevel:users.globalLevel,globalXp:users.globalXp,role:clanMembers.role,joinedAt:clanMembers.joinedAt,lastSeenAt:users.lastSeenAt,
  }).from(clanMembers).innerJoin(users,eq(users.id,clanMembers.userId)).where(eq(clanMembers.clanId,clanId)).orderBy(asc(clanMembers.joinedAt));
  const now=Date.now();
  const normalizedMembers=members.map(({lastSeenAt,...member})=>({...member,presence:lastSeenAt&&lastSeenAt.getTime()>now-90_000?"online":"offline"}));
  const requests=canModerateClan(role)?await db.select({
    id:clanRequests.id,userId:clanRequests.userId,kind:clanRequests.kind,status:clanRequests.status,createdAt:clanRequests.createdAt,
    username:users.username,displayName:users.displayName,avatarUrl:users.avatarUrl,globalLevel:users.globalLevel,
  }).from(clanRequests).innerJoin(users,eq(users.id,clanRequests.userId)).where(and(eq(clanRequests.clanId,clanId),eq(clanRequests.status,"pending"))).orderBy(desc(clanRequests.createdAt)):[];

  return NextResponse.json({clan,role,members:normalizedMembers,requests,permissions:{moderate:canModerateClan(role),manage:canManageClan(role)}});
}

export async function PATCH(request:Request,{params}:{params:Promise<{clanId:string}>}) {
  if(!isTrustedMutationRequest(request)) return NextResponse.json({message:"Запрос отклонён."},{status:403});
  const user=await getCurrentUser();
  if(!user) return NextResponse.json({message:"Требуется вход."},{status:401});
  const {clanId}=await params;
  const role=await getClanRole(user.id,clanId);
  if(role!=="leader") return NextResponse.json({message:"Изменять настройки может только лидер."},{status:403});
  const body=await request.json().catch(()=>null);
  const values:Record<string,unknown>={updatedAt:new Date()};
  if(body?.name!==undefined){const name=normalizeClanName(body.name);if(!name)return NextResponse.json({message:"Название: 3–32 символа."},{status:400});values.name=name;}
  if(body?.tag!==undefined){const tag=normalizeClanTag(body.tag);if(!tag)return NextResponse.json({message:"Тег: 2–5 букв или цифр."},{status:400});values.tag=tag;}
  if(body?.description!==undefined) values.description=normalizeClanDescription(body.description);
  if(body?.joinType!==undefined){const joinType=normalizeClanJoinType(body.joinType);if(!joinType)return NextResponse.json({message:"Некорректный тип вступления."},{status:400});values.joinType=joinType;}
  try{
    const [updated]=await getDatabase().update(clans).set(values).where(eq(clans.id,clanId)).returning();
    return NextResponse.json({clan:updated});
  }catch(error){
    const message=String((error as {message?:string})?.message??"");
    if(message.includes("clans_name_unique")) return NextResponse.json({message:"Название уже занято."},{status:409});
    if(message.includes("clans_tag_unique")) return NextResponse.json({message:"Тег уже занят."},{status:409});
    return NextResponse.json({message:"Не удалось сохранить настройки."},{status:500});
  }
}

export async function DELETE(request:Request,{params}:{params:Promise<{clanId:string}>}) {
  if(!isTrustedMutationRequest(request)) return NextResponse.json({message:"Запрос отклонён."},{status:403});
  const user=await getCurrentUser();
  if(!user) return NextResponse.json({message:"Требуется вход."},{status:401});
  const {clanId}=await params;
  const role=await getClanRole(user.id,clanId);
  if(role!=="leader") return NextResponse.json({message:"Удалить клан может только лидер."},{status:403});
  const body=await request.json().catch(()=>null);
  const [clan]=await getDatabase().select({name:clans.name}).from(clans).where(eq(clans.id,clanId)).limit(1);
  if(!clan) return NextResponse.json({message:"Клан не найден."},{status:404});
  if(String(body?.name??"")!==clan.name) return NextResponse.json({message:"Введите точное название клана для подтверждения."},{status:400});
  await getDatabase().delete(clans).where(eq(clans.id,clanId));
  return NextResponse.json({ok:true});
}
