import { and, desc, eq, gt, lt, or } from "drizzle-orm";
import { AccessToken, TrackSource } from "livekit-server-sdk";
import { NextResponse } from "next/server";
import { getDatabase } from "@/db/client";
import { directCallSessions, users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { isTrustedMutationRequest } from "@/lib/security-controls";

function livekit(){
  const url=process.env.LIVEKIT_URL,key=process.env.LIVEKIT_API_KEY,secret=process.env.LIVEKIT_API_SECRET;
  return url&&key&&secret?{url,key,secret}:null;
}

export async function GET(request:Request){
  const user=await getCurrentUser();
  if(!user)return NextResponse.json({message:"Требуется вход."},{status:401});
  const db=getDatabase(),now=new Date();

  await db.update(directCallSessions).set({status:"missed",endedAt:now})
    .where(and(eq(directCallSessions.status,"ringing"),lt(directCallSessions.expiresAt,now)));

  const callId=new URL(request.url).searchParams.get("callId");
  if(callId){
    const [call]=await db.select().from(directCallSessions).where(and(
      eq(directCallSessions.id,callId),
      or(eq(directCallSessions.callerId,user.id),eq(directCallSessions.receiverId,user.id)),
    )).limit(1);
    if(!call)return NextResponse.json({call:null});
    return NextResponse.json({call:{id:call.id,status:call.status,video:call.video,expiresAt:call.expiresAt,role:call.callerId===user.id?"caller":"receiver"}});
  }

  const [row]=await db.select({
    id:directCallSessions.id,
    callerId:directCallSessions.callerId,
    video:directCallSessions.video,
    expiresAt:directCallSessions.expiresAt,
    displayName:users.displayName,
    avatarUrl:users.avatarUrl,
  }).from(directCallSessions)
    .innerJoin(users,eq(users.id,directCallSessions.callerId))
    .where(and(eq(directCallSessions.receiverId,user.id),eq(directCallSessions.status,"ringing"),gt(directCallSessions.expiresAt,now)))
    .orderBy(desc(directCallSessions.createdAt)).limit(1);

  return NextResponse.json({call:row??null});
}

export async function POST(request:Request){
  if(!isTrustedMutationRequest(request))return NextResponse.json({message:"Запрос отклонён."},{status:403});
  const user=await getCurrentUser();
  if(!user)return NextResponse.json({message:"Требуется вход."},{status:401});
  const body=await request.json().catch(()=>null),callId=String(body?.callId??""),action=String(body?.action??"");
  if(!callId||!["accept","decline","cancel","end"].includes(action))return NextResponse.json({message:"Некорректное действие."},{status:400});

  const db=getDatabase();
  const [call]=await db.select().from(directCallSessions).where(and(
    eq(directCallSessions.id,callId),
    or(eq(directCallSessions.callerId,user.id),eq(directCallSessions.receiverId,user.id)),
  )).limit(1);
  if(!call)return NextResponse.json({message:"Звонок не найден."},{status:404});

  if(action==="cancel"){
    if(call.callerId!==user.id||call.status!=="ringing")return NextResponse.json({message:"Звонок уже изменился."},{status:409});
    await db.update(directCallSessions).set({status:"cancelled",endedAt:new Date()}).where(eq(directCallSessions.id,callId));
    return NextResponse.json({ok:true,status:"cancelled"});
  }
  if(action==="decline"){
    if(call.receiverId!==user.id||call.status!=="ringing")return NextResponse.json({message:"Звонок уже изменился."},{status:409});
    await db.update(directCallSessions).set({status:"declined",endedAt:new Date()}).where(eq(directCallSessions.id,callId));
    return NextResponse.json({ok:true,status:"declined"});
  }
  if(action==="end"){
    await db.update(directCallSessions).set({status:"ended",endedAt:new Date()}).where(eq(directCallSessions.id,callId));
    return NextResponse.json({ok:true,status:"ended"});
  }

  if(call.receiverId!==user.id||call.status!=="ringing"||call.expiresAt<=new Date())return NextResponse.json({message:"Звонок уже недоступен."},{status:409});
  const lk=livekit();if(!lk)return NextResponse.json({message:"Сервис звонков пока не настроен."},{status:503});
  const token=new AccessToken(lk.key,lk.secret,{identity:user.id,name:user.displayName,ttl:"2m",metadata:JSON.stringify({directCall:true,callerId:call.callerId,callId})});
  token.addGrant({roomJoin:true,room:call.roomName,canPublish:true,canPublishSources:call.video?[TrackSource.MICROPHONE,TrackSource.CAMERA]:[TrackSource.MICROPHONE],canSubscribe:true});
  await db.update(directCallSessions).set({status:"accepted",answeredAt:new Date()}).where(eq(directCallSessions.id,callId));
  const [caller]=await db.select({id:users.id,displayName:users.displayName,avatarUrl:users.avatarUrl}).from(users).where(eq(users.id,call.callerId)).limit(1);
  return NextResponse.json({ok:true,status:"accepted",token:await token.toJwt(),url:lk.url,room:call.roomName,video:call.video,callId,person:caller});
}
