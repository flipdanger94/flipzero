import { randomUUID } from "node:crypto";
import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDatabase } from "@/db/client";
import { clanAnnouncements, clanMembers, clans, notifications, users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { getClanRole } from "@/lib/clans";
import { isTrustedMutationRequest } from "@/lib/security-controls";
export async function GET(_:Request,{params}:{params:Promise<{clanId:string}>}){
 const user=await getCurrentUser(),{clanId}=await params;if(!user||!await getClanRole(user.id,clanId))return NextResponse.json({message:"Нет доступа."},{status:403});
 const announcements=await getDatabase().select({id:clanAnnouncements.id,content:clanAnnouncements.content,createdAt:clanAnnouncements.createdAt,authorId:users.id,displayName:users.displayName}).from(clanAnnouncements).innerJoin(users,eq(users.id,clanAnnouncements.authorId)).where(eq(clanAnnouncements.clanId,clanId)).orderBy(desc(clanAnnouncements.createdAt)).limit(50);
 return NextResponse.json({announcements:announcements.reverse()});
}
export async function POST(request:Request,{params}:{params:Promise<{clanId:string}>}){
 if(!isTrustedMutationRequest(request))return NextResponse.json({message:"Запрос отклонён."},{status:403});
 const user=await getCurrentUser(),{clanId}=await params;if(!user)return NextResponse.json({message:"Требуется вход."},{status:401});
 const role=await getClanRole(user.id,clanId);if(role!=="leader"&&role!=="officer")return NextResponse.json({message:"Публиковать объявления могут лидер и офицеры."},{status:403});
 const body=await request.json().catch(()=>null);const content=typeof body?.content==="string"?body.content.trim():"";
 if(content.length<2||content.length>2000)return NextResponse.json({message:"Введите от 2 до 2000 символов."},{status:400});
 const db=getDatabase(),id=randomUUID();await db.transaction(async tx=>{
  await tx.insert(clanAnnouncements).values({id,clanId,authorId:user.id,content});
  const members=await tx.select({userId:clanMembers.userId}).from(clanMembers).where(eq(clanMembers.clanId,clanId));
  if(members.length)await tx.insert(notifications).values(members.filter(member=>member.userId!==user.id).map(member=>({id:randomUUID(),userId:member.userId,actorId:user.id,type:"clan_announcement",title:"Новое объявление клана",body:content.slice(0,160),entityType:"clan",entityId:clanId})));
 });return NextResponse.json({id},{status:201});
}
export async function PATCH(request:Request,{params}:{params:Promise<{clanId:string}>}){
 if(!isTrustedMutationRequest(request))return NextResponse.json({message:"Запрос отклонён."},{status:403});
 const user=await getCurrentUser(),{clanId}=await params;if(!user||await getClanRole(user.id,clanId)!=="leader")return NextResponse.json({message:"Только лидер."},{status:403});
 const body=await request.json().catch(()=>null),welcome=typeof body?.welcomeText==="string"?body.welcomeText.trim():"";
 if(!welcome||welcome.length>400)return NextResponse.json({message:"Введите приветствие до 400 символов."},{status:400});
 await getDatabase().update(clans).set({welcomeText:welcome}).where(eq(clans.id,clanId));return NextResponse.json({ok:true});
}
