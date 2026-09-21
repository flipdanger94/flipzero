import { and, count, desc, eq, isNull, or } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDatabase } from "@/db/client";
import { notifications, userBlocks, users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";

export async function GET(){
 const user=await getCurrentUser();if(!user)return NextResponse.json({message:"Требуется вход."},{status:401});
 const db=getDatabase();
 const blockRows=await db.select({blockerId:userBlocks.blockerId,blockedId:userBlocks.blockedId}).from(userBlocks).where(or(eq(userBlocks.blockerId,user.id),eq(userBlocks.blockedId,user.id)));
 const blockedIds=new Set(blockRows.map(row=>row.blockerId===user.id?row.blockedId:row.blockerId));
 const rows=await db.select({id:notifications.id,type:notifications.type,title:notifications.title,body:notifications.body,entityType:notifications.entityType,entityId:notifications.entityId,readAt:notifications.readAt,createdAt:notifications.createdAt,actorId:users.id,actorUsername:users.username,actorDisplayName:users.displayName,actorAvatarUrl:users.avatarUrl}).from(notifications).leftJoin(users,eq(users.id,notifications.actorId)).where(eq(notifications.userId,user.id)).orderBy(desc(notifications.createdAt)).limit(100);
 const visibleRows=rows.filter(row=>!row.actorId||!blockedIds.has(row.actorId));
 const items=visibleRows.map(({actorId,actorUsername,actorDisplayName,actorAvatarUrl,...item})=>({...item,actor:actorId&&actorUsername&&actorDisplayName?{id:actorId,username:actorUsername,displayName:actorDisplayName,avatarUrl:actorAvatarUrl}:null}));
 const unread=visibleRows.reduce((total,row)=>total+(row.readAt?0:1),0);
 return NextResponse.json({notifications:items,unread});
}
export async function PATCH(request:Request){
 const user=await getCurrentUser();if(!user)return NextResponse.json({message:"Требуется вход."},{status:401});
 const body=await request.json().catch(()=>null);const db=getDatabase();const now=new Date();
 if(body?.all===true){await db.update(notifications).set({readAt:now}).where(and(eq(notifications.userId,user.id),isNull(notifications.readAt)));return NextResponse.json({ok:true});}
 const id=String(body?.id??"");if(!id)return NextResponse.json({message:"Укажите уведомление."},{status:400});
 await db.update(notifications).set({readAt:now}).where(and(eq(notifications.id,id),eq(notifications.userId,user.id)));return NextResponse.json({ok:true});
}
