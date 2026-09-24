import { and, desc, eq, lte } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDatabase } from "@/db/client";
import { clanMembers, clanRequests, clanSeasonAwards, clanUpgrades, clans, users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { canManageClan, canModerateClan, getClanRole, normalizeClanDescription, normalizeClanJoinType, normalizeClanName, normalizeClanTag } from "@/lib/clans";
import { isTrustedMutationRequest } from "@/lib/security-controls";
import { clanLevel, validTagColor, validTagIcon } from "@/lib/clan-progress";
import { levelFromXp } from "@/lib/gamification";
import { presentationForUsers } from "@/lib/presentation";

export async function GET(_request:Request,{params}:{params:Promise<{clanId:string}>}) {
  const user=await getCurrentUser();
  if(!user) return NextResponse.json({message:"Требуется вход."},{status:401});
  const {clanId}=await params;
  const role=await getClanRole(user.id,clanId);
  const db=getDatabase();
  const [clan]=await db.select().from(clans).where(eq(clans.id,clanId)).limit(1);
  if(!clan) return NextResponse.json({message:"Клан не найден."},{status:404});
  if(!role)return NextResponse.json({clan:{id:clan.id,name:clan.name,tag:clan.tag,tagColor:clan.tagColor,tagIcon:clan.tagIcon,description:clan.description,avatarUrl:clan.avatarUrl,bannerUrl:clan.bannerUrl,joinType:clan.joinType,memberCount:clan.memberCount,xp:clan.xp,level:clanLevel(clan.xp)},role:null});
  const members=await db.select({
    userId:users.id,username:users.username,displayName:users.displayName,avatarUrl:users.avatarUrl,presence:users.presence,
    globalLevel:users.globalLevel,globalXp:users.globalXp,contributionXp:clanMembers.contributionXp,customRoleId:clanMembers.customRoleId,role:clanMembers.role,joinedAt:clanMembers.joinedAt,lastSeenAt:users.lastSeenAt,
  }).from(clanMembers).innerJoin(users,eq(users.id,clanMembers.userId)).where(eq(clanMembers.clanId,clanId)).orderBy(desc(clanMembers.contributionXp),desc(clanMembers.joinedAt));
  const now=Date.now();
  const [tagUpgrade]=await db.select({level:clanUpgrades.level}).from(clanUpgrades).where(and(eq(clanUpgrades.clanId,clanId),eq(clanUpgrades.upgradeKey,"tag_palette"))).limit(1);
  const [seasonWinner]=await db.select({rank:clanSeasonAwards.rank}).from(clanSeasonAwards).where(and(eq(clanSeasonAwards.clanId,clanId),lte(clanSeasonAwards.rank,3))).limit(1);
  const presentation=await presentationForUsers(members.map(member=>member.userId));
  const normalizedMembers=members.map(({lastSeenAt,...member})=>({...member,globalLevel:levelFromXp(member.globalXp),cosmetics:presentation.get(member.userId)?.cosmetics??{},badges:presentation.get(member.userId)?.badges??[],presence:lastSeenAt&&lastSeenAt.getTime()>now-90_000?"online":"offline"}));
  const requests=canModerateClan(role)?await db.select({
    id:clanRequests.id,userId:clanRequests.userId,kind:clanRequests.kind,status:clanRequests.status,createdAt:clanRequests.createdAt,
    username:users.username,displayName:users.displayName,avatarUrl:users.avatarUrl,globalXp:users.globalXp,
  }).from(clanRequests).innerJoin(users,eq(users.id,clanRequests.userId)).where(and(eq(clanRequests.clanId,clanId),eq(clanRequests.status,"pending"))).orderBy(desc(clanRequests.createdAt)):[];

  return NextResponse.json({clan:{...clan,level:clanLevel(clan.xp)},tagUpgradeLevel:tagUpgrade?.level??0,seasonWinner:Boolean(seasonWinner),role,members:normalizedMembers,requests:requests.map(request=>({...request,globalLevel:levelFromXp(request.globalXp)})),permissions:{moderate:canModerateClan(role),manage:canManageClan(role)}});
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
  if(body?.tagColor!==undefined){if(!validTagColor(body.tagColor))return NextResponse.json({message:"Цвет должен быть в формате #RRGGBB."},{status:400});values.tagColor=body.tagColor;}
  if(body?.tagIcon!==undefined){if(!validTagIcon(body.tagIcon))return NextResponse.json({message:"Выберите значок из списка."},{status:400});if(["orbit","moon"].includes(body.tagIcon)){const [upgrade]=await getDatabase().select({level:clanUpgrades.level}).from(clanUpgrades).where(and(eq(clanUpgrades.clanId,clanId),eq(clanUpgrades.upgradeKey,"tag_palette"))).limit(1);if((upgrade?.level??0)<(body.tagIcon==="orbit"?1:2))return NextResponse.json({message:"Этот значок открывается улучшением казны."},{status:403})}if(body.tagIcon==="laurel"){const [award]=await getDatabase().select({rank:clanSeasonAwards.rank}).from(clanSeasonAwards).where(and(eq(clanSeasonAwards.clanId,clanId),lte(clanSeasonAwards.rank,3))).limit(1);if(!award)return NextResponse.json({message:"Значок доступен призёрам сезона."},{status:403})}values.tagIcon=body.tagIcon;}
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
