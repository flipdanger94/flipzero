import { AccessToken } from "livekit-server-sdk";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getClanRole } from "@/lib/clans";
import { isTrustedMutationRequest } from "@/lib/security-controls";
export async function POST(request:Request,{params}:{params:Promise<{clanId:string}>}){
 if(!isTrustedMutationRequest(request))return NextResponse.json({message:"Запрос отклонён."},{status:403});
 const user=await getCurrentUser(),{clanId}=await params;if(!user||!await getClanRole(user.id,clanId))return NextResponse.json({message:"Голосовой канал только для участников клана."},{status:403});
 const url=process.env.LIVEKIT_URL,key=process.env.LIVEKIT_API_KEY,secret=process.env.LIVEKIT_API_SECRET;
 if(!url||!key||!secret)return NextResponse.json({message:"Голосовой сервер не настроен."},{status:503});
 const token=new AccessToken(key,secret,{identity:user.id,name:user.displayName,ttl:"2h",metadata:JSON.stringify({clanId})});
 token.addGrant({roomJoin:true,room:`clan:${clanId}`,canPublish:true,canSubscribe:true});
 return NextResponse.json({url,token:await token.toJwt(),room:`clan:${clanId}`});
}
