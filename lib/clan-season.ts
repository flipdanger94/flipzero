import "server-only";
import { and, desc, eq, isNull, lt, sql } from "drizzle-orm";
import { getDatabase } from "@/db/client";
import { clanMembers, clans, clanSeasonAwards, clanSeasonContributions, clanSeasonScores, clanUpgrades } from "@/db/schema";
import { creditCoins } from "@/lib/economy";
import { CLAN_SEASON,seasonKey } from "@/lib/clan-governance-config";
type Tx=Parameters<Parameters<ReturnType<typeof getDatabase>["transaction"]>[0]>[0];
export async function awardClanContribution(tx:Tx,userId:string,xp:number){
  if(xp<=0)return;
  const [membership]=await tx.select({clanId:clanMembers.clanId}).from(clanMembers).where(eq(clanMembers.userId,userId)).limit(1);
  if(!membership)return;
  const [upgrade]=await tx.select({level:clanUpgrades.level}).from(clanUpgrades).where(and(eq(clanUpgrades.clanId,membership.clanId),eq(clanUpgrades.upgradeKey,"xp_boost"))).limit(1);
  const amount=xp+Math.floor(xp*0.02*(upgrade?.level??0));
  await tx.update(clanMembers).set({contributionXp:sql`${clanMembers.contributionXp}+${amount}`}).where(and(eq(clanMembers.clanId,membership.clanId),eq(clanMembers.userId,userId)));
  await tx.update(clans).set({xp:sql`${clans.xp}+${amount}`}).where(eq(clans.id,membership.clanId));
  const key=seasonKey();
  await tx.insert(clanSeasonScores).values({clanId:membership.clanId,seasonKey:key,xp:amount}).onConflictDoUpdate({target:[clanSeasonScores.clanId,clanSeasonScores.seasonKey],set:{xp:sql`${clanSeasonScores.xp}+${amount}`}});
  await tx.insert(clanSeasonContributions).values({clanId:membership.clanId,userId,seasonKey:key,xp:amount}).onConflictDoUpdate({target:[clanSeasonContributions.clanId,clanSeasonContributions.userId,clanSeasonContributions.seasonKey],set:{xp:sql`${clanSeasonContributions.xp}+${amount}`}});
}
export async function removeClanSeasonContribution(tx:Tx,clanId:string,userId:string){
  const key=seasonKey();
  const [removed]=await tx.delete(clanSeasonContributions).where(and(eq(clanSeasonContributions.clanId,clanId),eq(clanSeasonContributions.userId,userId),eq(clanSeasonContributions.seasonKey,key))).returning({xp:clanSeasonContributions.xp});
  if(removed)await tx.update(clanSeasonScores).set({xp:sql`greatest(0,${clanSeasonScores.xp}-${removed.xp})`}).where(and(eq(clanSeasonScores.clanId,clanId),eq(clanSeasonScores.seasonKey,key),isNull(clanSeasonScores.closedAt)));
}
export async function settleClosedSeasons(){
  const db=getDatabase();
  const current=seasonKey();
  const pending=await db.select({seasonKey:clanSeasonScores.seasonKey}).from(clanSeasonScores).where(and(lt(clanSeasonScores.seasonKey,current),isNull(clanSeasonScores.closedAt))).groupBy(clanSeasonScores.seasonKey).limit(6);
  for(const {seasonKey:key} of pending){
    await db.transaction(async tx=>{
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`season:${key}`}))`);
      const ranks=await tx.select().from(clanSeasonScores).where(and(eq(clanSeasonScores.seasonKey,key),isNull(clanSeasonScores.closedAt))).orderBy(desc(clanSeasonScores.xp),clanSeasonScores.clanId);
      for(let index=0;index<ranks.length;index++){
        const row=ranks[index];const reward=CLAN_SEASON.rankRewards[index]??0;
        if(index<CLAN_SEASON.topBadgeCount){const contributors=await tx.select({userId:clanSeasonContributions.userId,xp:clanSeasonContributions.xp}).from(clanSeasonContributions).innerJoin(clanMembers,and(eq(clanMembers.clanId,clanSeasonContributions.clanId),eq(clanMembers.userId,clanSeasonContributions.userId))).where(and(eq(clanSeasonContributions.clanId,row.clanId),eq(clanSeasonContributions.seasonKey,key)));
          for(const contributor of contributors.filter(item=>item.xp>=CLAN_SEASON.minimumContributionXp)){
            const [award]=await tx.insert(clanSeasonAwards).values({clanId:row.clanId,userId:contributor.userId,seasonKey:key,rank:index+1,coins:reward}).onConflictDoNothing().returning({userId:clanSeasonAwards.userId});
            if(award&&reward)await creditCoins(tx,contributor.userId,reward,`Сезон ${key}: место #${index+1}`,`season:${key}:${row.clanId}`);
          }
        }
        await tx.update(clanSeasonScores).set({closedAt:new Date()}).where(and(eq(clanSeasonScores.clanId,row.clanId),eq(clanSeasonScores.seasonKey,key)));
      }
    });
  }
}
