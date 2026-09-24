import "server-only";
import { createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { getDatabase } from "@/db/client";
import { channels, directConversationMembers, members } from "@/db/schema";
import { getClanRole } from "@/lib/clans";
export const answerHash=(id:string,answer:string)=>createHash("sha256").update(`${id}:${answer.trim().toLowerCase()}`).digest("hex");
export async function gameAccess(userId:string,scope:"channel"|"clan"|"direct",scopeId:string){
 const db=getDatabase();if(scope==="clan")return Boolean(await getClanRole(userId,scopeId));
 if(scope==="direct"){const [member]=await db.select({userId:directConversationMembers.userId}).from(directConversationMembers).where(and(eq(directConversationMembers.conversationId,scopeId),eq(directConversationMembers.userId,userId))).limit(1);return Boolean(member)}
 const [member]=await db.select({userId:members.userId}).from(channels).innerJoin(members,eq(members.spaceId,channels.spaceId)).where(and(eq(channels.id,scopeId),eq(members.userId,userId))).limit(1);return Boolean(member);
}
