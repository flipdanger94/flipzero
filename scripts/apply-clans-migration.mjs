import { readFile } from "node:fs/promises";
import postgres from "postgres";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("[clans] DATABASE_URL is required to apply the clans migration");
  process.exit(1);
}

const client = postgres(databaseUrl, { max: 1, prepare: false, connect_timeout: 10 });

function shardUrls() {
  const raw = process.env.DATABASE_SHARDS_JSON;
  if (!raw) return [];
  try {
    const value = JSON.parse(raw);
    if (!Array.isArray(value)) return [];
    return [...new Set(value.flatMap((item) => typeof item?.databaseUrl === "string" && item.databaseUrl.startsWith("postgres") ? [item.databaseUrl] : []))];
  } catch {
    return [];
  }
}

async function applySqlToUrl(url, sql, label) {
  const shard = postgres(url, { max: 1, prepare: false, connect_timeout: 10 });
  try {
    await shard.unsafe(sql);
    console.log(`[clans] ${label} ready`);
  } finally {
    await shard.end();
  }
}

try {
  // Profile and member lists used by clans depend on last_seen_at.
  const memberSql = await readFile(new URL("../drizzle/0015_role_member_badges.sql", import.meta.url), "utf8");
  await client.unsafe(memberSql);
  const sql = await readFile(new URL("../drizzle/0019_clans.sql", import.meta.url), "utf8");
  await client.unsafe(sql);
  const progressSql = await readFile(new URL("../drizzle/0020_clan_progress.sql", import.meta.url), "utf8");
  await client.unsafe(progressSql);
  const backfillSql = await readFile(new URL("../drizzle/0021_clan_xp_backfill.sql", import.meta.url), "utf8");
  await client.unsafe(backfillSql);
  const economySql = await readFile(new URL("../drizzle/0022_economy.sql", import.meta.url), "utf8");
  await client.unsafe(economySql);
  const governanceSql = await readFile(new URL("../drizzle/0023_clan_governance.sql", import.meta.url), "utf8");
  await client.unsafe(governanceSql);
  const socialSql = await readFile(new URL("../drizzle/0024_social_world.sql", import.meta.url), "utf8");
  await client.unsafe(socialSql);
  const personalizationSql = await readFile(new URL("../drizzle/0025_personalization.sql", import.meta.url), "utf8");
  await client.unsafe(personalizationSql);
  const removeTemporaryVoiceSql = await readFile(new URL("../drizzle/0026_remove_temporary_voice.sql", import.meta.url), "utf8");
  await client.unsafe(removeTemporaryVoiceSql);
  const voiceSpeakingSql = await readFile(new URL("../drizzle/0027_voice_speaking.sql", import.meta.url), "utf8");
  await client.unsafe(voiceSpeakingSql);
  const voiceLimitSql = await readFile(new URL("../drizzle/0028_voice_channel_user_limit.sql", import.meta.url), "utf8");
  await client.unsafe(voiceLimitSql);
  if (process.env.VERCEL_ENV !== "preview") {
    const voiceWebhookSql = await readFile(new URL("../drizzle/0029_livekit_voice_webhooks.sql", import.meta.url), "utf8");
    await client.unsafe(voiceWebhookSql);
    for (const [index, shardUrl] of shardUrls().entries()) {
      if (shardUrl === databaseUrl) continue;
      await applySqlToUrl(shardUrl, voiceWebhookSql, `voice shard ${index + 1}`);
    }

    const customThemesSql = await readFile(new URL("../drizzle/0031_custom_themes.sql", import.meta.url), "utf8");
    await client.unsafe(customThemesSql);
    const directCallsSql = await readFile(new URL("../drizzle/0032_direct_call_sessions.sql", import.meta.url), "utf8");
    await client.unsafe(directCallsSql);
  }
  const cosmetics = JSON.parse(await readFile(new URL("../config/cosmetics.json", import.meta.url), "utf8"));
  for (const item of cosmetics) await client`INSERT INTO cosmetic_items(id,title,description,category,rarity,price,preview,superflip_only) VALUES(${item.id},${item.title},${item.description},${item.category},${item.rarity},${item.price},${item.preview},${item.superflipOnly}) ON CONFLICT (id) DO UPDATE SET title=EXCLUDED.title,description=EXCLUDED.description,category=EXCLUDED.category,rarity=EXCLUDED.rarity,price=EXCLUDED.price,preview=EXCLUDED.preview,superflip_only=EXCLUDED.superflip_only`;
  const achievements = JSON.parse(await readFile(new URL("../config/achievements.json", import.meta.url), "utf8"));
  for (const item of achievements) await client`INSERT INTO achievement_definitions(id,space_id,key,name,description,icon,rarity,event_source,target,xp_reward,is_secret) VALUES(${item.id},NULL,${item.key},${item.name},${item.description},${item.icon},${item.rarity},${item.eventSource},${item.target},${item.xpReward},false) ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name,description=EXCLUDED.description,icon=EXCLUDED.icon,rarity=EXCLUDED.rarity,event_source=EXCLUDED.event_source,target=EXCLUDED.target,xp_reward=EXCLUDED.xp_reward`;
  const [result] = await client`SELECT to_regclass('public.clan_members') IS NOT NULL AS applied`;
  if (!result.applied) throw new Error("clan_members table was not created");
  console.log("[clans] schema ready");
} finally {
  await client.end();
}
