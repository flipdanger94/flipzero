import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDatabase } from "@/db/client";
import { getDatabaseTopology } from "@/db/topology";
import { logEvent, requestId } from "@/lib/observability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const startedAt = performance.now();
  const id = requestId(request);
  let databaseStatus: "ok" | "error" = "error";
  let databaseLatencyMs: number | null = null;
  let placementCount = 0;
  let migratingPlacementCount = 0;

  try {
    const databaseStartedAt = performance.now();
    const database = getDatabase();
    await database.execute(sql`select 1 as ready`);
    const [placementSummary] = await database.execute(sql<{ total: number; migrating: number }>`select count(*)::int as total, count(*) filter (where state <> 'active')::int as migrating from space_placements`);
    placementCount = Number(placementSummary?.total ?? 0);
    migratingPlacementCount = Number(placementSummary?.migrating ?? 0);
    databaseLatencyMs = Math.round(performance.now() - databaseStartedAt);
    databaseStatus = "ok";
  } catch (error) {
    logEvent("error", "health_database_failed", { requestId: id, error: error instanceof Error ? error.message : String(error) });
  }

  const durationMs = Math.round(performance.now() - startedAt);
  const healthy = databaseStatus === "ok";
  const topology = getDatabaseTopology();
  logEvent(healthy ? "info" : "warn", "health_check_completed", { requestId: id, status: healthy ? "ok" : "degraded", durationMs, databaseLatencyMs });

  return NextResponse.json({
    service: "flipzero-web",
    status: healthy ? "ok" : "degraded",
    version: "0.8.2",
    timestamp: new Date().toISOString(),
    durationMs,
    deployment: {
      environment: process.env.VERCEL_ENV ?? "local",
      region: process.env.VERCEL_REGION ?? "local",
      commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "local",
    },
    checks: {
      api: { status: "ok", latencyMs: durationMs },
      database: { status: databaseStatus, latencyMs: databaseLatencyMs },
    },
    topology: { ...topology, placementCount, migratingPlacementCount },
    slo: {
      availabilityTarget: 99.9,
      apiP95TargetMs: 500,
      databaseP95TargetMs: 250,
      lcpTargetMs: 2500,
      inpTargetMs: 200,
      clsTarget: 0.1,
    },
  }, {
    status: healthy ? 200 : 503,
    headers: {
      "cache-control": "no-store, max-age=0",
      "server-timing": `database;dur=${databaseLatencyMs ?? 0}, total;dur=${durationMs}`,
      "x-flipzero-status": healthy ? "ok" : "degraded",
      "x-request-id": id,
    },
  });
}
