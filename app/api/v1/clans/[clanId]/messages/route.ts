import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDatabase } from "@/db/client";
import { clanMessages, users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { getClanRole, normalizeClanAttachments } from "@/lib/clans";
import { getSuperFlipCapabilities } from "@/lib/superflip";
import { isTrustedMutationRequest } from "@/lib/security-controls";

export async function GET(request:Request,{params}:{params:Promise<{clanId:string}>}) {
  const user=await getCurrentUser();
  if(!user) return NextResponse.json({message:"Требуется вход."},{status:401});
  const {clanId}=await params;
  const role=await getClanRole(user.id,clanId);
  if(!role) return NextResponse.json({message:"Чат доступен только участникам клана."},{status:403});
  const url=new URL(request.url);
  const before=url.searchParams.get("before");
  const db=getDatabase();
  let query=db.select({
    id:clanMessages.id,clanId:clanMessages.clanId,authorId:clanMessages.authorId,content:clanMessages.content,
    attachments:clanMessages.attachments,createdAt:clanMessages.createdAt,editedAt:clanMessages.editedAt,
    username:users.username,displayName:users.displayName,avatarUrl:users.avatarUrl,globalLevel:users.globalLevel,
  }).from(clanMessages).innerJoin(users,eq(users.id,clanMessages.authorId))
    .where(and(eq(clanMessages.clanId,clanId),isNull(clanMessages.deletedAt)))
    .orderBy(desc(clanMessages.createdAt)).limit(100);
  const rows=await query;
  const filtered=before?rows.filter(row=>row.createdAt.toISOString()<before):rows;
  return NextResponse.json({messages:filtered.slice(0,50).reverse()});
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
    message:`Максимальная длина сообщения — ${access.capabilities.directMessageLimit} символов${access.active?" с SuperFlip.":". SuperFlip увеличивает лимит до 4000."}`,
    limit:access.capabilities.directMessageLimit,
  },{status:400});
  const attachments=normalizeClanAttachments(body?.attachments);
  if(!raw&&!attachments.length) return NextResponse.json({message:"Введите сообщение или добавьте вложение."},{status:400});
  const id=randomUUID(), now=new Date();
  await getDatabase().insert(clanMessages).values({id,clanId,authorId:user.id,content:raw,attachments});
  return NextResponse.json({message:{id,clanId,authorId:user.id,content:raw,attachments,createdAt:now.toISOString(),editedAt:null,username:user.username,displayName:user.displayName,avatarUrl:user.avatarUrl,globalLevel:user.globalLevel}},{status:201});
}
