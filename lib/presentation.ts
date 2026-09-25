import "server-only";
import { and, eq, inArray, isNotNull } from "drizzle-orm";
import { getDatabase } from "@/db/client";
import { achievementDefinitions, clanSeasonAwards, cosmeticEquipped, cosmeticItems, userAchievements } from "@/db/schema";
export type Presentation={cosmetics:Record<string,string>;badges:Array<{id:string;name:string;icon:string;rarity:string;unlockedAt:Date|null}>};
export async function presentationForUsers(userIds:string[]){
  const ids=[...new Set(userIds)];const output=new Map<string,Presentation>();if(!ids.length)return output;
  const db=getDatabase();const [items,badges,seasonBadges]=await Promise.all([
    db.select({userId:cosmeticEquipped.userId,category:cosmeticItems.category,preview:cosmeticItems.preview}).from(cosmeticEquipped).innerJoin(cosmeticItems,eq(cosmeticItems.id,cosmeticEquipped.itemId)).where(inArray(cosmeticEquipped.userId,ids)),
    db.select({userId:userAchievements.userId,id:achievementDefinitions.id,name:achievementDefinitions.name,icon:achievementDefinitions.icon,rarity:achievementDefinitions.rarity,unlockedAt:userAchievements.unlockedAt}).from(userAchievements).innerJoin(achievementDefinitions,eq(achievementDefinitions.id,userAchievements.achievementId)).where(and(inArray(userAchievements.userId,ids),eq(userAchievements.isShowcased,true),isNotNull(userAchievements.unlockedAt))),
    db.select({userId:clanSeasonAwards.userId,seasonKey:clanSeasonAwards.seasonKey,rank:clanSeasonAwards.rank,awardedAt:clanSeasonAwards.awardedAt}).from(clanSeasonAwards).where(inArray(clanSeasonAwards.userId,ids)),
  ]);
  for(const id of ids)output.set(id,{cosmetics:{},badges:[]});
  for(const item of items)output.get(item.userId)!.cosmetics[item.category]=item.preview;
  for(const badge of badges)output.get(badge.userId)!.badges.push(badge);
  for(const badge of seasonBadges)output.get(badge.userId)!.badges.push({id:`season:${badge.seasonKey}`,name:`Клан: топ-${badge.rank} сезона ${badge.seasonKey}`,icon:badge.rank<=3?"🏅":"✦",rarity:badge.rank<=3?"epic":"rare",unlockedAt:badge.awardedAt});
  return output;
}
