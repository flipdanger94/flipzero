import { and, asc, eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { getDatabase } from "@/db/client";
import { channels, members, spaces } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";

export default async function ChannelPage({ params }: { params: Promise<{ spaceId: string; channelId?: string[] }> }) {
  const { spaceId, channelId } = await params;
  if (channelId && channelId.length !== 1) notFound();
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/channels/${encodeURIComponent(spaceId)}${channelId ? `/${encodeURIComponent(channelId[0])}` : ""}`)}`);

  const database = getDatabase();
  const [space] = await database.select({ id: spaces.id, slug: spaces.slug, visibility: spaces.visibility }).from(spaces).where(eq(spaces.id, spaceId)).limit(1);
  if (!space) notFound();

  const [membership, channel] = await Promise.all([
    database.select({ userId: members.userId }).from(members).where(and(eq(members.spaceId, spaceId), eq(members.userId, user.id))).limit(1),
    channelId ? database.select({ id: channels.id }).from(channels).where(and(eq(channels.spaceId, spaceId), eq(channels.id, channelId[0]))).limit(1) : database.select({ id: channels.id }).from(channels).where(eq(channels.spaceId, spaceId)).orderBy(asc(channels.position)).limit(1),
  ]);
  if (!channel.length && channelId) notFound();
  if (!membership.length) {
    if (space.visibility !== "public") notFound();
    const target = channelId ? `?channel=${encodeURIComponent(channelId[0])}` : "";
    redirect(`/communities/${encodeURIComponent(space.slug)}${target}`);
  }

  return null;
}
