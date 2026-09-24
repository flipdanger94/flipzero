import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDatabase } from "@/db/client";
import { storyReactions, storyViews, userStories } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { mayViewStory } from "@/lib/story-access";
import { isTrustedMutationRequest } from "@/lib/security-controls";

type Params={params:Promise<{storyId:string}>};
export async function POST(request:Request,{params}:Params){
 if(!isTrustedMutationRequest(request))return NextResponse.json({message:"Запрос отклонён."},{status:403});
 const user=await getCurrentUser();if(!user)return NextResponse.json({message:"Требуется вход."},{status:401});
 const {storyId}=await params,db=getDatabase(),[story]=await db.select().from(userStories).where(eq(userStories.id,storyId)).limit(1);
 if(!story||!await mayViewStory(user.id,story))return NextResponse.json({message:"История недоступна."},{status:404});
 const body=await request.json().catch(()=>({}));
 if(body.action==="view"){
  await db.insert(storyViews).values({storyId,userId:user.id}).onConflictDoNothing();return NextResponse.json({ok:true});
 }
 if(body.action==="react"&&typeof body.emoji==="string"&&["❤️","🔥","😂","👏","✨","💜"].includes(body.emoji)){
  await db.insert(storyReactions).values({storyId,userId:user.id,emoji:body.emoji}).onConflictDoUpdate({target:[storyReactions.storyId,storyReactions.userId],set:{emoji:body.emoji}});return NextResponse.json({ok:true});
 }
 return NextResponse.json({message:"Неверная реакция."},{status:400});
}
export async function DELETE(request:Request,{params}:Params){
 if(!isTrustedMutationRequest(request))return NextResponse.json({message:"Запрос отклонён."},{status:403});
 const user=await getCurrentUser();if(!user)return NextResponse.json({message:"Требуется вход."},{status:401});
 const {storyId}=await params;const removed=await getDatabase().delete(userStories).where(and(eq(userStories.id,storyId),eq(userStories.userId,user.id))).returning({id:userStories.id});
 return NextResponse.json({ok:removed.length>0});
}
