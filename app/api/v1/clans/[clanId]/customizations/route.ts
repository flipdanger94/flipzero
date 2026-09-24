import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDatabase } from "@/db/client";
import { clanMembers, clanUpgrades, clans } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { getClanRole } from "@/lib/clans";
import { isTrustedMutationRequest } from "@/lib/security-controls";
export async function GET(_:Request,{params}:{params:Promise<{clanId:string}>}){
 const user=await getCurrentUser(),{clanId}=await params;if(!user||!await getClanRole(user.id,clanId))return NextResponse.json({message:"Нет доступа."},{status:403});
 const db=getDatabase();const [[clan],roles]=await Promise.all([db.select({customRoles:clans.customRoles,customEmoji:clans.customEmoji,bannerTheme:clans.bannerTheme}).from(clans).where(eq(clans.id,clanId)).limit(1),db.select({userId:clanMembers.userId,customRoleId:clanMembers.customRoleId}).from(clanMembers).where(eq(clanMembers.clanId,clanId))]);return NextResponse.json({...clan,memberRoles:roles});
}
export async function PATCH(request:Request,{params}:{params:Promise<{clanId:string}>}){
 if(!isTrustedMutationRequest(request))return NextResponse.json({message:"Запрос отклонён."},{status:403});
 const user=await getCurrentUser(),{clanId}=await params;if(!user||await getClanRole(user.id,clanId)!=="leader")return NextResponse.json({message:"Только лидер может менять оформление клана."},{status:403});
 const db=getDatabase(),body=await request.json().catch(()=>null),type=body?.action;
 const upgradeKey=type==="role"||type==="assign_role"?"custom_roles":type==="emoji"?"clan_emoji":"clan_banner";
 const [upgrade]=await db.select({level:clanUpgrades.level}).from(clanUpgrades).where(and(eq(clanUpgrades.clanId,clanId),eq(clanUpgrades.upgradeKey,upgradeKey))).limit(1);
 if(!upgrade?.level)return NextResponse.json({message:"Сначала откройте улучшение казны."},{status:403});
 const [clan]=await db.select({customRoles:clans.customRoles,customEmoji:clans.customEmoji}).from(clans).where(eq(clans.id,clanId)).limit(1);
 if(!clan)return NextResponse.json({message:"Клан не найден."},{status:404});
 if(type==="role"){
  const name=typeof body?.name==="string"?body.name.trim():"",color=body?.color;
  if(name.length<2||name.length>24||!/^#[0-9a-fA-F]{6}$/.test(color))return NextResponse.json({message:"Укажите имя и цвет роли."},{status:400});
  const role={id:randomUUID(),name,color};const created=await db.transaction(async tx=>{await tx.execute(sql`select 1 from clans where id=${clanId} for update`);const [fresh]=await tx.select({customRoles:clans.customRoles}).from(clans).where(eq(clans.id,clanId));if(fresh.customRoles.length>=upgrade.level*2)return false;await tx.update(clans).set({customRoles:[...fresh.customRoles,role]}).where(eq(clans.id,clanId));return true});return created?NextResponse.json({role}):NextResponse.json({message:"Лимит ролей достигнут."},{status:409});
 }
 if(type==="assign_role"){
  const roleId=String(body?.roleId??""),userId=String(body?.userId??"");
  if(roleId&&!clan.customRoles.some(role=>role.id===roleId))return NextResponse.json({message:"Роль не найдена."},{status:404});
  const [member]=await db.update(clanMembers).set({customRoleId:roleId||null}).where(and(eq(clanMembers.clanId,clanId),eq(clanMembers.userId,userId))).returning({userId:clanMembers.userId});return member?NextResponse.json({ok:true}):NextResponse.json({message:"Участник не найден."},{status:404});
 }
 if(type==="emoji"){
  const emoji=typeof body?.emoji==="string"?body.emoji.trim():"";
  if(!emoji||emoji.length>12||/[<>]/.test(emoji))return NextResponse.json({message:"Неверный эмодзи."},{status:400});
  const created=await db.transaction(async tx=>{await tx.execute(sql`select 1 from clans where id=${clanId} for update`);const [fresh]=await tx.select({customEmoji:clans.customEmoji}).from(clans).where(eq(clans.id,clanId));const list=[...new Set([...fresh.customEmoji,emoji])];if(list.length>upgrade.level*5)return false;await tx.update(clans).set({customEmoji:list}).where(eq(clans.id,clanId));return true});return created?NextResponse.json({emoji}):NextResponse.json({message:"Лимит эмодзи достигнут."},{status:409});
 }
 if(type==="banner"){
  const theme=String(body?.theme??"");if(!["default","nebula","constellation"].includes(theme)||theme==="constellation"&&upgrade.level<2)return NextResponse.json({message:"Этот баннер пока закрыт."},{status:403});
  await db.update(clans).set({bannerTheme:theme}).where(eq(clans.id,clanId));return NextResponse.json({theme});
 }
 return NextResponse.json({message:"Неизвестное действие."},{status:400});
}
