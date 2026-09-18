import { NextResponse } from "next/server";

export const runtime = "nodejs";

export function GET() {
  return NextResponse.json({
    service: "flipzero-web",
    status: "ok",
    version: "0.4.0",
    databaseConfigured: Boolean(process.env.DATABASE_URL),
    timestamp: new Date().toISOString(),
  });
}
