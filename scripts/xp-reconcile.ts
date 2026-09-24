import { readFile } from "node:fs/promises";
import postgres from "postgres";

const apply = process.argv.includes("--apply");
const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is required.");
  process.exit(1);
}

const db = postgres(url, { max: 1, prepare: false, idle_timeout: 10, connect_timeout: 10 });

async function summary() {
  const [progressTable] = await db.unsafe<{ name: string | null }[]>("select to_regclass('public.user_progress')::text as name");
  const [usersCount] = await db.unsafe<{ count: number }[]>("select count(*)::int as count from users");
  const [eventsCount] = await db.unsafe<{ count: number }[]>("select count(*)::int as count from xp_events");
  const [negativeEvents] = await db.unsafe<{ count: number }[]>("select count(*)::int as count from xp_events where amount < 0");
  return {
    users: usersCount?.count ?? 0,
    xpEvents: eventsCount?.count ?? 0,
    negativeEvents: negativeEvents?.count ?? 0,
    userProgressExists: Boolean(progressTable?.name),
  };
}

async function main() {
  console.log(JSON.stringify({ mode: apply ? "apply" : "dry-run", before: await summary() }, null, 2));
  if (!apply) {
    console.log("Dry-run only. Re-run with --apply only after taking and verifying a database backup.");
    return;
  }

  const migration = await readFile(new URL("../drizzle/0030_user_progress.sql", import.meta.url), "utf8");
  const body = migration.replace(/^\s*BEGIN;\s*/i, "").replace(/\s*COMMIT;\s*$/i, "");
  await db.begin(async (tx) => {
    await tx.unsafe(body);
  });

  console.log(JSON.stringify({ mode: "apply", after: await summary() }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : error);
  process.exitCode = 1;
}).finally(() => db.end());
