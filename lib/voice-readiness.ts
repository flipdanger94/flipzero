import "server-only";
import { RoomServiceClient } from "livekit-server-sdk";

type VoiceReadiness = { status: "ok" | "error" | "not_configured"; checkedAt: string };
let cached: { key: string; until: number; promise: Promise<VoiceReadiness> } | null = null;

export async function checkVoiceReadiness(): Promise<VoiceReadiness> {
  const url = process.env.LIVEKIT_URL, key = process.env.LIVEKIT_API_KEY, secret = process.env.LIVEKIT_API_SECRET;
  if (!url || !key || !secret) return { status: "not_configured", checkedAt: new Date().toISOString() };
  const cacheKey = [url, key, secret].join("|");
  if (cached?.key === cacheKey && cached.until > Date.now()) return cached.promise;
  const promise = (async (): Promise<VoiceReadiness> => {
    try {
      const service = new RoomServiceClient(url.replace(/^ws/, "http"), key, secret, { requestTimeout: 2, failover: false });
      await service.listRooms([]);
      return { status: "ok", checkedAt: new Date().toISOString() };
    } catch { return { status: "error", checkedAt: new Date().toISOString() }; }
  })();
  cached = { key: cacheKey, until: Date.now() + 30_000, promise };
  return promise;
}
