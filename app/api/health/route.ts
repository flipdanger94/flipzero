import { NextResponse } from "next/server";

export const runtime = "nodejs";

export function GET() {
  return NextResponse.json({
    service: "flipzero-web",
    status: "ok",
    version: "0.2.0",
    timestamp: new Date().toISOString(),
  });
}
