import postgres from "postgres";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("[xp-audit] DATABASE_URL is required");
  process.exit(1);
}

const client = postgres(databaseUrl, { max: 1, prepare: false, connect_timeout: 10 });

async function hasTable(name: string) {
  const [row] = await client`select to_regclass(${"public." + name}) is not null as present`;
  return Boolean(row?.present);
}

async function main() {
  const progressExists = await hasTable("user_progress");
  const xpEventsExists = await hasTable("xp_events");
  if (!xpEventsExists) throw new Error("xp_events table is missing");

  const summary: Record<string, unknown> = {
    generatedAt: new Date().toISOString(),
    mode: "read-only",
    userProgressExists: progressExists,
  };

  if (progressExists) {
    summary.progressDuplicates = await client`
      select user_id, count(*)::int as rows
      from user_progress
      group by user_id
      having count(*) > 1
      order by rows desc, user_id
    `;
    summary.levelMismatches = await client`
      select p.user_id,p.total_xp,p.level,
        (select max(candidate)
         from generate_series(1,100) as candidate
         where floor(100 * power(candidate - 1, 1.5)) <= p.total_xp) as expected_level
      from user_progress p
      where p.level <> (
        select max(candidate)
        from generate_series(1,100) as candidate
        where floor(100 * power(candidate - 1, 1.5)) <= p.total_xp
      )
      order by p.user_id
    `;
    summary.negativeProgress = await client`
      select user_id,total_xp,level
      from user_progress
      where total_xp < 0 or level < 1 or level > 100
      order by user_id
    `;
    summary.progressWithoutUser = await client`
      select p.user_id
      from user_progress p
      left join users u on u.id=p.user_id
      where u.id is null
      order by p.user_id
    `;
    summary.ledgerMismatch = await client`
      select p.user_id,p.total_xp,coalesce(sum(e.amount),0)::bigint as ledger_xp
      from user_progress p
      left join xp_events e on e.user_id=p.user_id
      group by p.user_id,p.total_xp
      having p.total_xp <> coalesce(sum(e.amount),0)::bigint
      order by p.user_id
    `;
  }

  const dedupeColumn = await client`
    select exists(
      select 1 from information_schema.columns
      where table_schema='public' and table_name='xp_events' and column_name='dedupe_key'
    ) as present
  `;
  const hasDedupe = Boolean(dedupeColumn[0]?.present);

  summary.eventDuplicates = hasDedupe
    ? await client`
        select user_id,source,dedupe_key,count(*)::int as rows,min(created_at) as first_at,max(created_at) as last_at
        from xp_events
        group by user_id,source,dedupe_key
        having count(*) > 1
        order by rows desc,user_id,source
      `
    : await client`
        select user_id,source,idempotency_key as dedupe_key,count(*)::int as rows,min(created_at) as first_at,max(created_at) as last_at
        from xp_events
        group by user_id,source,idempotency_key
        having count(*) > 1
        order by rows desc,user_id,source
      `;

  summary.eventsWithoutUser = await client`
    select e.id,e.user_id,e.source,e.amount,e.created_at
    from xp_events e
    left join users u on u.id=e.user_id
    where u.id is null
    order by e.created_at
  `;

  summary.negativeEvents = await client`
    select id,user_id,source,amount,created_at
    from xp_events
    where amount < 0
    order by created_at
  `;

  summary.userSnapshotMismatch = progressExists
    ? await client`
        select u.id,u.global_xp,u.global_level,p.total_xp,p.level
        from users u
        join user_progress p on p.user_id=u.id
        where u.global_xp<>p.total_xp or u.global_level<>p.level
        order by u.id
      `
    : [];

  console.log(JSON.stringify(summary, null, 2));
}

try {
  await main();
} finally {
  await client.end();
}
