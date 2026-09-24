import { randomUUID } from "node:crypto";
import { and, desc, eq, gt, inArray, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDatabase } from "@/db/client";
import { clanMembers, friends, mediaAssets, storyReactions, storyViews, userStories, users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { mayViewStory } from "@/lib/story-access";
import { isTrustedMutationRequest } from "@/lib/security-controls";
export async function GET(){
 const user=await getCurrentUser();if(!user)return NextResponse.json({message:"Требуется вход."},{status:401});
 const db=getDatabase(),friendRows=await db.select({id:friends.friendId}).from(friends).where(eq(friends.userId,user.id)),[member]=await db.select({clanId:clanMembers.clanId}).from(clanMembers).where(eq(clanMembers.userId,user.id)).limit(1);
 const clanRows=member?await db.select({id:clanMembers.userId}).from(clanMembers).where(eq(clanMembers.clanId,member.clanId)):[];
 const ids=[...new Set([user.id,...friendRows.map(row=>row.id),...clanRows.map(row=>row.id)])];
 const stories=await db.select({story:userStories,name:users.displayName,avatarUrl:users.avatarUrl}).from(userStories).innerJoin(users,eq(users.id,userStories.userId)).where(and(inArray(userStories.userId,ids),gt(userStories.expiresAt,new Date()))).orderBy(desc(userStories.createdAt)).limit(100);
 const visible=(await Promise.all(stories.map(async row=>await mayViewStory(user.id,row.story)?row:null))).filter((row):row is NonNullable<typeof row>=>Boolean(row));
 const storyIds=visible.map(row=>row.story.id);const [views,reactions]=await Promise.all([storyIds.length?db.select({storyId:storyViews.storyId,userId:storyViews.userId}).from(storyViews).where(inArray(storyViews.storyId,storyIds)):[],storyIds.length?db.select({storyId:storyReactions.storyId,emoji:storyReactions.emoji,userId:storyReactions.userId}).from(storyReactions).where(inArray(storyReactions.storyId,storyIds)):[]]);
 return NextResponse.json({stories:visible.map(({story,name,avatarUrl})=>({...story,hiddenUserIds:undefined,name,avatarUrl,viewCount:story.userId===user.id?views.filter(view=>view.storyId===story.id).length:undefined,viewed:views.some(view=>view.storyId===story.id&&view.userId===user.id),reactions:reactions.filter(reaction=>reaction.storyId===story.id).map(({emoji,userId})=>({emoji,userId}))}))});
}
export async function POST(request:Request){
 if(!isTrustedMutationRequest(request))return NextResponse.json({message:"Запрос отклонён."},{status:403});
 const user=await getCurrentUser();if(!user)return NextResponse.json({message:"Требуется вход."},{status:401});
 const body=await request.json().catch(()=>null),content=typeof body?.content==="string"?body.content.trim():"",emoji=typeof body?.emoji==="string"?body.emoji.trim():null,imageUrl=typeof body?.imageUrl==="string"?body.imageUrl:null,audience=body?.audience,hiddenUserIds=Array.isArray(body?.hiddenUserIds)?body.hiddenUserIds.filter((id:unknown):id is string=>typeof id==="string").slice(0,50):[];
 if(!["friends","clan","both"].includes(audience)||content.length>280||emoji&&emoji.length>12||!content&&!imageUrl&&!emoji||imageUrl&&!/^\/api\/v1\/media\/[0-9a-f-]{36}$/.test(imageUrl))return NextResponse.json({message:"Проверьте историю."},{status:400});
 const db=getDatabase();if(imageUrl){const [asset]=await db.select({id:mediaAssets.id}).from(mediaAssets).where(and(eq(mediaAssets.id,imageUrl.slice(-36)),eq(mediaAssets.ownerId,user.id),eq(mediaAssets.purpose,"story"))).limit(1);if(!asset)return NextResponse.json({message:"Изображение не найдено."},{status:400})}
 const story=await db.transaction(async tx=>{await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`story:${user.id}`}))`);const [{count}]=await tx.select({count:sql<number>`count(*)::int`}).from(userStories).where(and(eq(userStories.userId,user.id),gt(userStories.expiresAt,new Date())));if(count>=10)return null;const [created]=await tx.insert(userStories).values({id:randomUUID(),userId:user.id,content,imageUrl,emoji,audience,hiddenUserIds,expiresAt:new Date(Date.now()+86400_000)}).returning();return created});if(!story)return NextResponse.json({message:"Не более десяти активных историй."},{status:429});return NextResponse.json({story},{status:201});
}
