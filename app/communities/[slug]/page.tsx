import Link from "next/link";
import { and, asc, eq, sql } from "drizzle-orm";
import { Hash, ShieldCheck, Sparkles, Users } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { CommunityActions } from "@/components/community-actions";
import { BrandMark } from "@/components/brand-mark";
import { getDatabase } from "@/db/client";
import { MediaImage } from "@/components/media-image";
import { channels, members, spaceJoinRequests, spaces } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { getSpaceChannelPermissions } from "@/lib/space-permissions";
import { hasPermission, Permission } from "@/lib/permissions";
import { loginPathFor } from "@/lib/route-access";

export default async function CommunityPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ channel?: string | string[] }> }) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const requestedChannelId = typeof query.channel === "string" ? query.channel : null;
  const user = await getCurrentUser();
  const communityPath = `/communities/${encodeURIComponent(slug)}${requestedChannelId ? `?channel=${encodeURIComponent(requestedChannelId)}` : ""}`;
  if (!user) redirect(loginPathFor(communityPath));
  const database = getDatabase();
  const spaceRows = await database.select({ id: spaces.id, name: spaces.name, slug: spaces.slug, description: spaces.description, iconUrl: spaces.iconUrl, bannerUrl: spaces.bannerUrl, visibility: spaces.visibility, accentColor: spaces.accentColor, memberCount: sql<number>`count(${members.userId})::int` }).from(spaces).leftJoin(members, eq(members.spaceId, spaces.id)).where(eq(spaces.slug, slug)).groupBy(spaces.id).limit(1);
  const space = spaceRows[0];
  if (!space) notFound();

  const [membershipRows, joinRequestRows] = await Promise.all([
    database.select({ userId: members.userId }).from(members).where(and(eq(members.spaceId, space.id), eq(members.userId, user.id))).limit(1),
    database.select({ status: spaceJoinRequests.status }).from(spaceJoinRequests).where(and(eq(spaceJoinRequests.spaceId, space.id), eq(spaceJoinRequests.userId, user.id))).limit(1),
  ]);
  const isMember = membershipRows.length > 0;
  if (!["public", "application"].includes(space.visibility) && !isMember) notFound();

  let selectedChannel: { id: string } | null = null;
  let visibleRequestedChannelId: string | null = null;
  if (isMember) {
    const channelRows = await database.select({ id: channels.id }).from(channels).where(eq(channels.spaceId, space.id)).orderBy(asc(channels.position));
    const permissionMap = await getSpaceChannelPermissions(space.id, user.id, channelRows.map((channel) => channel.id));
    const visibleChannels = channelRows.filter((channel) => hasPermission(permissionMap.get(channel.id) ?? 0, Permission.ViewChannels));
    const requestedChannel = requestedChannelId ? visibleChannels.find((channel) => channel.id === requestedChannelId) ?? null : null;
    selectedChannel = requestedChannel ?? visibleChannels[0] ?? null;
    visibleRequestedChannelId = requestedChannel?.id ?? null;
  }

  return <main className="community-page">
    <nav className="community-nav"><Link href="/" className="community-logo"><span className="brand-symbol-wrap"><BrandMark /></span><strong>FlipZero</strong></Link><Link href="/app">Открыть приложение</Link></nav>
    <section className="community-hero" style={{ "--community-accent": space.accentColor } as React.CSSProperties}>
      <div className="community-glow" />
      <div className="community-banner" style={space.bannerUrl ? { backgroundImage: `linear-gradient(180deg, transparent, rgba(8, 9, 13, .88)), url(${space.bannerUrl})` } : undefined}>
        <div className="community-avatar">{space.iconUrl ? <MediaImage src={space.iconUrl} /> : space.name.slice(0, 2).toLocaleUpperCase("ru")}</div>
      </div>
      <div className="community-content">
        <span className="community-kicker"><Sparkles size={15} /> Сообщество FlipZero</span>
        <h1>{space.name}</h1>
        <p>{space.description || "Открытое пространство для общения, событий и совместных идей."}</p>
        <div className="community-stats"><span><Users size={17} /> {space.memberCount.toLocaleString("ru-RU")} участников</span><span><Hash size={17} /> @{space.slug}</span><span><ShieldCheck size={17} /> {space.visibility === "public" ? "Открытое" : space.visibility === "application" ? "Вступление по заявке" : "По приглашению"}</span></div>
        <CommunityActions spaceId={space.id} slug={space.slug} channelId={selectedChannel?.id ?? null} visibility={space.visibility} joinRequestStatus={joinRequestRows[0]?.status ?? null} isMember={isMember} isAuthenticated={Boolean(user)} requestedChannelId={visibleRequestedChannelId} />
      </div>
    </section>
    <section className="community-info"><article><strong>Живое общение</strong><p>Текстовые, голосовые и тематические каналы в одном пространстве.</p></article><article><strong>События и знания</strong><p>Встречи, база знаний, форум и доски сообщества всегда рядом.</p></article><article><strong>Свои правила</strong><p>Роли, права доступа и прозрачная модерация для комфортного общения.</p></article></section>
  </main>;
}
