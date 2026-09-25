import { readFile } from "node:fs/promises";
import postgres from "postgres";

const apply = process.argv.includes("--apply");
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("[xp-reconcile] DATABASE_URL is required");
  process.exit(1);
}

const client = postgres(databaseUrl, { max: 1, prepare: false, connect_timeout: 10 });

async function snapshot() {
  const [tables] = await client`
    select
      to_regclass('public.user_progress') is not null as progress_exists,
      to_regclass('public.xp_events') is not null as events_exists
  `;
  const users = await client`select count(*)::int as count from users`;
  const events = tables.events_exists ? await client`select count(*)::int as count,coalesce(sum(amount),0)::bigint as xp from xp_events` : [{ count: 0, xp: 0 }];
  let progress = [{ count: 0, xp: 0, mismatches: 0 }];
  if (tables.progress_exists) {
    progress = await client`
      select count(*)::int as count,
             coalesce(sum(total_xp),0)::bigint as xp,
             count(*) filter (
               where level <> (
                 select max(candidate)
                 from generate_series(1,100) candidate
                 where floor(100 * power(candidate - 1,1.5)) <= total_xp
               )
             )::int as mismatches
      from user_progress
    `;
  }
  return { tables, users: users[0], events: events[0], progress: progress[0] };
}

try {
  const before = await snapshot();
  console.log("[xp-reconcile] before", JSON.stringify(before, null, 2));
  if (!apply) {
    console.log("[xp-reconcile] dry-run only. No writes performed. Re-run with --apply after backup and audit review.");
    process.exitCode = 0;
  } else {
    const sql = await readFile(new URL("../drizzle/0030_user_progress_ledger.sql", import.meta.url), "utf8");
    await client.unsafe(sql);
    const after = await snapshot();
    console.log("[xp-reconcile] after", JSON.stringify(after, null, 2));
    if (!after.tables.progress_exists) throw new Error("user_progress was not created");
    if (Number(after.progress.mismatches) !== 0) throw new Error("level reconciliation failed");
    console.log("[xp-reconcile] apply completed");
  }
} finally {
  await client.end();
}
