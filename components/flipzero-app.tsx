"use client";

import { type CSSProperties, useEffect, useRef, useState } from "react";
import { BookOpen, Check, ChevronDown, Code2, Compass, Copy, Hash, Headphones, HelpCircle, Home as HomeIcon, LoaderCircle, Menu, MessageCircle, Mic, MicOff, MonitorUp, Plus, Search, Settings, Settings2, Share2, ShieldCheck, Trash2, UserRound, Users, Video, Volume2, X } from "lucide-react";
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
import { VoiceRoom, type VoicePresence } from "@/components/voice-room";
import { DiscoveryDialog } from "@/components/discovery-dialog";
import { EventsDialog } from "@/components/events-dialog";
import { WikiDialog } from "@/components/wiki-dialog";
import { SystemStatusDialog } from "@/components/system-status-dialog";
import { AccountSettingsDialog, type AccountProfile, type AccountSettingsSection } from "@/components/account-settings-dialog";
import { BrandMark } from "@/components/brand-mark";
import { SocialHubDialog } from "@/components/social-hub-dialog";
import { AdminDialog } from "@/components/admin-dialog";
import { NotificationCenter } from "@/components/notification-center";
import { ServerContextMenu } from "@/components/server-context-menu";
import { ConfirmDialog } from "@/components/action-dialogs";
import { OnboardingWizard } from "@/components/onboarding-wizard";

type ApiChannel = { id: string; parentId: string | null; name: string; topic: string | null; kind: string; position?: number };
type ApiCategory = { id: string; spaceId: string; name: string; position: number };
type ApiSpace = { id: string; ownerId?: string; name: string; slug: string; description: string | null; iconUrl?: string | null; bannerUrl?: string | null; visibility?: string; accentColor: string; categories: ApiCategory[]; channels: ApiChannel[] };
type SpaceMember = { userId: string; nickname: string | null; username: string | null; displayName: string; avatarUrl: string | null; level: number; roleIds?: string[]; online?: boolean };
type CurrentUser = AccountProfile;
type AppNotice = { message: string; tone: "error" | "success" };
export default function Home({ initialSpaceId, initialChannelId }: { initialSpaceId?: string; initialChannelId?: string } = {}) {
  const [activeChannel, setActiveChannel] = useState("общий-чат");
  const [voicePresence, setVoicePresence] = useState<Record<string, VoicePresence[]>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [showMembers, setShowMembers] = useState(true);
  const [categoryToDelete, setCategoryToDelete] = useState<ApiCategory | null>(null);
  const [pendingAction, setPendingAction] = useState<{ kind: "leave" | "delete" | "channel"; name: string; id: string } | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    function focusSearch(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchInputRef.current?.focus();
      }
    }
    window.addEventListener("keydown", focusSearch);
    return () => window.removeEventListener("keydown", focusSearch);
  }, []);
  const [user, setUser] = useState<CurrentUser | null>(null);
  useEffect(() => {
    if (!user) return;
    const heartbeat = () => { if (document.visibilityState === "visible") void fetch("/api/v1/presence", { method: "POST" }).catch(() => {}); };
    heartbeat();
    const timer = window.setInterval(heartbeat, 30_000);
    document.addEventListener("visibilitychange", heartbeat);
    return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", heartbeat); };
  }, [user]);
  const [userSpaces, setUserSpaces] = useState<ApiSpace[]>([]);
  const [activeSpaceId, setActiveSpaceId] = useState<string | null>(null);
  const [spacesLoading, setSpacesLoading] = useState(true);
  const [showCreateSpace, setShowCreateSpace] = useState(false);
  const [showDiscovery, setShowDiscovery] = useState(false);
  const [showEvents, setShowEvents] = useState(false);
  const [showWiki, setShowWiki] = useState(false);
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
  const [socialRoute, setSocialRoute] = useState<{ tab: "messages" | "friends" | "superflip"; userId: string | null; nonce: number }>({ tab: "messages", userId: null, nonce: 0 });
  const [mobileChannelsOpen, setMobileChannelsOpen] = useState(false);
  const [channelLinkCopied, setChannelLinkCopied] = useState(false);
  const [, setSpaceLinkCopied] = useState(false);
  const [serverMenuOpen, setServerMenuOpen] = useState(false);
  const [spaceMembers, setSpaceMembers] = useState<SpaceMember[]>([]);
  const [spaceRoles, setSpaceRoles] = useState<Array<{id:string;name:string;color:string;position:number;showInMemberList:boolean}>>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [membersLoadingMore, setMembersLoadingMore] = useState(false);
  const [membersCursor, setMembersCursor] = useState<string | null>(null);
  const [membersTotal, setMembersTotal] = useState(0);
  const [appNotice, setAppNotice] = useState<AppNotice | null>(null);

  useEffect(() => {
    if (!appNotice) return;
    const timeout = window.setTimeout(() => setAppNotice(null), 5000);
    return () => window.clearTimeout(timeout);
  }, [appNotice]);

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

  const activeSpace = userSpaces.find((space) => space.id === activeSpaceId) ?? null;
  useEffect(() => {
    if (!activeSpaceId || !showMembers) return;
    let cancelled = false;
    queueMicrotask(() => { if (!cancelled) setMembersLoading(true); });
    const spaceId = activeSpaceId;
    function refresh(initial = false) {
    fetch(`/api/v1/spaces/${encodeURIComponent(spaceId)}/members?limit=80`, { cache: "no-store" })
      .then((response) => response.ok ? response.json() : { members: [], roles: [], total: 0, nextCursor: null })
      .then((data) => {
        if (cancelled) return;
        setSpaceMembers((current) => initial ? (data.members ?? []) as SpaceMember[] : [...(data.members ?? []), ...current.slice(80)] as SpaceMember[]);
        setSpaceRoles(data.roles ?? []);
        setMembersTotal(Number(data.total ?? data.members?.length ?? 0));
        if (initial) setMembersCursor(data.nextCursor ?? null);
      })
      .catch(() => {
        if (!cancelled) {
          setSpaceMembers([]);
          setMembersTotal(0);
          setMembersCursor(null);
        }
      })
      .finally(() => { if (!cancelled) setMembersLoading(false); });
    }
    refresh(true);
    const timer = window.setInterval(() => { if (document.visibilityState === "visible") refresh(); }, 30_000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [activeSpaceId, showMembers]);

  async function loadMoreMembers() {
    if (!activeSpaceId || !membersCursor || membersLoadingMore) return;
    setMembersLoadingMore(true);
    try {
      const response = await fetch(`/api/v1/spaces/${encodeURIComponent(activeSpaceId)}/members?limit=80&cursor=${encodeURIComponent(membersCursor)}`, { cache: "no-store" });
      if (!response.ok) return;
      const data = await response.json();
      setSpaceMembers((current) => {
        const known = new Set(current.map((member) => member.userId));
        return [...current, ...((data.members ?? []) as SpaceMember[]).filter((member) => !known.has(member.userId))];
      });
      setMembersTotal(Number(data.total ?? membersTotal));
      setMembersCursor(data.nextCursor ?? null);
    } finally {
      setMembersLoadingMore(false);
    }
  }
  useEffect(() => {
    if (!activeSpaceId) return;
    let cancelled = false;
    const refresh = async () => {
      const response = await fetch(`/api/v1/spaces/${encodeURIComponent(activeSpaceId)}/voice-presence`, { cache: "no-store" }).catch(() => null);
      if (!response?.ok || cancelled) return;
      const data = await response.json();
      if (!cancelled) setVoicePresence(data.channels ?? {});
    };
    void refresh();
    const interval = window.setInterval(refresh, 5000);
    return () => { cancelled = true; window.clearInterval(interval); };
  }, [activeSpaceId]);
  const activeRouteChannel = activeSpace?.channels.find((channel) => channel.name === activeChannel) ?? null;
  const activeApiChannel = activeSpace?.channels.find((channel) => channel.name === activeChannel && ["text", "forum", "announcement"].includes(channel.kind)) ?? null;
  const activeBoardChannel = activeSpace?.channels.find((channel) => channel.name === activeChannel && channel.kind === "board") ?? null;
  const activeForumChannel = activeSpace?.channels.find((channel) => channel.name === activeChannel && channel.kind === "forum") ?? null;
  const activeVoiceChannel = activeSpace?.channels.find((channel) => channel.name === activeChannel && channel.kind === "voice") ?? null;
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

  function selectChannel(channel: string, channelId?: string, spaceId?: string) {
    setActiveChannel(channel);
    setSearchQuery("");
    setMobileChannelsOpen(false);
    if (channelId && spaceId && window.location.pathname !== `/channels/${spaceId}/${channelId}`) window.history.pushState({}, "", `/channels/${spaceId}/${channelId}`);
  }

  function addChannel(channel: CreatedChannel) {
    setUserSpaces((current) => current.map((space) => space.id === channel.spaceId ? { ...space, channels: [...space.channels, channel] } : space));
    if (channel.kind !== "voice") selectChannel(channel.name, channel.id, channel.spaceId);
    setCreateChannelTarget(null);
  }

  async function deleteChannel(channel: ApiChannel) {
    if (!activeSpace) return;
    const response = await fetch(`/api/v1/spaces/${activeSpace.id}/channels?channelId=${channel.id}`, { method: "DELETE" });
    const result = await response.json();
    if (!response.ok) { setAppNotice({ message: result.message ?? "Не удалось удалить канал.", tone: "error" }); return; }
    const nextChannels = activeSpace.channels.filter((item) => item.id !== channel.id);
    setUserSpaces((current) => current.map((space) => space.id === activeSpace.id ? { ...space, channels: nextChannels } : space));
    if (activeChannel === channel.name) { const next = nextChannels.find((item) => item.kind === "text") ?? nextChannels[0]; if (next) selectChannel(next.name, next.id, activeSpace.id); }
  }

  function addCategory(category: CreatedCategory) {
    setUserSpaces((current) => current.map((space) => space.id === category.spaceId ? { ...space, categories: [...space.categories, category] } : space));
    setShowCreateCategory(false);
  }

  async function deleteCategory(category: ApiCategory) {
    if (!activeSpace) return;
    const response = await fetch(`/api/v1/spaces/${activeSpace.id}/categories?categoryId=${category.id}`, { method: "DELETE" });
    const result = await response.json();
    if (!response.ok) { setAppNotice({ message: result.message ?? "Не удалось удалить категорию.", tone: "error" }); return; }
    setUserSpaces((current) => current.map((space) => space.id === activeSpace.id ? { ...space, categories: space.categories.filter((item) => item.id !== category.id), channels: space.channels.map((channel) => channel.parentId === category.id ? { ...channel, parentId: null } : channel) } : space));
    setCategoryToDelete(null);
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
    if (!activeSpace) return;
    const response = await fetch(`/api/v1/spaces/${activeSpace.id}`, { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "leave" }) });
    const result = await response.json().catch(() => null); if (!response.ok) { setAppNotice({ message: result?.message ?? "Не удалось выйти.", tone: "error" }); return; }
    const next = userSpaces.filter((space) => space.id !== activeSpace.id); setUserSpaces(next); setActiveSpaceId(next[0]?.id ?? null);
  }

  async function deleteActiveSpace() {
    if (!activeSpace) return; const name = activeSpace.name;
    const response = await fetch(`/api/v1/spaces/${activeSpace.id}`, { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "delete", name }) });
    const result = await response.json().catch(() => null); if (!response.ok) { setAppNotice({ message: result?.message ?? "Не удалось удалить сервер.", tone: "error" }); return; }
    const next = userSpaces.filter((space) => space.id !== activeSpace.id); setUserSpaces(next); setActiveSpaceId(next[0]?.id ?? null);
  }

  return (
    <><main className={`app-shell ${showMembers && activeSpace ? "" : "members-hidden"} ${mobileChannelsOpen ? "mobile-channels-open" : ""} ${platformView ? "platform-view-active" : ""}`}>
      <nav className="space-rail" aria-label="Сообщества">
        <button className={`rail-action home-action brand-symbol-wrap ${platformView === "social" ? "active" : ""}`} aria-label="Личные сообщения и друзья" title="Личные сообщения" onClick={() => { setPlatformView("social"); setMobileChannelsOpen(false); }}><BrandMark size={45} /></button>
        {user?.platformRole === "admin" ? <button className={`rail-action platform-admin-rail ${platformView === "admin" ? "active" : ""}`} aria-label="Панель администратора" title="Панель администратора" onClick={() => { setPlatformView("admin"); setMobileChannelsOpen(false); }}><ShieldCheck size={21} /></button> : null}
        <span className="rail-separator" />
        {spacesLoading ? <LoaderCircle className="rail-loader spin" size={20} /> : userSpaces.map((space) => <button key={space.id} className={`space-button ${space.id === activeSpaceId && !platformView ? "active" : ""}`} style={{ background: `linear-gradient(145deg, ${space.accentColor}, #7136ad)` }} aria-label={`Сообщество ${space.name}`} title={space.name} onClick={() => { setPlatformView(null); setActiveSpaceId(space.id); const first = space.channels.find((channel) => channel.kind === "text") ?? space.channels[0]; if (first) selectChannel(first.name, first.id, space.id); }}>{space.iconUrl ? <MediaImage src={space.iconUrl} /> : space.name.slice(0, 2).toLocaleUpperCase("ru")}</button>)}
        <button className="rail-action add-space" aria-label="Добавить сообщество" title="Создать пространство" onClick={() => setShowCreateSpace(true)}><Plus size={22} /></button>
        <button className="rail-action discover" aria-label="Обзор сообществ" title="Обзор пространств" onClick={() => setShowDiscovery(true)}><Compass size={21} /></button>
        <div className="rail-bottom"><a className="rail-action" href="/developers/console" aria-label="Платформа разработчиков" title="Платформа разработчиков"><Code2 size={20} /></a><button className="rail-action" aria-label="Состояние системы" title="Состояние системы" onClick={() => setShowSystemStatus(true)}><HelpCircle size={20} /></button></div>
      </nav>

      {user && platformView ? <section className="platform-workspace" aria-label={platformView === "social" ? "Личное пространство" : "Панель администратора"}>{platformView === "social" ? <SocialHubDialog key={`${socialRoute.tab}:${socialRoute.userId ?? ""}:${socialRoute.nonce}`} currentUserId={user.id} embedded initialTab={socialRoute.tab} initialUserId={socialRoute.userId} isAdmin={user.platformRole === "admin"} onOpenAdmin={() => setPlatformView("admin")} /> : user.platformRole === "admin" ? <AdminDialog embedded /> : null}</section> : null}

      <aside className={`channel-panel ${activeSpace ? "has-server-banner" : ""}`}>
        <button className="mobile-drawer-close" aria-label="Закрыть список каналов" onClick={() => setMobileChannelsOpen(false)}><X size={19} /></button>
        <div className="mobile-space-switcher">{userSpaces.map((space) => <button key={space.id} className={space.id === activeSpaceId ? "active" : ""} style={{ background: `linear-gradient(145deg, ${space.accentColor}, #7136ad)` }} onClick={() => { setActiveSpaceId(space.id); const first = space.channels.find((channel) => channel.kind === "text") ?? space.channels[0]; if (first) selectChannel(first.name, first.id, space.id); }}>{space.name.slice(0, 2).toLocaleUpperCase("ru")}</button>)}<button className="mobile-add-space" onClick={() => setShowCreateSpace(true)}><Plus size={18} /></button></div>
        <div className={`space-heading-wrap ${activeSpace ? "has-server-banner" : ""}`}>
          <button className={`space-heading discord-server-heading ${serverMenuOpen ? "menu-open" : ""}`} aria-haspopup="menu" aria-expanded={serverMenuOpen} aria-label="Открыть меню пространства" onClick={() => activeSpace && setServerMenuOpen((value) => !value)}><span><strong>{activeSpace?.name ?? "FlipZero"}</strong><small>{activeSpace?.description ?? (userSpaces.length ? "Пространство команды" : "Создайте пространство")}</small></span><ChevronDown size={17} /></button>
          {activeSpace && serverMenuOpen ? <ServerContextMenu name={activeSpace.name} canManage={activeSpace.ownerId === user?.id || user?.platformRole === "admin"} isOwner={activeSpace.ownerId === user?.id} onClose={() => setServerMenuOpen(false)} onSettings={() => setShowSpaceSettings(true)} onRoles={() => setShowRoleManager(true)} onInvite={() => setShowInviteManager(true)} onCommunityLink={copyCommunityLink} onCopyId={() => { void navigator.clipboard.writeText(activeSpace.id).then(() => setAppNotice({ message: "ID пространства скопирован.", tone: "success" })).catch(() => setAppNotice({ message: "Не удалось скопировать ID.", tone: "error" })); }} onProgress={() => setShowGamification(true)} onEvents={() => setShowEvents(true)} onWiki={() => setShowWiki(true)} onMembers={() => setShowMemberManager(true)} onModeration={() => setShowModeration(true)} onCreateChannel={() => setCreateChannelTarget({ kind: "text", parentId: null })} onCreateCategory={() => setShowCreateCategory(true)} onLeave={() => activeSpace && setPendingAction({ kind: "leave", name: activeSpace.name, id: activeSpace.id })} onDelete={() => activeSpace && setPendingAction({ kind: "delete", name: activeSpace.name, id: activeSpace.id })} /> : null}
        </div>
        {activeSpace ? <div className={`server-sidebar-banner ${activeSpace.bannerUrl ? "has-image" : ""}`} role="img" aria-label={`Баннер пространства ${activeSpace.name}`} style={{ backgroundImage: activeSpace.bannerUrl ? `linear-gradient(180deg, transparent 25%, rgba(8,9,13,.9)), url(${activeSpace.bannerUrl})` : `radial-gradient(circle at 85% 10%, ${activeSpace.accentColor}aa, transparent 46%), linear-gradient(135deg, #181b2b, ${activeSpace.accentColor}55)` }}><span className="server-banner-avatar" style={{ background: `linear-gradient(135deg, ${activeSpace.accentColor}, #b33bd4)` }}>{activeSpace.iconUrl ? <MediaImage src={activeSpace.iconUrl} /> : activeSpace.name.slice(0, 2).toLocaleUpperCase("ru")}</span></div> : null}
        <div className="channel-scroll">
          {activeSpace ? <>{activeSpace.categories.map((category) => <ChannelGroup key={category.id} title={category.name.toLocaleUpperCase("ru")} onAdd={activeSpace.ownerId === user?.id ? () => setCreateChannelTarget({ kind: "text", parentId: category.id }) : undefined} onDelete={activeSpace.ownerId === user?.id ? () => setCategoryToDelete(category) : undefined}>{activeSpace.channels.filter((channel) => channel.parentId === category.id).map((channel) => <Channel key={channel.id} active={activeChannel === channel.name} icon={channel.kind === "voice" ? <Volume2 size={17} /> : channel.name === "добро-пожаловать" ? <BookOpen size={17} /> : <Hash size={17} />} label={channel.name} voice={channel.kind === "voice"} participants={voicePresence[channel.id]} onSelect={() => selectChannel(channel.name, channel.id, activeSpace.id)} onManage={activeSpace.ownerId === user?.id ? () => setPermissionsChannel(channel) : undefined} onDelete={activeSpace.ownerId === user?.id ? () => setPendingAction({ kind: "channel", name: channel.name, id: channel.id }) : undefined} />)}</ChannelGroup>)}{activeSpace.channels.some((channel) => !channel.parentId) ? <ChannelGroup title="БЕЗ КАТЕГОРИИ" onAdd={activeSpace.ownerId === user?.id ? () => setCreateChannelTarget({ kind: "text", parentId: null }) : undefined}>{activeSpace.channels.filter((channel) => !channel.parentId).map((channel) => <Channel key={channel.id} active={activeChannel === channel.name} icon={channel.kind === "voice" ? <Volume2 size={17} /> : <Hash size={17} />} label={channel.name} voice={channel.kind === "voice"} participants={voicePresence[channel.id]} onSelect={() => selectChannel(channel.name, channel.id, activeSpace.id)} onManage={activeSpace.ownerId === user?.id ? () => setPermissionsChannel(channel) : undefined} onDelete={activeSpace.ownerId === user?.id ? () => setPendingAction({ kind: "channel", name: channel.name, id: channel.id }) : undefined} />)}</ChannelGroup> : null}{activeSpace.ownerId === user?.id ? <button className="category-add" onClick={() => setShowCreateCategory(true)}><Plus size={14} /> Новая категория</button> : null}</> : <div className="space-empty"><strong>Здесь пока пусто</strong><span>Создайте первое пространство, чтобы открыть каналы и роли.</span><button onClick={() => setShowCreateSpace(true)}>Создать пространство</button></div>}
        </div>
        <div className="user-dock"><button className="dock-profile" onClick={() => { setAccountSettingsSection("profile"); setMobileChannelsOpen(false); setShowAccountSettings(true); }}><span className="avatar avatar-coral">{user?.avatarUrl ? <MediaImage src={user.avatarUrl} /> : user?.displayName.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toLocaleUpperCase("ru") ?? "AP"}<span className="presence" /></span><span className="dock-copy"><strong>{user?.displayName ?? "Профиль"}</strong><small>Уровень {user?.globalLevel ?? 1}</small></span></button><button aria-label="Выбрать микрофон" title="Выбрать микрофон" onClick={() => { setAccountSettingsSection("voice"); setMobileChannelsOpen(false); setShowAccountSettings(true); }}><Mic size={17} /></button><button aria-label="Выбрать наушники" title="Выбрать наушники" onClick={() => { setAccountSettingsSection("voice"); setMobileChannelsOpen(false); setShowAccountSettings(true); }}><Headphones size={17} /></button><button aria-label="Настройки аккаунта" onClick={() => { setAccountSettingsSection("profile"); setMobileChannelsOpen(false); setShowAccountSettings(true); }}><Settings size={17} /></button></div>
      </aside>

      <section className="chat-panel">
        <header className="chat-header"><button className="mobile-menu-button" aria-label="Открыть сообщества и каналы" onClick={() => setMobileChannelsOpen(true)}><Menu size={20} /></button><div className="channel-title"><Hash size={21} /><strong>{activeRouteChannel?.name ?? "Чат"}</strong><span>{activeRouteChannel?.topic ?? (activeSpace ? activeSpace.name : "Выберите пространство")}</span></div><div className="header-actions"><button className={`channel-share-action ${channelLinkCopied ? "is-active link-copied" : ""}`} aria-label={channelLinkCopied ? "Ссылка на канал скопирована" : "Поделиться ссылкой на канал"} title={channelLinkCopied ? "Скопировано" : "Поделиться ссылкой на канал"} onClick={shareChannelLink} disabled={!activeRouteChannel}>{channelLinkCopied ? <Check size={18} /> : <><Copy className="desktop-copy-icon" size={18} /><Share2 className="mobile-share-icon" size={18} /></>}</button><NotificationCenter onOpenMessages={(userId) => { setSocialRoute((route) => ({ tab: "messages", userId, nonce: route.nonce + 1 })); setPlatformView("social"); }} onOpenFriends={() => { setSocialRoute((route) => ({ tab: "friends", userId: null, nonce: route.nonce + 1 })); setPlatformView("social"); }} /><button className={showMembers ? "is-active" : ""} aria-label={showMembers ? "Скрыть участников" : "Показать участников"} aria-pressed={showMembers} onClick={() => setShowMembers((value) => !value)}><Users size={19} /></button><label className="search-box"><Search size={16} /><input ref={searchInputRef} aria-label="Поиск" placeholder="Поиск · Ctrl+K" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} /></label></div></header>
        {activeBoardChannel ? <ChannelBoard channelId={activeBoardChannel.id} channelName={activeBoardChannel.name} /> : activeForumChannel ? <ForumChannel channelId={activeForumChannel.id} channelName={activeForumChannel.name} /> : activeVoiceChannel ? <VoiceRoom key={activeVoiceChannel.id} channelId={activeVoiceChannel.id} channelName={activeVoiceChannel.name} autoJoin onPresenceChange={(participants) => setVoicePresence((current) => ({ ...current, [activeVoiceChannel.id]: participants }))} /> : activeApiChannel && user ? <PersistentChat key={activeApiChannel.id} channelId={activeApiChannel.id} channelName={activeApiChannel.name} spaceId={activeSpace!.id} currentUserId={user.id} ownerId={activeSpace?.ownerId} searchQuery={searchQuery} onOpenDirect={(userId) => { setSocialRoute((route) => ({ tab: "messages", userId, nonce: route.nonce + 1 })); setPlatformView("social"); }} /> : <div className="message-list"><div className="search-empty app-empty-state"><Hash size={28} /><strong>{spacesLoading ? "Загружаем пространства…" : activeSpace ? "Выберите канал" : "Создайте пространство"}</strong><span>{activeSpace ? "Выберите канал слева, чтобы открыть переписку." : "Создайте пространство, чтобы начать общение и пригласить участников."}</span>{!spacesLoading && !activeSpace ? <button type="button" onClick={() => setShowCreateSpace(true)}>Создать пространство</button> : null}</div></div>}
      </section>

      <aside className="member-panel">
        <div className="member-section real-member-list"><h2>УЧАСТНИКИ — {membersTotal || spaceMembers.length}<small>В сети: {spaceMembers.filter((member) => member.online).length}</small></h2>{membersLoading ? <div className="members-loading">Загрузка участников…</div> : spaceMembers.length ? <>{[...spaceMembers].sort((a, b) => Number(Boolean(b.online)) - Number(Boolean(a.online))).map((member) => <button className={`member ${member.online ? "is-online" : "is-offline"}`} key={member.userId} title={member.online ? "В сети" : "Не в сети"}><span className="mini-avatar avatar-coral">{member.avatarUrl ? <MediaImage src={member.avatarUrl} /> : (member.displayName || member.username || "?").slice(0, 2).toLocaleUpperCase("ru")}<i /></span><span><strong>{member.nickname || member.displayName}</strong><small>@{member.username || "участник"} · {member.online ? "в сети" : "не в сети"}</small></span>{(()=>{const role=spaceRoles.filter(item=>item.showInMemberList&&(member.userId===activeSpace?.ownerId?item.name==="Владелец":member.roleIds?.includes(item.id))).sort((a,b)=>b.position-a.position)[0];return role?<b className="member-role-badge" style={{"--role-color":role.color} as CSSProperties}>{role.name}</b>:null})()}</button>)}{membersCursor ? <button className="members-load-more" onClick={() => void loadMoreMembers()} disabled={membersLoadingMore}>{membersLoadingMore ? <><LoaderCircle className="spin" size={14} /> Загружаем…</> : "Показать ещё"}</button> : null}</> : <div className="members-loading">В этом пространстве пока нет участников.</div>}</div>
      </aside>
      <button className="mobile-drawer-backdrop" aria-label="Закрыть меню каналов" onClick={() => setMobileChannelsOpen(false)} />
      <nav className="mobile-tab-bar" aria-label="Основная навигация"><button className={platformView === "social" ? "active" : ""} onClick={() => { setPlatformView("social"); setMobileChannelsOpen(false); }}><MessageCircle size={20} /><span>Личное</span></button><button onClick={() => setShowDiscovery(true)}><Compass size={20} /><span>Обзор</span></button><button className={mobileChannelsOpen ? "active" : ""} onClick={() => { setPlatformView(null); setMobileChannelsOpen(true); }}><HomeIcon size={20} /><span>Пространства</span></button><button className={!platformView && !mobileChannelsOpen ? "active" : ""} onClick={() => { setPlatformView(null); setMobileChannelsOpen(false); }}><Hash size={20} /><span>Чат</span></button><button onClick={() => { setAccountSettingsSection("profile"); setMobileChannelsOpen(false); setShowAccountSettings(true); }}><UserRound size={20} /><span>Профиль</span></button></nav>
      {user && user.onboardingCompleted === false ? <OnboardingWizard initialStep={user.onboardingStep} onComplete={() => setUser((current) => current ? { ...current, onboardingCompleted: true, onboardingStep: 4 } : current)} /> : null}
    </main>{pendingAction ? <ConfirmDialog title={pendingAction.kind === "leave" ? `Выйти из «${pendingAction.name}»?` : pendingAction.kind === "delete" ? `Удалить пространство «${pendingAction.name}»?` : `Удалить канал «${pendingAction.name}»?`} description={pendingAction.kind === "leave" ? "Вы покинете пространство и потеряете доступ к его каналам." : pendingAction.kind === "delete" ? "Все каналы, сообщения и настройки пространства будут удалены. Это действие нельзя отменить." : "Сообщения в этом канале будут удалены. Это действие нельзя отменить."} confirmLabel={pendingAction.kind === "leave" ? "Выйти" : "Удалить"} confirmationText={pendingAction.kind === "delete" ? pendingAction.name : undefined} destructive onCancel={() => setPendingAction(null)} onConfirm={() => { const action = pendingAction; setPendingAction(null); if (action.kind === "leave") void leaveActiveSpace(); else if (action.kind === "delete") void deleteActiveSpace(); else { const channel = activeSpace?.channels.find((item) => item.id === action.id); if (channel) void deleteChannel(channel); } }} /> : null}{categoryToDelete ? <ConfirmDialog title={`Удалить категорию «${categoryToDelete.name}»?`} description="Каналы останутся в пространстве без категории." confirmLabel="Удалить категорию" destructive onCancel={() => setCategoryToDelete(null)} onConfirm={() => void deleteCategory(categoryToDelete)} /> : null}{appNotice ? <div className={`app-toast app-toast-${appNotice.tone}`} role={appNotice.tone === "error" ? "alert" : "status"} aria-live="polite"><span>{appNotice.message}</span><button type="button" aria-label="Закрыть уведомление" onClick={() => setAppNotice(null)}><X size={16} /></button></div> : null}{user && showAccountSettings ? <AccountSettingsDialog user={user} initialSection={accountSettingsSection} onClose={() => setShowAccountSettings(false)} onSaved={setUser} /> : null}{showSystemStatus ? <SystemStatusDialog onClose={() => setShowSystemStatus(false)} /> : null}{activeSpace && showWiki ? <WikiDialog spaceId={activeSpace.id} onClose={() => setShowWiki(false)} /> : null}{activeSpace && showEvents ? <EventsDialog spaceId={activeSpace.id} onClose={() => setShowEvents(false)} /> : null}{showDiscovery ? <DiscoveryDialog onClose={() => setShowDiscovery(false)} onJoined={openJoinedSpace} /> : null}{showCreateSpace ? <CreateSpaceDialog onClose={() => setShowCreateSpace(false)} onCreated={(space) => { setUserSpaces((current) => [...current, space]); setActiveSpaceId(space.id); const first = space.channels.find((channel) => channel.kind === "text"); if (first) selectChannel(first.name, first.id, space.id); setShowCreateSpace(false); }} /> : null}{activeSpace && createChannelTarget ? <CreateChannelDialog spaceId={activeSpace.id} categories={activeSpace.categories} initialKind={createChannelTarget.kind} initialParentId={createChannelTarget.parentId} onClose={() => setCreateChannelTarget(null)} onCreated={addChannel} /> : null}{activeSpace && showCreateCategory ? <CreateCategoryDialog spaceId={activeSpace.id} onClose={() => setShowCreateCategory(false)} onCreated={addCategory} /> : null}{activeSpace && showSpaceSettings ? <SpaceSettingsDialog space={activeSpace} onClose={() => setShowSpaceSettings(false)} onSaved={saveSpaceSettings} onRoles={() => { setShowSpaceSettings(false); setShowRoleManager(true); }} onMembers={() => { setShowSpaceSettings(false); setShowMemberManager(true); }} onInvites={() => { setShowSpaceSettings(false); setShowInviteManager(true); }} onModeration={() => { setShowSpaceSettings(false); setShowModeration(true); }} onProgress={() => { setShowSpaceSettings(false); setShowGamification(true); }} /> : null}{activeSpace && showRoleManager ? <RoleManagerDialog spaceId={activeSpace.id} onClose={() => setShowRoleManager(false)} /> : null}{activeSpace && showInviteManager ? <InviteManagerDialog spaceId={activeSpace.id} onClose={() => setShowInviteManager(false)} /> : null}{activeSpace && showMemberManager ? <MemberManagerDialog spaceId={activeSpace.id} onClose={() => setShowMemberManager(false)} /> : null}{activeSpace && permissionsChannel ? <ChannelPermissionsDialog spaceId={activeSpace.id} channel={permissionsChannel} onClose={() => setPermissionsChannel(null)} /> : null}{activeSpace && showModeration ? <ModerationDialog spaceId={activeSpace.id} onClose={() => setShowModeration(false)} /> : null}{activeSpace && showGamification ? <GamificationDialog spaceId={activeSpace.id} isOwner={activeSpace.ownerId === user?.id} onClose={() => setShowGamification(false)} /> : null}</>
  );
}

function ChannelGroup({ title, onAdd, onDelete, children }: { title: string; onAdd?: () => void; onDelete?: () => void; children: React.ReactNode }) {
  return <section className="channel-group"><h2><span>{title}</span><span className="category-actions">{onAdd ? <button aria-label={`Добавить в ${title}`} onClick={onAdd}><Plus size={15} /></button> : null}{onDelete ? <button aria-label={`Удалить категорию ${title}`} onClick={onDelete}><Trash2 size={13} /></button> : null}</span></h2>{children}</section>;
}
function Channel({ icon, label, active = false, badge, voice = false, participants = [], onSelect, onManage, onDelete }: { icon: React.ReactNode; label: string; active?: boolean; badge?: string; voice?: boolean; participants?: VoicePresence[]; onSelect?: () => void; onManage?: () => void; onDelete?: () => void }) {
  return <div className={`channel-row ${active ? "active" : ""}`}><button className="channel" onClick={() => { if (onSelect) onSelect(); else if (!voice) window.dispatchEvent(new CustomEvent("flipzero:select-channel", { detail: label })); }}><span>{icon}</span><strong>{label}</strong>{voice && participants.length ? <span className="live-pill">{participants.length}</span> : null}{badge ? <b>{badge}</b> : null}</button>{onManage ? <button className="channel-manage" aria-label={`Настроить права канала ${label}`} onClick={onManage}><Settings2 size={14} /></button> : null}{onDelete ? <button className="channel-delete" aria-label={`Удалить канал ${label}`} onClick={onDelete}><Trash2 size={14} /></button> : null}{voice && participants.length ? <div className="voice-channel-participants">{participants.map((participant) => <button key={participant.id} type="button" onClick={(event) => { event.stopPropagation(); onSelect?.(); }} className={participant.speaking ? "speaking" : ""} title={`${participant.name}${participant.sharing ? " · демонстрация экрана" : participant.camera ? " · камера" : participant.muted ? " · микрофон выключен" : " · в голосовом канале"}`}><span>{participant.name.slice(0, 2).toLocaleUpperCase("ru")}</span><strong>{participant.name}</strong>{participant.sharing ? <MonitorUp size={12} /> : participant.camera ? <Video size={12} /> : participant.muted ? <MicOff size={12} /> : <Mic size={12} />}</button>)}</div> : null}</div>;
}
