import { randomUUID } from "node:crypto";
import { and, eq, gte, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDatabase } from "@/db/client";
import { chatGamePlays, chatGames, users, xpEvents } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { answerHash, gameAccess } from "@/lib/chat-game";
import { GAME_CONFIG } from "@/lib/chat-game-config";
import { awardClanContribution } from "@/lib/clan-season";
import { creditCoins } from "@/lib/economy";
import { levelFromXp } from "@/lib/gamification";
import { getSuperFlipCapabilities } from "@/lib/superflip";
import { isTrustedMutationRequest } from "@/lib/security-controls";
async function authorized(userId:string,gameId:string){const [game]=await getDatabase().select().from(chatGames).where(eq(chatGames.id,gameId)).limit(1);if(!game)return null;const scope=game.clanId?"clan":game.channelId?"channel":"direct",scopeId=game.clanId??game.channelId??game.conversationId??"";return await gameAccess(userId,scope,scopeId)?game:null}
export async function GET(_:Request,{params}:{params:Promise<{gameId:string}>}){
 const user=await getCurrentUser();if(!user)return NextResponse.json({message:"Требуется вход."},{status:401});
 const {gameId}=await params,game=await authorized(user.id,gameId);if(!game)return NextResponse.json({message:"Игра недоступна."},{status:404});
 const plays=await getDatabase().select({userId:chatGamePlays.userId,displayName:users.displayName,answer:chatGamePlays.answer,correct:chatGamePlays.correct}).from(chatGamePlays).innerJoin(users,eq(users.id,chatGamePlays.userId)).where(eq(chatGamePlays.gameId,gameId));
 const done=Boolean(game.settledAt||game.expiresAt<=new Date());return NextResponse.json({game:{id:game.id,kind:game.kind,prompt:game.prompt,options:game.options,expiresAt:game.expiresAt,creatorId:game.creatorId,winnerId:game.winnerId,done,plays:plays.map(play=>({userId:play.userId,displayName:play.displayName,...(done?{answer:play.answer,correct:play.correct}:{})}))}});
}
export async function POST(request:Request,{params}:{params:Promise<{gameId:string}>}){
 if(!isTrustedMutationRequest(request))return NextResponse.json({message:"Запрос отклонён."},{status:403});
 const user=await getCurrentUser();if(!user)return NextResponse.json({message:"Требуется вход."},{status:401});
 const {gameId}=await params,game=await authorized(user.id,gameId);if(!game)return NextResponse.json({message:"Игра недоступна."},{status:404});
 const body=await request.json().catch(()=>null),answer=String(body?.answer??"").trim();if(!game.options.includes(answer))return NextResponse.json({message:"Выберите вариант ответа."},{status:400});
 const db=getDatabase();
 const result=await db.transaction(async tx=>{
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`game:${gameId}`}))`);
  const [fresh]=await tx.select().from(chatGames).where(eq(chatGames.id,gameId)).limit(1);
  if(!fresh||fresh.settledAt||fresh.expiresAt<=new Date())return "ended";
  const prior=await tx.select().from(chatGamePlays).where(eq(chatGamePlays.gameId,gameId));if(prior.some(play=>play.userId===user.id))return "played";
  if(fresh.kind==="duel"&&prior.length>=2)return "ended";
  const correct=fresh.kind!=="duel"&&answerHash(gameId,answer)===fresh.answerHash;
  await tx.insert(chatGamePlays).values({gameId,userId:user.id,answer,correct});
  let winnerId:string|null=correct?user.id:null;
  if(fresh.kind==="duel"&&prior.length===1){const first=prior[0],moves=["Камень","Ножницы","Бумага"],firstIndex=moves.indexOf(first.answer),secondIndex=moves.indexOf(answer);winnerId=firstIndex===secondIndex?null:(firstIndex+1)%3===secondIndex?first.userId:user.id}
  if(correct||fresh.kind==="duel"&&prior.length===1){await tx.update(chatGames).set({winnerId,settledAt:new Date(),opponentId:fresh.kind==="duel"?user.id:null}).where(eq(chatGames.id,gameId))}
  if(!winnerId)return "ok";
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`game-wins:${winnerId}`}))`);
  const day=new Date();day.setUTCHours(0,0,0,0);const [wins]=await tx.select({count:sql<number>`count(*)::int`}).from(xpEvents).where(and(eq(xpEvents.userId,winnerId),eq(xpEvents.source,"game_win"),gte(xpEvents.createdAt,day)));
  if((wins?.count??0)>=GAME_CONFIG.dailyWinLimit)return "limit";
  const superflip=await getSuperFlipCapabilities(winnerId);
  const xp=Math.round(GAME_CONFIG.winXp*(superflip.active?1.2:1)),coins=Math.round(GAME_CONFIG.winCoins*(superflip.active?1.2:1));
  const [inserted]=await tx.insert(xpEvents).values({id:randomUUID(),userId:winnerId,source:"game_win",amount:xp,idempotencyKey:`game_win:${gameId}:${winnerId}`}).onConflictDoNothing().returning({id:xpEvents.id});
  if(inserted){const [updated]=await tx.update(users).set({globalXp:sql`${users.globalXp}+${xp}`}).where(eq(users.id,winnerId)).returning({xp:users.globalXp});await tx.update(users).set({globalLevel:levelFromXp(updated.xp)}).where(eq(users.id,winnerId));await awardClanContribution(tx,winnerId,xp);await creditCoins(tx,winnerId,coins,"Победа в мини-игре",`game:${gameId}`)}
  return "win";
 });return result==="ended"||result==="played"?NextResponse.json({message:result==="ended"?"Игра завершена.":"Ход уже сделан."},{status:409}):NextResponse.json({ok:true,result});
}
