import { and, count, eq, gt, lt, or, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDatabase } from "@/db/client";
import { clanMembers, clans } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { clanLevel } from "@/lib/clan-progress";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({message:"Требуется вход."},{status:401});
  const db = getDatabase();
  const url = new URL(request.url);
  const query = (url.searchParams.get("q") ?? "").trim().slice(0,64);
  const page = Math.min(1000,Math.max(1,Number(url.searchParams.get("page"))||1));
  const pattern=`%${query.replace(/[\\%_]/g,"\\$&")}%`;
  const [rows, [{total}], [mine]] = await Promise.all([
    db.execute<{id:string;name:string;tag:string;tagColor:string;tagIcon:string;xp:number;memberCount:number;avatarUrl:string|null;rank:number}>(sql`
      SELECT id,name,tag,tag_color AS "tagColor",tag_icon AS "tagIcon",xp::float8 AS xp,member_count AS "memberCount",avatar_url AS "avatarUrl",rank
      FROM (SELECT *,row_number() OVER (ORDER BY xp DESC,created_at ASC,id ASC)::int AS rank FROM clans) ranked
      WHERE ${query?sql`name ILIKE ${pattern} ESCAPE '\\' OR tag ILIKE ${pattern} ESCAPE '\\'`:sql`true`}
      ORDER BY rank LIMIT 20 OFFSET ${(page-1)*20}`),
    db.select({total:count()}).from(clans).where(query?or(sql`${clans.name} ILIKE ${pattern} ESCAPE '\\'`,sql`${clans.tag} ILIKE ${pattern} ESCAPE '\\'`):undefined),
    db.select({clanId:clanMembers.clanId}).from(clanMembers).where(eq(clanMembers.userId,user.id)).limit(1),
  ]);
  let myClan = null;
  if(mine) {
    const [clan] = await db.select().from(clans).where(eq(clans.id,mine.clanId)).limit(1);
    if(clan) {
      const [rank] = await db.select({higher:count()}).from(clans).where(or(
        gt(clans.xp,clan.xp),
        and(eq(clans.xp,clan.xp),lt(clans.createdAt,clan.createdAt)),
        and(eq(clans.xp,clan.xp),eq(clans.createdAt,clan.createdAt),lt(clans.id,clan.id)),
      ));
      myClan = {...clan,rank:rank.higher+1,level:clanLevel(clan.xp)};
    }
  }
  return NextResponse.json({rows:rows.map(row=>({...row,level:clanLevel(row.xp)})),total,page,myClan},{headers:{"Cache-Control":"private, max-age=15"}});
}
