import { and, eq } from "drizzle-orm";
import { getDatabase } from "@/db/client";
import { clanMembers, directConversationMembers } from "@/db/schema";
export async function eligible(type:string,id:string,userId:string){const db=getDatabase();if(type==="clan")return !!(await db.select({id:clanMembers.userId}).from(clanMembers).where(and(eq(clanMembers.clanId,id),eq(clanMembers.userId,userId))).limit(1))[0];if(type==="direct")return !!(await db.select({id:directConversationMembers.userId}).from(directConversationMembers).where(and(eq(directConversationMembers.conversationId,id),eq(directConversationMembers.userId,userId))).limit(1))[0];return false}
