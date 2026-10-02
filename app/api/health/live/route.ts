import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";

// Process liveness is independent from database/media readiness.
export async function GET() {
  return NextResponse.json({ service: "flipzero-web", status: "ok", timestamp: new Date().toISOString() }, { headers: { "cache-control": "no-store" } });
}
