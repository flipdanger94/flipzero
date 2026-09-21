import { and, eq, or } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDatabase } from "@/db/client";
import { friendRequests, friends, notifications, userBlocks, users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  const user=await getCurrentUser(); if(!user)return NextResponse.json({message:"Требуется вход."},{status:401});
  const db=getDatabase(); const rows=await db.select({id:users.id,username:users.username,displayName:users.displayName,avatarUrl:users.avatarUrl,createdAt:userBlocks.createdAt}).from(userBlocks).innerJoin(users,eq(users.id,userBlocks.blockedId)).where(eq(userBlocks.blockerId,user.id));
  return NextResponse.json({blocked:rows});
}
export async function POST(request:Request){
  const user=await getCurrentUser(); if(!user)return NextResponse.json({message:"Требуется вход."},{status:401});
  const body=await request.json().catch(()=>null); const blockedId=String(body?.userId??""); if(!blockedId||blockedId===user.id)return NextResponse.json({message:"Некорректный пользователь."},{status:400});
  const db=getDatabase(); const [target]=await db.select({id:users.id}).from(users).where(eq(users.id,blockedId)).limit(1); if(!target)return NextResponse.json({message:"Пользователь не найден."},{status:404});
  await db.transaction(async tx=>{await tx.insert(userBlocks).values({blockerId:user.id,blockedId}).onConflictDoNothing();await tx.delete(friends).where(or(and(eq(friends.userId,user.id),eq(friends.friendId,blockedId)),and(eq(friends.userId,blockedId),eq(friends.friendId,user.id))));await tx.delete(friendRequests).where(or(and(eq(friendRequests.fromId,user.id),eq(friendRequests.toId,blockedId)),and(eq(friendRequests.fromId,blockedId),eq(friendRequests.toId,user.id))));await tx.delete(notifications).where(and(eq(notifications.userId,user.id),eq(notifications.actorId,blockedId)));});
  return NextResponse.json({ok:true});
}
export async function DELETE(request:Request){
  const user=await getCurrentUser(); if(!user)return NextResponse.json({message:"Требуется вход."},{status:401});
  const blockedId=new URL(request.url).searchParams.get("userId")??""; if(!blockedId)return NextResponse.json({message:"Укажите пользователя."},{status:400});
  await getDatabase().delete(userBlocks).where(and(eq(userBlocks.blockerId,user.id),eq(userBlocks.blockedId,blockedId))); return NextResponse.json({ok:true});
}
