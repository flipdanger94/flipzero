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
  const storeInventorySql = await readFile(new URL("../drizzle/0033_store_inventory.sql", import.meta.url), "utf8");
  await client.unsafe(storeInventorySql);

  const slotForCategory = (category) => ({
    avatar_frame: "avatar_decoration",
    banner: "profile_banner",
    nickname: "nameplate",
    message_effect: "chat_style",
    badge: "badge",
    theme: "app_theme",
    profile_effect: "profile_effect",
  })[category] ?? category;

  const cosmetics = JSON.parse(await readFile(new URL("../config/cosmetics.json", import.meta.url), "utf8"));
  for (const item of cosmetics) {
    const slug = item.slug ?? item.id;
    const type = item.type ?? item.category;
    const slot = item.slot ?? slotForCategory(item.category);
    const previewImage = item.previewImage ?? item.preview;
    await client`INSERT INTO cosmetic_items(
      id,slug,title,description,category,type,slot,rarity,price,price_money_cents,preview,preview_image,preview_animation,
      superflip_only,is_bundle,is_animated,is_active,available_until,updated_at
    ) VALUES(
      ${item.id},${slug},${item.title},${item.description},${item.category},${type},${slot},${item.rarity},${item.price},
      ${item.priceMoneyCents ?? null},${item.preview},${previewImage},${item.previewAnimation ?? null},
      ${Boolean(item.superflipOnly)},${Boolean(item.isBundle)},${Boolean(item.isAnimated)},${item.isActive !== false},
      ${item.availableUntil ? new Date(item.availableUntil) : null},now()
    ) ON CONFLICT (id) DO UPDATE SET
      slug=EXCLUDED.slug,title=EXCLUDED.title,description=EXCLUDED.description,category=EXCLUDED.category,type=EXCLUDED.type,
      slot=EXCLUDED.slot,rarity=EXCLUDED.rarity,price=EXCLUDED.price,price_money_cents=EXCLUDED.price_money_cents,
      preview=EXCLUDED.preview,preview_image=EXCLUDED.preview_image,preview_animation=EXCLUDED.preview_animation,
      superflip_only=EXCLUDED.superflip_only,is_bundle=EXCLUDED.is_bundle,is_animated=EXCLUDED.is_animated,
      is_active=EXCLUDED.is_active,available_until=EXCLUDED.available_until,updated_at=now()`;
  }
  for (const item of cosmetics.filter((entry) => Array.isArray(entry.bundleItems))) {
    await client`DELETE FROM cosmetic_bundle_entries WHERE bundle_id=${item.id}`;
    for (const itemId of item.bundleItems) {
      await client`INSERT INTO cosmetic_bundle_entries(bundle_id,item_id) VALUES(${item.id},${itemId}) ON CONFLICT DO NOTHING`;
    }
  }
  const achievements = JSON.parse(await readFile(new URL("../config/achievements.json", import.meta.url), "utf8"));
  for (const item of achievements) await client`INSERT INTO achievement_definitions(id,space_id,key,name,description,icon,rarity,event_source,target,xp_reward,is_secret) VALUES(${item.id},NULL,${item.key},${item.name},${item.description},${item.icon},${item.rarity},${item.eventSource},${item.target},${item.xpReward},false) ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name,description=EXCLUDED.description,icon=EXCLUDED.icon,rarity=EXCLUDED.rarity,event_source=EXCLUDED.event_source,target=EXCLUDED.target,xp_reward=EXCLUDED.xp_reward`;
  const [result] = await client`SELECT to_regclass('public.clan_members') IS NOT NULL AS applied`;
  if (!result.applied) throw new Error("clan_members table was not created");
  console.log("[clans] schema ready");
} finally {
  await client.end();
}
