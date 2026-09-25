import { randomUUID } from "node:crypto";
import { and, desc, eq, isNull, lt, or } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDatabase } from "@/db/client";
import { clanMessages, users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { getClanRole, normalizeClanAttachments } from "@/lib/clans";
import { getSuperFlipCapabilities } from "@/lib/superflip";
import { isTrustedMutationRequest } from "@/lib/security-controls";
import { levelFromXp } from "@/lib/gamification";
import { presentationForUsers } from "@/lib/presentation";

export async function GET(request:Request,{params}:{params:Promise<{clanId:string}>}) {
  const user=await getCurrentUser();
  if(!user) return NextResponse.json({message:"Требуется вход."},{status:401});
  const {clanId}=await params;
  const role=await getClanRole(user.id,clanId);
  if(!role) return NextResponse.json({message:"Чат доступен только участникам клана."},{status:403});
  const url=new URL(request.url);
  const before=url.searchParams.get("before");
  const [beforeDate,beforeId]=before?.split("|")??[];
  if(before&&(!Number.isFinite(Date.parse(beforeDate))||!/Z$/.test(beforeDate)||!/^[0-9a-f-]{36}$/i.test(beforeId??"")))return NextResponse.json({message:"Некорректный курсор истории."},{status:400});
  const db=getDatabase();
  const rows=await db.select({
    id:clanMessages.id,clanId:clanMessages.clanId,authorId:clanMessages.authorId,content:clanMessages.content,
    attachments:clanMessages.attachments,createdAt:clanMessages.createdAt,editedAt:clanMessages.editedAt,
    username:users.username,displayName:users.displayName,avatarUrl:users.avatarUrl,globalXp:users.globalXp,
  }).from(clanMessages).innerJoin(users,eq(users.id,clanMessages.authorId))
    .where(and(eq(clanMessages.clanId,clanId),isNull(clanMessages.deletedAt),...(before?[or(lt(clanMessages.createdAt,new Date(beforeDate)),and(eq(clanMessages.createdAt,new Date(beforeDate)),lt(clanMessages.id,beforeId)))!]:[])))
    .orderBy(desc(clanMessages.createdAt),desc(clanMessages.id)).limit(51);
  const presentation=await presentationForUsers(rows.map(row=>row.authorId));
  return NextResponse.json({messages:rows.slice(0,50).reverse().map(({globalXp,...message})=>({...message,globalXp,globalLevel:levelFromXp(globalXp),cosmetics:presentation.get(message.authorId)?.cosmetics??{},badges:presentation.get(message.authorId)?.badges??[]})),nextCursor:rows.length>50?`${rows[49].createdAt.toISOString()}|${rows[49].id}`:null});
}

export async function POST(request:Request,{params}:{params:Promise<{clanId:string}>}) {
  if(!isTrustedMutationRequest(request)) return NextResponse.json({message:"Запрос отклонён."},{status:403});
  const user=await getCurrentUser();
  if(!user) return NextResponse.json({message:"Требуется вход."},{status:401});
  const {clanId}=await params;
  const role=await getClanRole(user.id,clanId);
  if(!role) return NextResponse.json({message:"Чат доступен только участникам клана."},{status:403});
  const body=await request.json().catch(()=>null);
  const access=await getSuperFlipCapabilities(user.id);
  const raw=typeof body?.content==="string"?body.content.trim():"";
  if(raw.length>access.capabilities.directMessageLimit) return NextResponse.json({
    code:"MESSAGE_TOO_LONG",
    message:`Максимальная длина сообщения — ${access.capabilities.directMessageLimit} символов.`,
    limit:access.capabilities.directMessageLimit,
  },{status:400});
  const attachments=normalizeClanAttachments(body?.attachments);
  if(!raw&&!attachments.length) return NextResponse.json({message:"Введите сообщение или добавьте вложение."},{status:400});
  const id=randomUUID(), now=new Date();
  const db=getDatabase();await db.transaction(async tx=>{
    await tx.insert(clanMessages).values({id,clanId,authorId:user.id,content:raw,attachments});
  });
  return NextResponse.json({message:{id,clanId,authorId:user.id,content:raw,attachments,createdAt:now.toISOString(),editedAt:null,username:user.username,displayName:user.displayName,avatarUrl:user.avatarUrl,globalLevel:levelFromXp(user.globalXp)}},{status:201});
}
