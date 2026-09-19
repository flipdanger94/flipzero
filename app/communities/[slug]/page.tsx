import Link from "next/link";
import { and, asc, eq, sql } from "drizzle-orm";
import { Hash, ShieldCheck, Sparkles, Users } from "lucide-react";
import { notFound } from "next/navigation";
import { CommunityActions } from "@/components/community-actions";
import { getDatabase } from "@/db/client";
import { channels, members, spaces } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";

export default async function CommunityPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ channel?: string | string[] }> }) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const requestedChannelId = typeof query.channel === "string" ? query.channel : null;
  const database = getDatabase();
  const [spaceRows, user] = await Promise.all([
    database.select({ id: spaces.id, name: spaces.name, slug: spaces.slug, description: spaces.description, bannerUrl: spaces.bannerUrl, visibility: spaces.visibility, accentColor: spaces.accentColor, memberCount: sql<number>`count(${members.userId})::int` }).from(spaces).leftJoin(members, eq(members.spaceId, spaces.id)).where(eq(spaces.slug, slug)).groupBy(spaces.id).limit(1),
    getCurrentUser(),
  ]);
  const space = spaceRows[0];
  if (!space) notFound();

  const [membershipRows, channelRows, requestedChannelRows] = await Promise.all([
    user ? database.select({ userId: members.userId }).from(members).where(and(eq(members.spaceId, space.id), eq(members.userId, user.id))).limit(1) : Promise.resolve([]),
    database.select({ id: channels.id }).from(channels).where(eq(channels.spaceId, space.id)).orderBy(asc(channels.position)).limit(1),
    requestedChannelId ? database.select({ id: channels.id }).from(channels).where(and(eq(channels.id, requestedChannelId), eq(channels.spaceId, space.id))).limit(1) : Promise.resolve([]),
  ]);
  const isMember = membershipRows.length > 0;
  if (space.visibility !== "public" && !isMember) notFound();
  const selectedChannel = requestedChannelRows[0] ?? channelRows[0] ?? null;

  return <main className="community-page">
    <nav className="community-nav"><Link href="/" className="community-logo"><span>FZ</span><strong>FlipZero</strong></Link><Link href="/app">Открыть приложение</Link></nav>
    <section className="community-hero" style={{ "--community-accent": space.accentColor } as React.CSSProperties}>
      <div className="community-glow" />
      <div className="community-banner" style={space.bannerUrl ? { backgroundImage: `linear-gradient(180deg, transparent, rgba(8, 9, 13, .88)), url(${space.bannerUrl})` } : undefined}>
        <div className="community-avatar">{space.name.slice(0, 2).toLocaleUpperCase("ru")}</div>
      </div>
      <div className="community-content">
        <span className="community-kicker"><Sparkles size={15} /> Сообщество FlipZero</span>
        <h1>{space.name}</h1>
        <p>{space.description || "Открытое пространство для общения, событий и совместных идей."}</p>
        <div className="community-stats"><span><Users size={17} /> {space.memberCount.toLocaleString("ru-RU")} участников</span><span><Hash size={17} /> @{space.slug}</span><span><ShieldCheck size={17} /> {space.visibility === "public" ? "Открытое" : "По приглашению"}</span></div>
        <CommunityActions spaceId={space.id} slug={space.slug} channelId={selectedChannel?.id ?? null} isMember={isMember} isAuthenticated={Boolean(user)} requestedChannelId={requestedChannelRows[0]?.id ?? null} />
      </div>
    </section>
    <section className="community-info"><article><strong>Живое общение</strong><p>Текстовые, голосовые и тематические каналы в одном пространстве.</p></article><article><strong>События и знания</strong><p>Встречи, база знаний, форум и доски сообщества всегда рядом.</p></article><article><strong>Свои правила</strong><p>Роли, права доступа и прозрачная модерация для комфортного общения.</p></article></section>
  </main>;
}
