import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, ilike, inArray, or } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDatabase } from "@/db/client";
import { clanMembers, clanRequests, clans, users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { getClanMembership, normalizeClanDescription, normalizeClanJoinType, normalizeClanName, normalizeClanTag } from "@/lib/clans";
import { isTrustedMutationRequest } from "@/lib/security-controls";

export async function GET(request:Request) {
  const user=await getCurrentUser();
  if(!user) return NextResponse.json({message:"Требуется вход."},{status:401});
  const db=getDatabase();
  const membership=await getClanMembership(user.id);
  if(membership){
    const [clan]=await db.select().from(clans).where(eq(clans.id,membership.clanId)).limit(1);
    const [pendingInvite]=await db.select({id:clanRequests.id}).from(clanRequests).where(and(eq(clanRequests.userId,user.id),eq(clanRequests.kind,"invite"),eq(clanRequests.status,"pending"))).orderBy(desc(clanRequests.createdAt)).limit(1);
    return NextResponse.json({membership,clan,pendingInviteId:pendingInvite?.id??null});
  }

  const url=new URL(request.url);
  const query=(url.searchParams.get("q")??"").trim().slice(0,64);
  const rows=await db.select({
    id:clans.id,name:clans.name,tag:clans.tag,description:clans.description,avatarUrl:clans.avatarUrl,bannerUrl:clans.bannerUrl,
    joinType:clans.joinType,memberCount:clans.memberCount,leaderId:clans.leaderId,createdAt:clans.createdAt,
  }).from(clans).where(query?or(ilike(clans.name,`%${query}%`),ilike(clans.tag,`%${query}%`)):undefined).orderBy(asc(clans.memberCount),asc(clans.name)).limit(50);
  const pending=await db.select({clanId:clanRequests.clanId,id:clanRequests.id,kind:clanRequests.kind,status:clanRequests.status})
    .from(clanRequests).where(and(eq(clanRequests.userId,user.id),eq(clanRequests.status,"pending")));
  const pendingByClan=new Map(pending.map(item=>[item.clanId,item]));
  const invitedIds=pending.filter(item=>item.kind==="invite").map(item=>item.clanId);
  const invited=!query&&invitedIds.length?await db.select({
    id:clans.id,name:clans.name,tag:clans.tag,description:clans.description,avatarUrl:clans.avatarUrl,bannerUrl:clans.bannerUrl,
    joinType:clans.joinType,memberCount:clans.memberCount,leaderId:clans.leaderId,createdAt:clans.createdAt,
  }).from(clans).where(inArray(clans.id,invitedIds)):[];
  const merged=[...invited,...rows.filter(row=>!invited.some(invite=>invite.id===row.id))].slice(0,50);
  return NextResponse.json({membership:null,clans:merged.map(clan=>({...clan,pendingRequest:pendingByClan.get(clan.id)??null,full:clan.memberCount>=50}))});
}

export async function POST(request:Request) {
  if(!isTrustedMutationRequest(request)) return NextResponse.json({message:"Запрос отклонён."},{status:403});
  const user=await getCurrentUser();
  if(!user) return NextResponse.json({message:"Требуется вход."},{status:401});
  const body=await request.json().catch(()=>null);
  const name=normalizeClanName(body?.name), tag=normalizeClanTag(body?.tag), joinType=normalizeClanJoinType(body?.joinType);
  const description=normalizeClanDescription(body?.description);
  if(!name) return NextResponse.json({message:"Название клана должно содержать от 3 до 32 символов."},{status:400});
  if(!tag) return NextResponse.json({message:"Тег должен содержать 2–5 букв или цифр."},{status:400});
  if(!joinType) return NextResponse.json({message:"Выберите тип вступления."},{status:400});

  const db=getDatabase();
  const id=randomUUID();
  try{
    await db.transaction(async(tx)=>{
      await tx.insert(clans).values({id,name,tag,description,joinType,memberCount:1,leaderId:user.id});
      await tx.insert(clanMembers).values({clanId:id,userId:user.id,role:"leader"});
      await tx.update(clanRequests).set({status:"cancelled",respondedAt:new Date()}).where(and(eq(clanRequests.userId,user.id),eq(clanRequests.status,"pending")));
    });
  }catch(error){
    const message=String((error as {message?:string})?.message??"");
    if(message.includes("clan_members_user_unique")) return NextResponse.json({message:"Вы уже состоите в клане."},{status:409});
    if(message.includes("clans_name_unique")) return NextResponse.json({message:"Клан с таким названием уже существует."},{status:409});
    if(message.includes("clans_tag_unique")) return NextResponse.json({message:"Этот тег уже занят."},{status:409});
    return NextResponse.json({message:"Не удалось создать клан."},{status:500});
  }
  const [created]=await db.select().from(clans).where(eq(clans.id,id)).limit(1);
  return NextResponse.json({clan:created,membership:{clanId:id,role:"leader"}},{status:201});
}
