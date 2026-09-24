import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDatabase } from "@/db/client";
import { mediaAssets, userStories } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { mayViewStory } from "@/lib/story-access";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return new Response(null, { status: 404 });
  const [asset] = await getDatabase().select({ bytes: mediaAssets.bytes, contentType: mediaAssets.contentType, purpose: mediaAssets.purpose, ownerId:mediaAssets.ownerId }).from(mediaAssets).where(eq(mediaAssets.id, id)).limit(1);
  if (!asset) return new Response(null, { status: 404 });
  if(asset.purpose==="story"){
    const viewer=await getCurrentUser();
    if(!viewer)return new Response(null,{status:404});
    const [story]=await getDatabase().select().from(userStories).where(eq(userStories.imageUrl,`/api/v1/media/${id}`)).limit(1);
    if(story?!await mayViewStory(viewer.id,story):asset.ownerId!==viewer.id)return new Response(null,{status:404});
  }
  return new NextResponse(new Uint8Array(asset.bytes), { headers: { "content-type": asset.contentType, "cache-control": asset.purpose==="story"?"private, no-store":"public, max-age=31536000, immutable", "x-content-type-options": "nosniff", "content-security-policy": "default-src 'none'; sandbox" } });
}
