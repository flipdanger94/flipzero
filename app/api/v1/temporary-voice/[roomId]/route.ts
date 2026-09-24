import { AccessToken } from "livekit-server-sdk";
import { and, eq, gt } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDatabase } from "@/db/client";
import { temporaryVoiceRooms } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { eligible } from "@/lib/temporary-voice-access";
import { isTrustedMutationRequest } from "@/lib/security-controls";
type Params={params:Promise<{roomId:string}>};
export async function POST(request:Request,{params}:Params){if(!isTrustedMutationRequest(request))return NextResponse.json({message:"Запрос отклонён."},{status:403});const user=await getCurrentUser();if(!user)return NextResponse.json({message:"Требуется вход."},{status:401});const {roomId}=await params,[room]=await getDatabase().select().from(temporaryVoiceRooms).where(and(eq(temporaryVoiceRooms.id,roomId),gt(temporaryVoiceRooms.expiresAt,new Date()))).limit(1);if(!room||!await eligible(room.contextType,room.contextId,user.id))return NextResponse.json({message:"Комната недоступна."},{status:404});const url=process.env.LIVEKIT_URL,key=process.env.LIVEKIT_API_KEY,secret=process.env.LIVEKIT_API_SECRET;if(!url||!key||!secret)return NextResponse.json({message:"Голосовой сервер не настроен."},{status:503});const token=new AccessToken(key,secret,{identity:user.id,name:user.displayName,ttl:"2h"});token.addGrant({roomJoin:true,room:`temporary:${room.id}`,canPublish:true,canSubscribe:true});return NextResponse.json({url,token:await token.toJwt(),expiresAt:room.expiresAt})}
export async function DELETE(request:Request,{params}:Params){if(!isTrustedMutationRequest(request))return NextResponse.json({message:"Запрос отклонён."},{status:403});const user=await getCurrentUser();if(!user)return NextResponse.json({message:"Требуется вход."},{status:401});const {roomId}=await params;await getDatabase().delete(temporaryVoiceRooms).where(and(eq(temporaryVoiceRooms.id,roomId),eq(temporaryVoiceRooms.creatorId,user.id)));return NextResponse.json({ok:true})}
