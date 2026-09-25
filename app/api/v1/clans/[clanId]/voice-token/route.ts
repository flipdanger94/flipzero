import { eq } from "drizzle-orm";
import { AccessToken, TrackSource } from "livekit-server-sdk";
import { NextResponse } from "next/server";
import { getDatabase } from "@/db/client";
import { clanMembers, clans, users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { getClanRole } from "@/lib/clans";
import { isTrustedMutationRequest } from "@/lib/security-controls";

export async function POST(request:Request,{params}:{params:Promise<{clanId:string}>}){
  if(!isTrustedMutationRequest(request))return NextResponse.json({message:"Запрос отклонён."},{status:403});
  const user=await getCurrentUser(),{clanId}=await params;
  if(!user||!await getClanRole(user.id,clanId))return NextResponse.json({message:"Голосовой канал только для участников клана."},{status:403});

  const url=process.env.LIVEKIT_URL,key=process.env.LIVEKIT_API_KEY,secret=process.env.LIVEKIT_API_SECRET;
  if(!url||!key||!secret)return NextResponse.json({message:"Голосовой сервер не настроен."},{status:503});

  const db=getDatabase();
  const [profile]=await db.select({
    avatarUrl:users.avatarUrl,
    accentColor:users.accentColor,
    clanTag:clans.tag,
    clanTagColor:clans.tagColor,
  }).from(users)
    .leftJoin(clanMembers,eq(clanMembers.userId,users.id))
    .leftJoin(clans,eq(clans.id,clanMembers.clanId))
    .where(eq(users.id,user.id)).limit(1);

  const token=new AccessToken(key,secret,{
    identity:user.id,
    name:user.displayName,
    ttl:"20m",
    metadata:JSON.stringify({
      clanId,
      username:user.username,
      avatarUrl:profile?.avatarUrl??null,
      accentColor:profile?.accentColor??null,
      clanTag:profile?.clanTag??null,
      clanTagColor:profile?.clanTagColor??null,
    }),
  });
  token.addGrant({
    roomJoin:true,
    room:`clan:${clanId}`,
    canPublish:true,
    canPublishSources:[TrackSource.MICROPHONE,TrackSource.CAMERA,TrackSource.SCREEN_SHARE,TrackSource.SCREEN_SHARE_AUDIO],
    canSubscribe:true,
    canUpdateOwnMetadata:true,
  });
  return NextResponse.json({url,token:await token.toJwt(),room:`clan:${clanId}`,expiresInSeconds:1200});
}
