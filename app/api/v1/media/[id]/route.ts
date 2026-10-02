import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDatabase } from "@/db/client";
import { mediaAssets, members, spaceSounds, userStories } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { mayViewStory } from "@/lib/story-access";
import { mayReadAttachment } from "@/lib/media-access";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const denied = () => new Response(null, { status: 404, headers: { "cache-control": "private, no-store" } });
  if (!/^[0-9a-f-]{36}$/.test(id)) return denied();
  const database = getDatabase();
  const [asset] = await database.select({ contentType: mediaAssets.contentType, purpose: mediaAssets.purpose, ownerId:mediaAssets.ownerId, attachedAt: mediaAssets.attachedAt }).from(mediaAssets).where(eq(mediaAssets.id, id)).limit(1);
  if (!asset) return denied();
  const isPublic = asset.purpose === "public";
  const viewer = isPublic ? null : await getCurrentUser();
  if (!isPublic && !viewer) return denied();
  if(asset.purpose==="story"){
    const [story]=await getDatabase().select().from(userStories).where(eq(userStories.imageUrl,`/api/v1/media/${id}`)).limit(1);
    if(story?!await mayViewStory(viewer!.id,story):asset.ownerId!==viewer!.id)return denied();
  } else if (asset.purpose === "attachment") {
    if (!await mayReadAttachment(viewer!.id, id, asset.ownerId, asset.attachedAt)) return denied();
  } else if (asset.purpose === "sound") {
    const [membership] = await database.select({ id: spaceSounds.id }).from(spaceSounds)
      .innerJoin(members, and(eq(members.spaceId, spaceSounds.spaceId), eq(members.userId, viewer!.id)))
      .where(eq(spaceSounds.assetId, id)).limit(1);
    if (!membership) return denied();
  } else if (!isPublic) {
    return denied();
  }
  const [data] = await database.select({ bytes: mediaAssets.bytes }).from(mediaAssets).where(eq(mediaAssets.id, id)).limit(1);
  if (!data) return denied();
  return new NextResponse(new Uint8Array(data.bytes), { headers: { "content-type": asset.contentType, "cache-control": isPublic?"public, max-age=31536000, immutable":"private, no-store", "vary": "Cookie", "x-content-type-options": "nosniff", "content-security-policy": "default-src 'none'; sandbox" } });
}
