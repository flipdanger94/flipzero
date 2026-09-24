import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is required.");
  process.exit(1);
}

const db = postgres(url, { max: 1, prepare: false, idle_timeout: 10, connect_timeout: 10 });
const q = <T = Record<string, unknown>>(query: string) => db.unsafe<T[]>(query);

async function main() {
  const [progressTable] = await q<{ name: string | null }>("select to_regclass('public.user_progress')::text as name");
  const [archiveTable] = await q<{ name: string | null }>("select to_regclass('public.xp_events_duplicates_archive')::text as name");

  const report: Record<string, unknown> = {
    generatedAt: new Date().toISOString(),
    mode: "read-only",
    userProgressTable: Boolean(progressTable?.name),
    duplicatesArchiveTable: Boolean(archiveTable?.name),
  };

  const [negativeUsers] = await q<{ count: number }>("select count(*)::int as count from users where global_xp < 0 or global_level < 1 or global_level > 100");
  const [negativeEvents] = await q<{ count: number }>("select count(*)::int as count from xp_events where amount < 0");
  const [orphanEvents] = await q<{ count: number }>("select count(*)::int as count from xp_events e left join users u on u.id=e.user_id where u.id is null");

  const hasDedupe = await q<{ exists: boolean }>("select exists(select 1 from information_schema.columns where table_name='xp_events' and column_name='dedupe_key') as exists");
  const eventKey = hasDedupe[0]?.exists ? "coalesce(dedupe_key,idempotency_key)" : "idempotency_key";
  const duplicateEvents = await q(
    "select user_id, source, " + eventKey + " as event_key, count(*)::int as count, min(created_at) as first_created_at " +
    "from xp_events group by user_id, source, " + eventKey + " having count(*)>1 order by count(*) desc,user_id limit 250"
  );

  Object.assign(report, {
    usersWithNegativeOrInvalidProgress: negativeUsers?.count ?? 0,
    negativeXpEvents: negativeEvents?.count ?? 0,
    orphanXpEvents: orphanEvents?.count ?? 0,
    duplicateXpEvents: duplicateEvents,
  });

  if (progressTable?.name) {
    const duplicateProgress = await q("select user_id,count(*)::int as count from user_progress group by user_id having count(*)>1 order by count(*) desc limit 250");
    const missingProgress = await q("select u.id as user_id from users u left join user_progress p on p.user_id=u.id where p.user_id is null order by u.id limit 250");
    const orphanProgress = await q("select p.user_id from user_progress p left join users u on u.id=p.user_id where u.id is null order by p.user_id limit 250");
    const levelMismatch = await q(
      "select p.user_id,p.total_xp,p.level,(select max(candidate) from generate_series(1,100) candidate " +
      "where p.total_xp>=floor(100*power(candidate-1,1.5)))::int as expected_level from user_progress p " +
      "where p.level is distinct from (select max(candidate) from generate_series(1,100) candidate " +
      "where p.total_xp>=floor(100*power(candidate-1,1.5))) order by p.user_id limit 250"
    );
    const mirrorMismatch = await q(
      "select u.id as user_id,u.global_xp as legacy_xp,u.global_level as legacy_level,p.total_xp,p.level " +
      "from users u join user_progress p on p.user_id=u.id where u.global_xp is distinct from p.total_xp " +
      "or u.global_level is distinct from p.level order by u.id limit 250"
    );
    const ledgerMismatch = await q(
      "select p.user_id,p.total_xp,coalesce(sum(e.amount),0)::bigint as ledger_xp from user_progress p " +
      "left join xp_events e on e.user_id=p.user_id group by p.user_id,p.total_xp " +
      "having p.total_xp is distinct from coalesce(sum(e.amount),0)::bigint order by p.user_id limit 250"
    );
    Object.assign(report, {
      duplicateProgressRows: duplicateProgress,
      usersMissingProgress: missingProgress,
      orphanProgressRows: orphanProgress,
      levelFormulaMismatches: levelMismatch,
      legacyMirrorMismatches: mirrorMismatch,
      progressVsLedgerMismatches: ledgerMismatch,
    });
  }

  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : error);
  process.exitCode = 1;
}).finally(() => db.end());
