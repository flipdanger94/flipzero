import { drizzle } from "drizzle-orm/postgres-js";
import { eq } from "drizzle-orm";
import postgres from "postgres";
import * as schema from "./schema";
import { getDatabase } from "./client";

type Database = ReturnType<typeof drizzle<typeof schema>>;
type ShardConfig = { id: string; regions: string[]; connectionString: string };
type RawShardConfig = { id?: unknown; regions?: unknown; databaseUrl?: unknown };
const clients = new Map<string, Database>();

function parseShards(): ShardConfig[] {
  const raw = process.env.DATABASE_SHARDS_JSON;
  if (!raw) return [];
  try {
    const value = JSON.parse(raw) as unknown;
    if (!Array.isArray(value)) return [];
    return value.flatMap((item: RawShardConfig) => {
      if (typeof item?.id !== "string" || !/^[a-z0-9-]{1,32}$/i.test(item.id) || typeof item.databaseUrl !== "string" || !item.databaseUrl.startsWith("postgres")) return [];
      return [{ id: item.id, regions: Array.isArray(item.regions) ? item.regions.filter((region): region is string => typeof region === "string") : [], connectionString: item.databaseUrl }];
    });
  } catch { return []; }
}

function hash(input: string) {
  let value = 2166136261;
  for (let index = 0; index < input.length; index += 1) { value ^= input.charCodeAt(index); value = Math.imul(value, 16777619); }
  return value >>> 0;
}

export function resolveShardId(spaceId: string, shardIds: string[]) {
  if (!shardIds.length) return "primary";
  let selected = shardIds[0]; let highestScore = -1;
  for (const shardId of shardIds) { const score = hash(`${spaceId}:${shardId}`); if (score > highestScore) { highestScore = score; selected = shardId; } }
  return selected;
}

export function getDatabaseTopology() {
  const shards = parseShards();
  return { mode: shards.length ? "sharded" as const : "single" as const, region: process.env.VERCEL_REGION ?? "local", shardCount: shards.length || 1, configuredRegions: [...new Set(shards.flatMap((shard) => shard.regions))], routing: shards.length ? "rendezvous-hash" as const : "primary" as const };
}

export async function getDatabaseForSpace(spaceId: string): Promise<{ database: Database; shardId: string; region: string; routeVersion: number }> {
  const primary = getDatabase();
  const [placement] = await primary.select().from(schema.spacePlacements).where(eq(schema.spacePlacements.spaceId, spaceId)).limit(1);
  if (!placement || placement.shardId === "primary") return { database: primary, shardId: "primary", region: placement?.homeRegion ?? "global", routeVersion: placement?.version ?? 1 };
  if (placement.state !== "active") throw new Error(`SPACE_PLACEMENT_${placement.state.toUpperCase()}`);
  const selected = parseShards().find((shard) => shard.id === placement.shardId);
  if (!selected) throw new Error("SPACE_SHARD_NOT_CONFIGURED");
  const cached = clients.get(selected.id); if (cached) return { database: cached, shardId: selected.id, region: placement.homeRegion, routeVersion: placement.version };
  const client = postgres(selected.connectionString, { max: 1, idle_timeout: 20, connect_timeout: 10, prepare: false });
  const database = drizzle(client, { schema }); clients.set(selected.id, database);
  return { database, shardId: selected.id, region: placement.homeRegion, routeVersion: placement.version };
}
