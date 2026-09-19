import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDatabase } from "@/db/client";
import { mediaAssets } from "@/db/schema";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return new Response(null, { status: 404 });
  const [asset] = await getDatabase().select({ bytes: mediaAssets.bytes, contentType: mediaAssets.contentType }).from(mediaAssets).where(eq(mediaAssets.id, id)).limit(1);
  if (!asset) return new Response(null, { status: 404 });
  return new NextResponse(new Uint8Array(asset.bytes), { headers: { "content-type": asset.contentType, "cache-control": "public, max-age=31536000, immutable", "x-content-type-options": "nosniff", "content-security-policy": "default-src 'none'; sandbox" } });
}
