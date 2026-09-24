import "server-only";
import { and, eq } from "drizzle-orm";
import { getDatabase } from "@/db/client";
import { clanMembers, friends, userStories } from "@/db/schema";
export async function mayViewStory(viewerId:string,story:typeof userStories.$inferSelect){
 if(story.expiresAt<=new Date()||story.hiddenUserIds.includes(viewerId))return false;
 if(story.userId===viewerId)return true;
 const db=getDatabase();
 if(story.audience==="friends"||story.audience==="both"){
  const [friend]=await db.select({userId:friends.userId}).from(friends).where(and(eq(friends.userId,viewerId),eq(friends.friendId,story.userId))).limit(1);
  if(friend)return true;
 }
 if(story.audience==="clan"||story.audience==="both"){
  const [owner]=await db.select({clanId:clanMembers.clanId}).from(clanMembers).where(eq(clanMembers.userId,story.userId)).limit(1);
  if(owner){const [viewer]=await db.select({userId:clanMembers.userId}).from(clanMembers).where(and(eq(clanMembers.userId,viewerId),eq(clanMembers.clanId,owner.clanId))).limit(1);if(viewer)return true}
 }
 return false;
}
