"use client";

import { type FormEvent, useEffect, useState } from "react";
import { Bell, BookOpen, Check, ChevronDown, CirclePlus, Code2, Compass, Copy, Gem, Gift, Hash, Headphones, HelpCircle, Home as HomeIcon, Image as ImageIcon, LoaderCircle, Menu, MessageCircle, Mic, Plus, Search, SendHorizontal, Settings, Settings2, Share2, ShieldCheck, Smile, Sparkles, Trash2, UserRound, Users, Volume2, X } from "lucide-react";
import { CreateSpaceDialog } from "@/components/create-space-dialog";
import { MediaImage } from "@/components/media-image";
import { CreateChannelDialog, type CreatedChannel } from "@/components/create-channel-dialog";
import { CreateCategoryDialog, type CreatedCategory } from "@/components/create-category-dialog";
import { SpaceSettingsDialog, type EditableSpace } from "@/components/space-settings-dialog";
import { RoleManagerDialog } from "@/components/role-manager-dialog";
import { InviteManagerDialog } from "@/components/invite-manager-dialog";
import { MemberManagerDialog } from "@/components/member-manager-dialog";
import { ChannelPermissionsDialog } from "@/components/channel-permissions-dialog";
import { ModerationDialog } from "@/components/moderation-dialog";
import { GamificationDialog } from "@/components/gamification-dialog";
import { PersistentChat } from "@/components/persistent-chat";
import { ChannelBoard } from "@/components/channel-board";
import { ForumChannel } from "@/components/forum-channel";
import { VoiceRoom } from "@/components/voice-room";
import { DiscoveryDialog } from "@/components/discovery-dialog";
import { EventsDialog } from "@/components/events-dialog";
import { WikiDialog } from "@/components/wiki-dialog";
import { DeveloperDialog } from "@/components/developer-dialog";
import { SystemStatusDialog } from "@/components/system-status-dialog";
import { AccountSettingsDialog, type AccountProfile, type AccountSettingsSection } from "@/components/account-settings-dialog";
import { BrandMark } from "@/components/brand-mark";
import { SocialHubDialog } from "@/components/social-hub-dialog";
import { AdminDialog } from "@/components/admin-dialog";
import { ServerContextMenu } from "@/components/server-context-menu";
import { OnboardingWizard } from "@/components/onboarding-wizard";

type ApiChannel = { id: string; parentId: string | null; name: string; topic: string | null; kind: string; position?: number };
type ApiCategory = { id: string; spaceId: string; name: string; position: number };
type ApiSpace = { id: string; ownerId?: string; name: string; slug: string; description: string | null; iconUrl?: string | null; bannerUrl?: string | null; visibility?: string; accentColor: string; categories: ApiCategory[]; channels: ApiChannel[] };
type CurrentUser = AccountProfile;
type Message = { initials: string; name: string; time: string; text: string; accent: string; reactions: string[]; badge?: string; quest?: boolean };

const generalMessages: Message[] = [
  { initials: "AP", name: "Alex Push", time: "Сегодня, 10:42", text: "Добро пожаловать в FlipZero! Здесь мы собираем первые идеи продукта и вместе решаем, каким станет наше сообщество.", accent: "avatar-coral", reactions: ["🔥  12", "✨  8"] },
  { initials: "MK", name: "Mira K.", time: "Сегодня, 10:46", text: "Новый профиль выглядит мощно. Особенно нравится, что уровень отражает реальную активность, а не просто количество сообщений.", accent: "avatar-violet", reactions: ["💜  6"] },
  { initials: "ZS", name: "Zero System", time: "Сегодня, 10:48", text: "Еженедельный челлендж открыт: проведите 30 минут в голосовых комнатах и получите значок «На одной волне».", accent: "avatar-lime", badge: "БОТ", quest: true, reactions: [] },
];
const initialChannelMessages: Record<string, Message[]> = {
  "общий-чат": generalMessages,
  "добро-пожаловать": [{ initials: "ZS", name: "Zero System", time: "Сегодня, 09:00", text: "Рады видеть вас в FlipZero. Выберите каналы по интересам, настройте профиль и познакомьтесь с участниками пространства.", accent: "avatar-lime", badge: "БОТ", reactions: ["👋  18"] }],
  "правила": [{ initials: "AP", name: "Alex Push", time: "Сегодня, 09:05", text: "Уважайте друг друга, не публикуйте спам и используйте подходящие каналы. Наша цель — создать пространство, куда хочется возвращаться.", accent: "avatar-coral", reactions: ["✅  21"] }],
  "творчество": [{ initials: "MK", name: "Mira K.", time: "Сегодня, 11:02", text: "Делитесь здесь дизайнами, музыкой, иллюстрациями и всем, что создаёте. Незавершённые идеи тоже приветствуются.", accent: "avatar-violet", reactions: ["🎨  9"] }],
  "игры": [{ initials: "NN", name: "Nana", time: "Сегодня, 11:18", text: "Кто сегодня вечером в кооператив? Собираем команду из четырёх человек.", accent: "avatar-amber", reactions: ["🎮  4"] }],
};
const channelDetails: Record<string, { title: string; description: string }> = {
  "общий-чат": { title: "Добро пожаловать в общий чат", description: "Знакомьтесь, делитесь идеями и создавайте что-то новое вместе." },
  "добро-пожаловать": { title: "Начните знакомство с FlipZero", description: "Всё необходимое, чтобы быстро освоиться в пространстве." },
  "правила": { title: "Правила пространства", description: "Простые принципы комфортного и безопасного общения." },
  "творчество": { title: "Покажите, что вы создаёте", description: "Работы, процессы, идеи и поддержка от сообщества." },
  "игры": { title: "Играем вместе", description: "Ищите команду, договаривайтесь о сессиях и делитесь моментами." },
};
const members = [
  { initials: "AP", name: "Alex Push", status: "Создаёт будущее", level: 12, accent: "avatar-coral" },
  { initials: "MK", name: "Mira K.", status: "В общем чате", level: 9, accent: "avatar-violet" },
  { initials: "IL", name: "Ilya", status: "Слушает музыку", level: 7, accent: "avatar-sky" },
  { initials: "NN", name: "Nana", status: "В игре", level: 5, accent: "avatar-amber" },
];

export default function Home({ initialSpaceId, initialChannelId }: { initialSpaceId?: string; initialChannelId?: string } = {}) {
  const [channelMessages, setChannelMessages] = useState(initialChannelMessages);
  const [draft, setDraft] = useState("");
  const [activeChannel, setActiveChannel] = useState("общий-чат");
  const [searchQuery, setSearchQuery] = useState("");
  const [showMembers, setShowMembers] = useState(true);
  const [notifications, setNotifications] = useState(true);
  const [storageReady, setStorageReady] = useState(false);
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [userSpaces, setUserSpaces] = useState<ApiSpace[]>([]);
  const [activeSpaceId, setActiveSpaceId] = useState<string | null>(null);
  const [spacesLoading, setSpacesLoading] = useState(true);
  const [showCreateSpace, setShowCreateSpace] = useState(false);
  const [showDiscovery, setShowDiscovery] = useState(false);
  const [showEvents, setShowEvents] = useState(false);
  const [showWiki, setShowWiki] = useState(false);
  const [showDeveloper, setShowDeveloper] = useState(false);
  const [showSystemStatus, setShowSystemStatus] = useState(false);
  const [createChannelTarget, setCreateChannelTarget] = useState<{ kind: "text" | "voice"; parentId: string | null } | null>(null);
  const [showCreateCategory, setShowCreateCategory] = useState(false);
  const [showSpaceSettings, setShowSpaceSettings] = useState(false);
  const [showRoleManager, setShowRoleManager] = useState(false);
  const [showInviteManager, setShowInviteManager] = useState(false);
  const [showMemberManager, setShowMemberManager] = useState(false);
  const [permissionsChannel, setPermissionsChannel] = useState<ApiChannel | null>(null);
  const [showModeration, setShowModeration] = useState(false);
  const [showGamification, setShowGamification] = useState(false);
  const [showAccountSettings, setShowAccountSettings] = useState(false);
  const [accountSettingsSection, setAccountSettingsSection] = useState<AccountSettingsSection>("profile");
  const [platformView, setPlatformView] = useState<"social" | "admin" | null>(null);
  const [levelUp, setLevelUp] = useState<number | null>(null);
  const [mobileChannelsOpen, setMobileChannelsOpen] = useState(false);
  const [channelLinkCopied, setChannelLinkCopied] = useState(false);
  const [, setSpaceLinkCopied] = useState(false);
  const [serverMenuOpen, setServerMenuOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetch("/api/v1/auth/me", { cache: "no-store" }).then((response) => response.json()), fetch("/api/v1/spaces").then((response) => response.json()), fetch("/api/admin/access", { cache: "no-store" }).then((response) => ({ admin: response.ok }))]).then(([profile, spaceData, adminAccess]) => {
      if (cancelled) return;
      setUser(profile.user ? { ...profile.user, ...(adminAccess.admin ? { platformRole: "admin" as const } : {}) } : null);
      const loadedSpaces = (spaceData.spaces ?? []) as ApiSpace[];
      setUserSpaces(loadedSpaces);
      const requestedSpace = loadedSpaces.find((space) => space.id === initialSpaceId) ?? loadedSpaces[0] ?? null;
      const requestedChannel = requestedSpace?.channels.find((channel) => channel.id === initialChannelId) ?? requestedSpace?.channels.find((channel) => channel.kind === "text") ?? requestedSpace?.channels[0] ?? null;
      setActiveSpaceId(requestedSpace?.id ?? null);
      if (requestedChannel) setActiveChannel(requestedChannel.name);
      if (!initialSpaceId && requestedSpace && requestedChannel) window.history.replaceState({}, "", `/channels/${requestedSpace.id}/${requestedChannel.id}`);
      setSpacesLoading(false);
    }).catch(() => { if (!cancelled) setSpacesLoading(false); });
    return () => { cancelled = true; };
  }, [initialChannelId, initialSpaceId]);

  useEffect(() => {
    const saved = window.localStorage.getItem("flipzero:messages:v2");
    let restoredMessages = initialChannelMessages;
    if (saved) {
      try {
        restoredMessages = JSON.parse(saved) as Record<string, Message[]>;
      } catch {
        window.localStorage.removeItem("flipzero:messages:v2");
      }
    }
    queueMicrotask(() => {
      setChannelMessages(restoredMessages);
      setStorageReady(true);
    });
  }, []);

  useEffect(() => {
    if (storageReady) window.localStorage.setItem("flipzero:messages:v2", JSON.stringify(channelMessages));
  }, [channelMessages, storageReady]);

  useEffect(() => { const handler = (event: Event) => selectChannel((event as CustomEvent<string>).detail); window.addEventListener("flipzero:select-channel", handler); return () => window.removeEventListener("flipzero:select-channel", handler); });

  useEffect(() => {
    const syncRoute = () => {
      const match = window.location.pathname.match(/^\/channels\/([^/]+)\/([^/]+)$/);
      if (!match) return;
      const space = userSpaces.find((item) => item.id === decodeURIComponent(match[1]));
      const channel = space?.channels.find((item) => item.id === decodeURIComponent(match[2]));
      if (space && channel) { setActiveSpaceId(space.id); setActiveChannel(channel.name); }
    };
    window.addEventListener("popstate", syncRoute);
    return () => window.removeEventListener("popstate", syncRoute);
  }, [userSpaces]);

  const activeMessages = channelMessages[activeChannel] ?? [];
  const activeSpace = userSpaces.find((space) => space.id === activeSpaceId) ?? null;
  const activeRouteChannel = activeSpace?.channels.find((channel) => channel.name === activeChannel) ?? null;
  const activeApiChannel = activeSpace?.channels.find((channel) => channel.name === activeChannel && ["text", "forum", "announcement"].includes(channel.kind)) ?? null;
  const activeBoardChannel = activeSpace?.channels.find((channel) => channel.name === activeChannel && channel.kind === "board") ?? null;
  const activeForumChannel = activeSpace?.channels.find((channel) => channel.name === activeChannel && channel.kind === "forum") ?? null;
  const activeVoiceChannel = activeSpace?.channels.find((channel) => channel.name === activeChannel && channel.kind === "voice") ?? null;
  const activeDetails = channelDetails[activeChannel] ?? { title: activeChannel, description: "Канал пространства FlipZero." };
  const visibleMessages = activeMessages.filter((message) => {
    const query = searchQuery.trim().toLocaleLowerCase("ru");
    return !query || message.text.toLocaleLowerCase("ru").includes(query) || message.name.toLocaleLowerCase("ru").includes(query);
  });

  async function shareChannelLink() {
    if (!activeSpace || !activeRouteChannel) return;
    const url = `${window.location.origin}/channels/${encodeURIComponent(activeSpace.id)}/${encodeURIComponent(activeRouteChannel.id)}`;
    if (window.matchMedia("(max-width: 760px)").matches && typeof navigator.share === "function") {
      try {
        await navigator.share({ title: `#${activeRouteChannel.name} · ${activeSpace.name}`, url });
        return;
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setChannelLinkCopied(true);
      window.setTimeout(() => setChannelLinkCopied(false), 1800);
    } catch {
      setChannelLinkCopied(false);
    }
  }

  async function copyCommunityLink() {
    if (!activeSpace) return;
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/communities/${encodeURIComponent(activeSpace.slug)}`);
      setSpaceLinkCopied(true);
      window.setTimeout(() => setSpaceLinkCopied(false), 1800);
    } catch {
      setSpaceLinkCopied(false);
    }
  }

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;
    const displayName = user?.displayName ?? "Alex Push";
    const initials = displayName.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toLocaleUpperCase("ru");
    setChannelMessages((current) => ({ ...current, [activeChannel]: [...(current[activeChannel] ?? []), { initials, name: displayName, time: "Только что", text, accent: "avatar-coral", reactions: [] }] }));
    setDraft("");
    if (activeSpace) {
      const response = await fetch("/api/v1/gamification/award", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ source: "message", spaceId: activeSpace.id, idempotencyKey: `message:${activeSpace.id}:${crypto.randomUUID()}` }) });
      const result = await response.json().catch(() => null);
      if (response.ok && result?.profile) {
        setUser((current) => current ? { ...current, globalXp: result.profile.globalXp, globalLevel: result.profile.globalLevel } : current);
        if (result.profile.levelUp) { setLevelUp(result.profile.globalLevel); window.setTimeout(() => setLevelUp(null), 4200); }
      }
    }
  }

  function selectChannel(channel: string, channelId?: string, spaceId?: string) {
    setActiveChannel(channel);
    setSearchQuery("");
    setDraft("");
    setMobileChannelsOpen(false);
    if (channelId && spaceId && window.location.pathname !== `/channels/${spaceId}/${channelId}`) window.history.pushState({}, "", `/channels/${spaceId}/${channelId}`);
  }

  function addChannel(channel: CreatedChannel) {
    setUserSpaces((current) => current.map((space) => space.id === channel.spaceId ? { ...space, channels: [...space.channels, channel] } : space));
    if (channel.kind !== "voice") selectChannel(channel.name, channel.id, channel.spaceId);
    setCreateChannelTarget(null);
  }

  async function deleteChannel(channel: ApiChannel) {
    if (!activeSpace || !window.confirm(`Удалить канал «${channel.name}»?`)) return;
    const response = await fetch(`/api/v1/spaces/${activeSpace.id}/channels?channelId=${channel.id}`, { method: "DELETE" });
    const result = await response.json();
    if (!response.ok) { window.alert(result.message ?? "Не удалось удалить канал."); return; }
    const nextChannels = activeSpace.channels.filter((item) => item.id !== channel.id);
    setUserSpaces((current) => current.map((space) => space.id === activeSpace.id ? { ...space, channels: nextChannels } : space));
    if (activeChannel === channel.name) { const next = nextChannels.find((item) => item.kind === "text") ?? nextChannels[0]; if (next) selectChannel(next.name, next.id, activeSpace.id); }
  }

  function addCategory(category: CreatedCategory) {
    setUserSpaces((current) => current.map((space) => space.id === category.spaceId ? { ...space, categories: [...space.categories, category] } : space));
    setShowCreateCategory(false);
  }

  async function deleteCategory(category: ApiCategory) {
    if (!activeSpace || !window.confirm(`Удалить категорию «${category.name}»? Каналы останутся без категории.`)) return;
    const response = await fetch(`/api/v1/spaces/${activeSpace.id}/categories?categoryId=${category.id}`, { method: "DELETE" });
    const result = await response.json();
    if (!response.ok) { window.alert(result.message ?? "Не удалось удалить категорию."); return; }
    setUserSpaces((current) => current.map((space) => space.id === activeSpace.id ? { ...space, categories: space.categories.filter((item) => item.id !== category.id), channels: space.channels.map((channel) => channel.parentId === category.id ? { ...channel, parentId: null } : channel) } : space));
  }

  function saveSpaceSettings(updated: EditableSpace, close = true) {
    setUserSpaces((current) => current.map((space) => space.id === updated.id ? { ...space, ...updated } : space));
    if (close) setShowSpaceSettings(false);
  }

  async function openJoinedSpace(spaceId: string) {
    const response = await fetch("/api/v1/spaces");
    const data = await response.json();
    if (!response.ok) return;
    const loadedSpaces = (data.spaces ?? []) as ApiSpace[];
    const selected = loadedSpaces.find((space) => space.id === spaceId);
    setUserSpaces(loadedSpaces);
    setActiveSpaceId(spaceId);
    if (selected) {
      const first = selected.channels.find((channel) => channel.kind === "text");
      if (first) selectChannel(first.name, first.id, selected.id);
    }
    setShowDiscovery(false);
  }

  async function leaveActiveSpace() {
    if (!activeSpace || !window.confirm(`Выйти из сообщества «${activeSpace.name}»?`)) return;
    const response = await fetch(`/api/v1/spaces/${activeSpace.id}`, { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "leave" }) });
    const result = await response.json().catch(() => null); if (!response.ok) return window.alert(result?.message ?? "Не удалось выйти.");
    const next = userSpaces.filter((space) => space.id !== activeSpace.id); setUserSpaces(next); setActiveSpaceId(next[0]?.id ?? null);
  }

  async function deleteActiveSpace() {
    if (!activeSpace) return; const name = window.prompt(`Для удаления введите название сервера: ${activeSpace.name}`); if (name !== activeSpace.name) return;
    const response = await fetch(`/api/v1/spaces/${activeSpace.id}`, { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "delete", name }) });
    const result = await response.json().catch(() => null); if (!response.ok) return window.alert(result?.message ?? "Не удалось удалить сервер.");
    const next = userSpaces.filter((space) => space.id !== activeSpace.id); setUserSpaces(next); setActiveSpaceId(next[0]?.id ?? null);
  }

  return (
    <><main className={`app-shell ${showMembers ? "" : "members-hidden"} ${mobileChannelsOpen ? "mobile-channels-open" : ""} ${platformView ? "platform-view-active" : ""}`}>
      <nav className="space-rail" aria-label="Сообщества">
        <button className={`rail-action home-action brand-symbol-wrap ${platformView === "social" ? "active" : ""}`} aria-label="Личные сообщения и друзья" title="Личные сообщения" onClick={() => { setPlatformView("social"); setMobileChannelsOpen(false); }}><BrandMark size={45} /></button>
        {user?.platformRole === "admin" ? <button className={`rail-action platform-admin-rail ${platformView === "admin" ? "active" : ""}`} aria-label="Панель администратора" title="Панель администратора" onClick={() => { setPlatformView("admin"); setMobileChannelsOpen(false); }}><ShieldCheck size={21} /></button> : null}
        <span className="rail-separator" />
        {spacesLoading ? <LoaderCircle className="rail-loader spin" size={20} /> : userSpaces.map((space) => <button key={space.id} className={`space-button ${space.id === activeSpaceId && !platformView ? "active" : ""}`} style={{ background: `linear-gradient(145deg, ${space.accentColor}, #7136ad)` }} aria-label={`Сообщество ${space.name}`} title={space.name} onClick={() => { setPlatformView(null); setActiveSpaceId(space.id); const first = space.channels.find((channel) => channel.kind === "text") ?? space.channels[0]; if (first) selectChannel(first.name, first.id, space.id); }}>{space.iconUrl ? <MediaImage src={space.iconUrl} /> : space.name.slice(0, 2).toLocaleUpperCase("ru")}</button>)}
        <button className="rail-action add-space" aria-label="Добавить сообщество" onClick={() => setShowCreateSpace(true)}><Plus size={22} /></button>
        <button className="rail-action discover" aria-label="Обзор сообществ" onClick={() => setShowDiscovery(true)}><Compass size={21} /></button>
        <div className="rail-bottom"><button className="rail-action" aria-label="Платформа разработчиков" onClick={() => setShowDeveloper(true)}><Code2 size={20} /></button><button className="rail-action" aria-label="Состояние системы" onClick={() => setShowSystemStatus(true)}><HelpCircle size={20} /></button></div>
      </nav>

      {user && platformView ? <section className="platform-workspace" aria-label={platformView === "social" ? "Личное пространство" : "Панель администратора"}>{platformView === "social" ? <SocialHubDialog currentUserId={user.id} embedded isAdmin={user.platformRole === "admin"} onOpenAdmin={() => setPlatformView("admin")} /> : user.platformRole === "admin" ? <AdminDialog embedded /> : null}</section> : null}

      <aside className="channel-panel">
        <button className="mobile-drawer-close" aria-label="Закрыть список каналов" onClick={() => setMobileChannelsOpen(false)}><X size={19} /></button>
        <div className="mobile-space-switcher">{userSpaces.map((space) => <button key={space.id} className={space.id === activeSpaceId ? "active" : ""} style={{ background: `linear-gradient(145deg, ${space.accentColor}, #7136ad)` }} onClick={() => { setActiveSpaceId(space.id); const first = space.channels.find((channel) => channel.kind === "text") ?? space.channels[0]; if (first) selectChannel(first.name, first.id, space.id); }}>{space.name.slice(0, 2).toLocaleUpperCase("ru")}</button>)}<button className="mobile-add-space" onClick={() => setShowCreateSpace(true)}><Plus size={18} /></button></div>
        <div className="space-heading-wrap">
          <button className={`space-heading discord-server-heading ${serverMenuOpen ? "menu-open" : ""}`} aria-haspopup="menu" aria-expanded={serverMenuOpen} aria-label="Открыть меню сервера" onClick={() => activeSpace && setServerMenuOpen((value) => !value)}><span><strong>{activeSpace?.name ?? "FlipZero"}</strong><small>{activeSpace?.description ?? (userSpaces.length ? "Пространство команды" : "Создайте пространство")}</small></span><ChevronDown size={17} /></button>
          {activeSpace ? <div className={`server-sidebar-banner ${activeSpace.bannerUrl ? "has-image" : ""}`} role="img" aria-label={`Баннер сервера ${activeSpace.name}`} style={{ backgroundImage: activeSpace.bannerUrl ? `linear-gradient(180deg, transparent 25%, rgba(8,9,13,.9)), url(${activeSpace.bannerUrl})` : `radial-gradient(circle at 85% 10%, ${activeSpace.accentColor}aa, transparent 46%), linear-gradient(135deg, #181b2b, ${activeSpace.accentColor}55)` }}><span className="server-banner-avatar" style={{ background: `linear-gradient(135deg, ${activeSpace.accentColor}, #b33bd4)` }}>{activeSpace.iconUrl ? <MediaImage src={activeSpace.iconUrl} /> : activeSpace.name.slice(0, 2).toLocaleUpperCase("ru")}</span><span className="server-banner-copy"><strong>{activeSpace.name}</strong><small>{activeSpace.description || "Сообщество FlipZero"}</small></span><span className="server-banner-superup"><Gem size={12} /> SuperUp</span></div> : null}
          {activeSpace && serverMenuOpen ? <ServerContextMenu name={activeSpace.name} canManage={activeSpace.ownerId === user?.id || user?.platformRole === "admin"} isOwner={activeSpace.ownerId === user?.id} onClose={() => setServerMenuOpen(false)} onSettings={() => setShowSpaceSettings(true)} onRoles={() => setShowRoleManager(true)} onInvite={() => setShowInviteManager(true)} onCommunityLink={copyCommunityLink} onProgress={() => setShowGamification(true)} onEvents={() => setShowEvents(true)} onWiki={() => setShowWiki(true)} onMembers={() => setShowMemberManager(true)} onModeration={() => setShowModeration(true)} onSystem={() => setShowSystemStatus(true)} onCreateChannel={() => setCreateChannelTarget({ kind: "text", parentId: null })} onCreateCategory={() => setShowCreateCategory(true)} onAppearance={() => setShowSpaceSettings(true)} onLeave={() => void leaveActiveSpace()} onDelete={() => void deleteActiveSpace()} /> : null}
        </div>
        <div className="channel-scroll">
          {activeSpace ? <>{activeSpace.categories.map((category) => <ChannelGroup key={category.id} title={category.name.toLocaleUpperCase("ru")} onAdd={activeSpace.ownerId === user?.id ? () => setCreateChannelTarget({ kind: "text", parentId: category.id }) : undefined} onDelete={activeSpace.ownerId === user?.id ? () => deleteCategory(category) : undefined}>{activeSpace.channels.filter((channel) => channel.parentId === category.id).map((channel) => <Channel key={channel.id} active={activeChannel === channel.name} icon={channel.kind === "voice" ? <Volume2 size={17} /> : channel.name === "добро-пожаловать" ? <BookOpen size={17} /> : <Hash size={17} />} label={channel.name} voice={channel.kind === "voice"} onSelect={() => selectChannel(channel.name, channel.id, activeSpace.id)} onManage={activeSpace.ownerId === user?.id ? () => setPermissionsChannel(channel) : undefined} onDelete={activeSpace.ownerId === user?.id ? () => deleteChannel(channel) : undefined} />)}</ChannelGroup>)}{activeSpace.channels.some((channel) => !channel.parentId) ? <ChannelGroup title="БЕЗ КАТЕГОРИИ" onAdd={activeSpace.ownerId === user?.id ? () => setCreateChannelTarget({ kind: "text", parentId: null }) : undefined}>{activeSpace.channels.filter((channel) => !channel.parentId).map((channel) => <Channel key={channel.id} active={activeChannel === channel.name} icon={channel.kind === "voice" ? <Volume2 size={17} /> : <Hash size={17} />} label={channel.name} voice={channel.kind === "voice"} onSelect={() => selectChannel(channel.name, channel.id, activeSpace.id)} onManage={activeSpace.ownerId === user?.id ? () => setPermissionsChannel(channel) : undefined} onDelete={activeSpace.ownerId === user?.id ? () => deleteChannel(channel) : undefined} />)}</ChannelGroup> : null}{activeSpace.ownerId === user?.id ? <button className="category-add" onClick={() => setShowCreateCategory(true)}><Plus size={14} /> Новая категория</button> : null}</> : <div className="space-empty"><strong>Здесь пока пусто</strong><span>Создайте первое пространство, чтобы открыть каналы и роли.</span><button onClick={() => setShowCreateSpace(true)}>Создать пространство</button></div>}
        </div>
        <div className="user-dock"><button className="dock-profile" onClick={() => { setAccountSettingsSection("profile"); setMobileChannelsOpen(false); setShowAccountSettings(true); }}><span className="avatar avatar-coral">{user?.avatarUrl ? <MediaImage src={user.avatarUrl} /> : user?.displayName.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toLocaleUpperCase("ru") ?? "AP"}<span className="presence" /></span><span className="dock-copy"><strong>{user?.displayName ?? "Профиль"}</strong><small>Уровень {user?.globalLevel ?? 1}</small></span></button><button aria-label="Выбрать микрофон" title="Выбрать микрофон" onClick={() => { setAccountSettingsSection("voice"); setMobileChannelsOpen(false); setShowAccountSettings(true); }}><Mic size={17} /></button><button aria-label="Выбрать наушники" title="Выбрать наушники" onClick={() => { setAccountSettingsSection("voice"); setMobileChannelsOpen(false); setShowAccountSettings(true); }}><Headphones size={17} /></button><button aria-label="Настройки аккаунта" onClick={() => { setAccountSettingsSection("profile"); setMobileChannelsOpen(false); setShowAccountSettings(true); }}><Settings size={17} /></button></div>
      </aside>

      <section className="chat-panel">
        <header className="chat-header"><button className="mobile-menu-button" aria-label="Открыть сообщества и каналы" onClick={() => setMobileChannelsOpen(true)}><Menu size={20} /></button><div className="channel-title"><Hash size={21} /><strong>{activeChannel}</strong><span>Разговоры обо всём</span></div><div className="header-actions"><button className={`channel-share-action ${channelLinkCopied ? "is-active link-copied" : ""}`} aria-label={channelLinkCopied ? "Ссылка на канал скопирована" : "Поделиться ссылкой на канал"} title={channelLinkCopied ? "Скопировано" : "Поделиться ссылкой на канал"} onClick={shareChannelLink} disabled={!activeRouteChannel}>{channelLinkCopied ? <Check size={18} /> : <><Copy className="desktop-copy-icon" size={18} /><Share2 className="mobile-share-icon" size={18} /></>}</button><button className={notifications ? "is-active" : ""} aria-label={notifications ? "Выключить уведомления" : "Включить уведомления"} aria-pressed={notifications} onClick={() => setNotifications((value) => !value)}><Bell size={19} /></button><button className={showMembers ? "is-active" : ""} aria-label={showMembers ? "Скрыть участников" : "Показать участников"} aria-pressed={showMembers} onClick={() => setShowMembers((value) => !value)}><Users size={19} /></button><label className="search-box"><Search size={16} /><input aria-label="Поиск" placeholder="Поиск" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} /></label></div></header>
        {activeBoardChannel ? <ChannelBoard channelId={activeBoardChannel.id} channelName={activeBoardChannel.name} /> : activeForumChannel ? <ForumChannel channelId={activeForumChannel.id} channelName={activeForumChannel.name} /> : activeVoiceChannel ? <VoiceRoom key={activeVoiceChannel.id} channelId={activeVoiceChannel.id} channelName={activeVoiceChannel.name} /> : activeApiChannel && user ? <PersistentChat key={activeApiChannel.id} channelId={activeApiChannel.id} channelName={activeApiChannel.name} spaceId={activeSpace!.id} currentUserId={user.id} ownerId={activeSpace?.ownerId} searchQuery={searchQuery} /> : <><div className="message-list">
          <div className="channel-intro"><div className="intro-icon"><Hash size={31} /></div><h1>{activeDetails.title}</h1><p>Это начало канала <strong>#{activeChannel}</strong>. {activeDetails.description}</p></div>
          <div className="day-divider"><span>17 сентября 2026</span></div>
          {visibleMessages.map((message) => (
            <article className="message" key={message.name}>
              <div className={`avatar ${message.accent}`}>{message.initials}</div>
              <div className="message-body"><div className="message-meta"><strong>{message.name}</strong>{message.badge && <span className="bot-badge">{message.badge}</span>}<time>{message.time}</time></div><p>{message.text}</p>
                {message.quest && <div className="quest-card"><div className="quest-symbol"><Gift size={22} /></div><div><small>ЕЖЕНЕДЕЛЬНЫЙ ЧЕЛЛЕНДЖ</small><strong>На одной волне</strong><span>Прогресс: 18 из 30 минут</span><div className="progress"><i /></div></div><b>+250 XP</b></div>}
                {message.reactions.length > 0 && <div className="reactions">{message.reactions.map((reaction) => <button key={reaction}>{reaction}</button>)}</div>}
              </div>
            </article>
          ))}
          {visibleMessages.length === 0 && <div className="search-empty"><Search size={24} /><strong>Ничего не найдено</strong><span>Попробуйте изменить поисковый запрос.</span></div>}
        </div>
        <div className="composer-wrap"><div className="typing"><span /><span /><span /> Mira печатает...</div><form className="composer" onSubmit={sendMessage}><button type="button" aria-label="Добавить"><CirclePlus size={22} /></button><textarea aria-label="Сообщение" placeholder={`Написать в #${activeChannel}`} rows={1} value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} /><button type="button" aria-label="Изображение"><ImageIcon size={20} /></button><button type="button" aria-label="Эмодзи"><Smile size={20} /></button><button className="send-button" type="submit" aria-label="Отправить" disabled={!draft.trim()}><SendHorizontal size={18} /></button></form></div></>}
      </section>

      <aside className="member-panel">
        <div className="profile-card"><div className="profile-art"><span>FLIP<br />ZERO</span></div><div className="profile-avatar avatar-coral">AP<span className="presence" /></div><div className="profile-copy"><strong>Alex Push</strong><span>@flipdanger · Основатель</span></div><div className="level-row"><span>Уровень 12</span><b>2 840 / 3 200 XP</b></div><div className="profile-progress"><i /></div><div className="profile-stats"><span><b>24</b><small>дня подряд</small></span><span><b>18</b><small>достижений</small></span><span><b>4</b><small>пути</small></span></div></div>
        <div className="member-section"><h2>В СЕТИ — 4</h2>{members.map((member) => <button className="member" key={member.name}><span className={`mini-avatar ${member.accent}`}>{member.initials}<i /></span><span><strong>{member.name}</strong><small>{member.status}</small></span><b>{member.level}</b></button>)}</div>
        <div className="achievement"><div className="achievement-icon">✦</div><div><small>ПОЧТИ ПОЛУЧЕНО</small><strong>Ранний участник</strong><span>92% выполнено</span></div></div>
      </aside>
      <button className="mobile-drawer-backdrop" aria-label="Закрыть меню каналов" onClick={() => setMobileChannelsOpen(false)} />
      <nav className="mobile-tab-bar" aria-label="Основная навигация"><button className={platformView === "social" ? "active" : ""} onClick={() => { setPlatformView("social"); setMobileChannelsOpen(false); }}><MessageCircle size={20} /><span>Личное</span></button><button onClick={() => setShowDiscovery(true)}><Compass size={20} /><span>Обзор</span></button><button className={mobileChannelsOpen ? "active" : ""} onClick={() => { setPlatformView(null); setMobileChannelsOpen(true); }}><HomeIcon size={20} /><span>Серверы</span></button><button className={!platformView && !mobileChannelsOpen ? "active" : ""} onClick={() => { setPlatformView(null); setMobileChannelsOpen(false); }}><Hash size={20} /><span>Чат</span></button><button onClick={() => { setAccountSettingsSection("profile"); setMobileChannelsOpen(false); setShowAccountSettings(true); }}><UserRound size={20} /><span>Профиль</span></button></nav>
      {user && user.onboardingCompleted === false ? <OnboardingWizard initialStep={user.onboardingStep} onComplete={() => setUser((current) => current ? { ...current, onboardingCompleted: true, onboardingStep: 4 } : current)} /> : null}
    </main>{user && showAccountSettings ? <AccountSettingsDialog user={user} initialSection={accountSettingsSection} onClose={() => setShowAccountSettings(false)} onSaved={setUser} /> : null}{showSystemStatus ? <SystemStatusDialog onClose={() => setShowSystemStatus(false)} /> : null}{showDeveloper ? <DeveloperDialog onClose={() => setShowDeveloper(false)} /> : null}{activeSpace && showWiki ? <WikiDialog spaceId={activeSpace.id} onClose={() => setShowWiki(false)} /> : null}{activeSpace && showEvents ? <EventsDialog spaceId={activeSpace.id} onClose={() => setShowEvents(false)} /> : null}{showDiscovery ? <DiscoveryDialog onClose={() => setShowDiscovery(false)} onJoined={openJoinedSpace} /> : null}{levelUp ? <div className="level-up-toast"><Sparkles size={22} /><div><small>НОВЫЙ УРОВЕНЬ</small><strong>Вы достигли уровня {levelUp}!</strong></div></div> : null}{showCreateSpace ? <CreateSpaceDialog onClose={() => setShowCreateSpace(false)} onCreated={(space) => { setUserSpaces((current) => [...current, space]); setActiveSpaceId(space.id); const first = space.channels.find((channel) => channel.kind === "text"); if (first) selectChannel(first.name, first.id, space.id); setShowCreateSpace(false); }} /> : null}{activeSpace && createChannelTarget ? <CreateChannelDialog spaceId={activeSpace.id} categories={activeSpace.categories} initialKind={createChannelTarget.kind} initialParentId={createChannelTarget.parentId} onClose={() => setCreateChannelTarget(null)} onCreated={addChannel} /> : null}{activeSpace && showCreateCategory ? <CreateCategoryDialog spaceId={activeSpace.id} onClose={() => setShowCreateCategory(false)} onCreated={addCategory} /> : null}{activeSpace && showSpaceSettings ? <SpaceSettingsDialog space={activeSpace} onClose={() => setShowSpaceSettings(false)} onSaved={saveSpaceSettings} /> : null}{activeSpace && showRoleManager ? <RoleManagerDialog spaceId={activeSpace.id} onClose={() => setShowRoleManager(false)} /> : null}{activeSpace && showInviteManager ? <InviteManagerDialog spaceId={activeSpace.id} onClose={() => setShowInviteManager(false)} /> : null}{activeSpace && showMemberManager ? <MemberManagerDialog spaceId={activeSpace.id} onClose={() => setShowMemberManager(false)} /> : null}{activeSpace && permissionsChannel ? <ChannelPermissionsDialog spaceId={activeSpace.id} channel={permissionsChannel} onClose={() => setPermissionsChannel(null)} /> : null}{activeSpace && showModeration ? <ModerationDialog spaceId={activeSpace.id} onClose={() => setShowModeration(false)} /> : null}{activeSpace && showGamification ? <GamificationDialog spaceId={activeSpace.id} isOwner={activeSpace.ownerId === user?.id} onClose={() => setShowGamification(false)} /> : null}</>
  );
}

function ChannelGroup({ title, onAdd, onDelete, children }: { title: string; onAdd?: () => void; onDelete?: () => void; children: React.ReactNode }) {
  return <section className="channel-group"><h2><span>{title}</span><span className="category-actions">{onAdd ? <button aria-label={`Добавить в ${title}`} onClick={onAdd}><Plus size={15} /></button> : null}{onDelete ? <button aria-label={`Удалить категорию ${title}`} onClick={onDelete}><Trash2 size={13} /></button> : null}</span></h2>{children}</section>;
}
function Channel({ icon, label, active = false, badge, voice = false, onSelect, onManage, onDelete }: { icon: React.ReactNode; label: string; active?: boolean; badge?: string; voice?: boolean; onSelect?: () => void; onManage?: () => void; onDelete?: () => void }) {
  return <div className={`channel-row ${active ? "active" : ""}`}><button className="channel" onClick={() => { if (onSelect) onSelect(); else if (!voice) window.dispatchEvent(new CustomEvent("flipzero:select-channel", { detail: label })); }}><span>{icon}</span><strong>{label}</strong>{voice ? <span className="live-pill">LIVE</span> : null}{badge ? <b>{badge}</b> : null}</button>{onManage ? <button className="channel-manage" aria-label={`Настроить права канала ${label}`} onClick={onManage}><Settings2 size={14} /></button> : null}{onDelete ? <button className="channel-delete" aria-label={`Удалить канал ${label}`} onClick={onDelete}><Trash2 size={14} /></button> : null}</div>;
}
