import { inArray, eq } from "drizzle-orm";
import { getDatabase } from "@/db/client";
import { clanMembers, clans } from "@/db/schema";

export async function clanTagsForUsers(userIds: string[]) {
  if(!userIds.length)return new Map<string,{id:string;name:string;tag:string;tagColor:string;tagIcon:string}>();
  const rows=await getDatabase().select({userId:clanMembers.userId,id:clans.id,name:clans.name,tag:clans.tag,tagColor:clans.tagColor,tagIcon:clans.tagIcon})
    .from(clanMembers).innerJoin(clans,eq(clans.id,clanMembers.clanId)).where(inArray(clanMembers.userId,[...new Set(userIds)]));
  return new Map(rows.map(({userId,...clan})=>[userId,clan]));
}
