import { randomUUID } from "node:crypto";
import { and, desc, eq, gte, isNull, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDatabase } from "@/db/client";
import { chatGames, messages, users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { answerHash, gameAccess } from "@/lib/chat-game";
import { GAME_CONFIG,TRIVIA } from "@/lib/chat-game-config";
import { isTrustedMutationRequest } from "@/lib/security-controls";
export async function POST(request:Request){
 if(!isTrustedMutationRequest(request))return NextResponse.json({message:"Запрос отклонён."},{status:403});
 const user=await getCurrentUser();if(!user)return NextResponse.json({message:"Требуется вход."},{status:401});
 const body=await request.json().catch(()=>null),scope=body?.scope,scopeId=String(body?.scopeId??""),kind=body?.kind;
 if(!["channel","direct","clan"].includes(scope)||!["trivia","duel","guess"].includes(kind)||!await gameAccess(user.id,scope,scopeId))return NextResponse.json({message:"Недоступный чат или игра."},{status:403});
 const db=getDatabase();const id=randomUUID();let prompt="",options:string[]=[],answer="";
 if(kind==="trivia"){const question=TRIVIA[Math.floor(Math.random()*TRIVIA.length)];prompt=question.prompt;options=[...question.options];answer=question.answer}
 if(kind==="duel"){prompt="Камень, ножницы, бумага — ваш ход!";options=["Камень","Ножницы","Бумага"]}
 if(kind==="guess"){
  if(scope!=="channel")return NextResponse.json({message:"Угадай автора доступна в каналах."},{status:400});
  const samples=await db.select({authorId:messages.authorId,content:messages.content,displayName:users.displayName}).from(messages).innerJoin(users,eq(users.id,messages.authorId)).where(and(eq(messages.channelId,scopeId),isNull(messages.deletedAt),sql`length(${messages.content}) BETWEEN 8 AND 120`)).orderBy(desc(messages.createdAt)).limit(100);
  const unique=[...new Set(samples.map(item=>item.authorId))];if(unique.length<2)return NextResponse.json({message:"Нужно хотя бы два автора с сообщениями."},{status:409});
  const sample=samples[Math.floor(Math.random()*samples.length)];prompt=`Кто написал: «${sample.content}»?`;answer=sample.authorId;options=samples.filter(item=>unique.includes(item.authorId)).reduce<string[]>((names,item)=>names.includes(item.displayName)?names:[...names,item.displayName],[]).slice(0,4);
  const correct=samples.find(item=>item.authorId===answer)?.displayName;if(correct&&!options.includes(correct))options[options.length-1]=correct;
  answer=correct??"";
 }
 const [existing]=await db.select({id:chatGames.id}).from(chatGames).where(and(eq(chatGames.creatorId,user.id),gte(chatGames.createdAt,new Date(Date.now()-30_000)))).limit(1);
 if(existing)return NextResponse.json({message:"Новая игра доступна через 30 секунд."},{status:429});
 const [game]=await db.insert(chatGames).values({id,creatorId:user.id,kind,prompt,options,answerHash:answerHash(id,answer),expiresAt:new Date(Date.now()+GAME_CONFIG.durationSeconds*1000),channelId:scope==="channel"?scopeId:null,clanId:scope==="clan"?scopeId:null,conversationId:scope==="direct"?scopeId:null}).returning();
 return NextResponse.json({game:{id:game.id,kind,prompt,options,expiresAt:game.expiresAt}},{status:201});
}
