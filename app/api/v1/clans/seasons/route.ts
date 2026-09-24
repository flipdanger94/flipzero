import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDatabase } from "@/db/client";
import { clanMembers, clans, clanSeasonAwards, clanSeasonScores } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { settleClosedSeasons } from "@/lib/clan-season";
import { CLAN_SEASON,seasonEndsAt,seasonKey } from "@/lib/clan-governance-config";
export async function GET(request:Request){
 const user=await getCurrentUser();if(!user)return NextResponse.json({message:"Требуется вход."},{status:401});
 await settleClosedSeasons();
 const db=getDatabase(),key=new URL(request.url).searchParams.get("season")??seasonKey();
 if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(key))return NextResponse.json({message:"Неверный сезон."},{status:400});
 const [rows,history,[membership]]=await Promise.all([
  db.select({clanId:clans.id,name:clans.name,tag:clans.tag,color:clans.tagColor,icon:clans.tagIcon,xp:clanSeasonScores.xp}).from(clanSeasonScores).innerJoin(clans,eq(clans.id,clanSeasonScores.clanId)).where(eq(clanSeasonScores.seasonKey,key)).orderBy(desc(clanSeasonScores.xp),clanSeasonScores.clanId).limit(100),
  db.select({seasonKey:clanSeasonAwards.seasonKey,rank:clanSeasonAwards.rank,coins:clanSeasonAwards.coins,clanId:clanSeasonAwards.clanId}).from(clanSeasonAwards).where(eq(clanSeasonAwards.userId,user.id)).orderBy(desc(clanSeasonAwards.seasonKey)).limit(12),
  db.select({clanId:clanMembers.clanId}).from(clanMembers).where(eq(clanMembers.userId,user.id)).limit(1),
 ]);
 const ranked=rows.map((row,index)=>({...row,rank:index+1,isOwn:row.clanId===membership?.clanId}));
 return NextResponse.json({season:key,current:seasonKey()===key,endsAt:seasonEndsAt(new Date(`${key}-01T00:00:00Z`)).toISOString(),rows:ranked,myRank:ranked.find(row=>row.isOwn)??null,history,rewards:CLAN_SEASON.rankRewards,minimumContributionXp:CLAN_SEASON.minimumContributionXp});
}
