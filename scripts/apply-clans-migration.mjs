import { readFile } from "node:fs/promises";
import postgres from "postgres";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("[clans] DATABASE_URL is required to apply the clans migration");
  process.exit(1);
}

const client = postgres(databaseUrl, { max: 1, prepare: false, connect_timeout: 10 });
try {
  const sql = await readFile(new URL("../drizzle/0019_clans.sql", import.meta.url), "utf8");
  await client.unsafe(sql);
  const [result] = await client`SELECT to_regclass('public.clan_members') IS NOT NULL AS applied`;
  if (!result.applied) throw new Error("clan_members table was not created");
  console.log("[clans] schema ready");
} finally {
  await client.end();
}
