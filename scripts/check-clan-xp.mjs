import postgres from "postgres";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
const db=postgres(process.env.DATABASE_URL,{max:1,prepare:false});
try {
  await db.begin(async tx=>{
    if(process.argv.includes("--repair")) {
      await tx.unsafe("LOCK TABLE clan_members, clans IN SHARE ROW EXCLUSIVE MODE");
      await tx.unsafe("UPDATE clans c SET xp = COALESCE((SELECT SUM(m.contribution_xp) FROM clan_members m WHERE m.clan_id=c.id),0) WHERE c.xp <> COALESCE((SELECT SUM(m.contribution_xp) FROM clan_members m WHERE m.clan_id=c.id),0)");
    }
    const mismatch=await tx.unsafe("SELECT c.id,c.xp,COALESCE(SUM(m.contribution_xp),0)::bigint AS actual FROM clans c LEFT JOIN clan_members m ON m.clan_id=c.id GROUP BY c.id,c.xp HAVING c.xp <> COALESCE(SUM(m.contribution_xp),0) LIMIT 50");
    console.log(`[clans] ${mismatch.length} XP mismatches`);
    if(mismatch.length)process.exitCode=1;
  });
} finally {await db.end()}
