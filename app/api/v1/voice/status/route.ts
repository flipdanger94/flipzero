import { NextResponse } from "next/server";
import { RoomServiceClient } from "livekit-server-sdk";
import { getCurrentUser } from "@/lib/auth";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ message: "Требуется вход." }, { status: 401 });
  const url = process.env.LIVEKIT_URL;
  const key = process.env.LIVEKIT_API_KEY;
  const secret = process.env.LIVEKIT_API_SECRET;
  const available = Boolean(url && key && secret);
  const headers = { "cache-control": "no-store" };
  if (new URL(request.url).searchParams.get("check") !== "1")
    return NextResponse.json({ available }, { headers });
  if (!url || !key || !secret)
    return NextResponse.json({ available: false, connection: "not_configured" }, { headers });
  try {
    const serviceUrl = new URL(url);
    if (serviceUrl.protocol !== "wss:" && serviceUrl.protocol !== "https:")
      return NextResponse.json({ available, connection: "invalid_url" }, { headers });
    serviceUrl.protocol = "https:";
    await new RoomServiceClient(serviceUrl.origin, key, secret, { requestTimeout: 5, failover: false }).listRooms([]);
    return NextResponse.json({ available, connection: "ok" }, { headers });
  } catch {
    return NextResponse.json({ available, connection: "unreachable" }, { headers });
  }
}
