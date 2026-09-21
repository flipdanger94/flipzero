import { and, eq, ilike, ne, notInArray, or } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDatabase } from "@/db/client";
import { userBlocks, userPrivacySettings, users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";

export async function GET(request: Request) {
  const viewer=await getCurrentUser();
  if(!viewer)return NextResponse.json({message:"Требуется вход."},{status:401});
  const query=new URL(request.url).searchParams.get("q")?.trim().slice(0,64)??"";
  if(query.length<2)return NextResponse.json({users:[]});
  const db=getDatabase();
  const blocks=await db.select({blockerId:userBlocks.blockerId,blockedId:userBlocks.blockedId}).from(userBlocks).where(or(eq(userBlocks.blockerId,viewer.id),eq(userBlocks.blockedId,viewer.id)));
  const excluded=new Set<string>([viewer.id]);
  blocks.forEach(row=>excluded.add(row.blockerId===viewer.id?row.blockedId:row.blockerId));
  const rows=await db.select({id:users.id,username:users.username,displayName:users.displayName,avatarUrl:users.avatarUrl,presence:users.presence,profileStatus:users.profileStatus,profileDiscovery:userPrivacySettings.profileDiscovery})
    .from(users).leftJoin(userPrivacySettings,eq(userPrivacySettings.userId,users.id))
    .where(and(ne(users.id,viewer.id),or(ilike(users.username,`%${query}%`),ilike(users.displayName,`%${query}%`)),excluded.size?notInArray(users.id,[...excluded]):undefined))
    .limit(30);
  return NextResponse.json({users:rows.filter(row=>row.profileDiscovery!==false).map(({profileDiscovery,...user})=>user)});
}
