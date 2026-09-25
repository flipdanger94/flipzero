"use client";
import { ClanTag } from "./clan-tag";

import { type PointerEvent as ReactPointerEvent, useEffect, useRef, useState } from "react";
import { Bell, BookOpen, Check, ChevronDown, Columns3, Compass, Copy, Hash, Headphones, HelpCircle, Home as HomeIcon, LoaderCircle, Lock, Menu, MessageCircle, MessagesSquare, Mic, MicOff, MonitorUp, PhoneOff, Plus, Radio, Search, Settings2, Share2, ShieldCheck, Signal, Swords, Trash2, UserRound, Users, Video, Volume2, X } from "lucide-react";
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
import { normalizeVoicePresence } from "@/lib/voice-presence";
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
import { UserDock } from "@/components/user-dock";
import { UserProfilePopover } from "@/components/user-profile-popover";
import { OnboardingWizard } from "@/components/onboarding-wizard";
import { ClanHub } from "@/components/clan-hub";
import { GlobalSearch } from "@/components/global-search";
import { PreferencesProvider } from "@/components/preferences-provider";
import { IncomingDirectCall } from "@/components/incoming-direct-call";

type ApiChannel = { id: string; parentId: string | null; name: string; topic: string | null; kind: string; position?: number; userLimit?: number | null };
const channelKindLabels: Record<string, string> = { text: "Текстовый канал", voice: "Голосовой канал", stage: "Сцена", forum: "Форум", announcement: "Объявления", board: "Доска" };
function channelIcon(channel: ApiChannel) {
  if (channel.kind === "voice") return <Volume2 size={17} />;
  if (channel.kind === "stage") return <Radio size={17} />;
  if (channel.kind === "forum") return <MessagesSquare size={17} />;
  if (channel.kind === "announcement") return <Bell size={17} />;
  if (channel.kind === "board") return <Columns3 size={17} />;
  return channel.name === "добро-пожаловать" ? <BookOpen size={17} /> : <Hash size={17} />;
}
type ApiCategory = { id: string; spaceId: string; name: string; position: number };
type ApiSpace = { id: string; ownerId?: string; name: string; slug: string; description: string | null; iconUrl?: string | null; bannerUrl?: string | null; visibility?: string; accentColor: string; categories: ApiCategory[]; channels: ApiChannel[] };
type SpaceMember = { clan?:import("./clan-tag").ClanTagData|null; userId: string; nickname: string | null; username: string | null; displayName: string; avatarUrl: string | null; level: number; roleIds?: string[]; online?: boolean };
type CurrentUser = AccountProfile;
type AppNotice = { message: string; tone: "error" | "success" };
export default function Home({ initialSpaceId, initialChannelId }: { initialSpaceId?: string; initialChannelId?: string } = {}) {
  const [activeChannel, setActiveChannel] = useState("общий-чат");
  const [voicePresence, setVoicePresence] = useState<Record<string, VoicePresence[]>>({});
  const [voiceManage, setVoiceManage] = useState<Record<string, boolean>>({});
  const [voiceStreamTarget, setVoiceStreamTarget] = useState<{ channelId: string; participantId: string } | null>(null);
  const [voiceProfile, setVoiceProfile] = useState<{ id: string; name: string } | null>(null);
  const [voiceSession, setVoiceSession] = useState<{ connected: boolean; channelId: string; channelName: string; spaceName?: string } | null>(null);
  const [pendingVoiceSwitch, setPendingVoiceSwitch] = useState<{ channel: ApiChannel; participantId?: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [globalSearchOpen, setGlobalSearchOpen] = useState(false);
  const [showMembers, setShowMembers] = useState(true);
  const [categoryToDelete, setCategoryToDelete] = useState<ApiCategory | null>(null);
  const [pendingAction, setPendingAction] = useState<{ kind: "leave" | "delete" | "channel"; name: string; id: string } | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    function focusSearch(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setGlobalSearchOpen(true);
      }
    }
    window.addEventListener("keydown", focusSearch);
    return () => window.removeEventListener("keydown", focusSearch);
  }, []);
  const [user, setUser] = useState<CurrentUser | null>(null);
  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ connected?: boolean; channelId?: string; channelName?: string; spaceName?: string }>).detail;
      if (!detail?.connected) { setVoiceSession(null); return; }
      if (detail.channelId && detail.channelName) setVoiceSession({ connected: true, channelId: detail.channelId, channelName: detail.channelName, spaceName: detail.spaceName });
    };
    window.addEventListener("flipzero:voice-session", handler);
    return () => window.removeEventListener("flipzero:voice-session", handler);
  }, []);
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
  const [platformView, setPlatformView] = useState<"social" | "admin" | "clans" | null>(null);
  function openPlatformView(view:"social"|"admin"|"clans", replace=false){
    setPlatformView(view);setMobileChannelsOpen(false);
    const query=view==="social"?"?view=personal":view==="admin"?"?view=admin":"?view=clans";
    const next=`/app${query}`;
    if(window.location.pathname+window.location.search!==next) window.history[replace?"replaceState":"pushState"]({}, "", next);
  }
  useEffect(()=>{
    const sync=()=>{
      if(window.location.pathname.startsWith("/channels/")){setPlatformView(null);return}
      if(window.location.pathname!=="/app")return;
      const params=new URLSearchParams(window.location.search);
      if(params.get("clan"))setPlatformView("clans");
      else if(params.get("view")==="personal")setPlatformView("social");
      else if(params.get("view")==="admin")setPlatformView("admin");
      else if(params.get("view")==="clans")setPlatformView("clans");
    };
    sync();window.addEventListener("popstate",sync);return()=>window.removeEventListener("popstate",sync);
  },[]);
  useEffect(()=>{const open=(event:Event)=>{const id=(event as CustomEvent<string>).detail;setPlatformView("clans");window.history.replaceState(null,"",`/app?clan=${encodeURIComponent(id)}`);window.dispatchEvent(new CustomEvent("flipzero:clan-selected",{detail:id}));};window.addEventListener("flipzero:open-clan",open);return()=>window.removeEventListener("flipzero:open-clan",open)},[]);
  const [socialRoute, setSocialRoute] = useState<{ tab: "messages" | "friends" | "superflip"; userId: string | null; nonce: number }>({ tab: "messages", userId: null, nonce: 0 });
  const [mobileChannelsOpen, setMobileChannelsOpen] = useState(false);
  const [channelLinkCopied, setChannelLinkCopied] = useState(false);
  const [, setSpaceLinkCopied] = useState(false);
  const [serverMenuOpen, setServerMenuOpen] = useState(false);
  const [spaceMembers, setSpaceMembers] = useState<SpaceMember[]>([]);

  useEffect(() => {
    if (!serverMenuOpen) return;
    function closeServerMenu(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest(".server-context-menu") || target.closest(".server-banner-heading")) return;
      setServerMenuOpen(false);
    }
    function closeServerMenuOnEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setServerMenuOpen(false);
    }
    document.addEventListener("pointerdown", closeServerMenu);
    document.addEventListener("keydown", closeServerMenuOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeServerMenu);
      document.removeEventListener("keydown", closeServerMenuOnEscape);
    };
  }, [serverMenuOpen]);
  const [selectedMember, setSelectedMember] = useState<SpaceMember | null>(null);
  const [dockProfileOpen,setDockProfileOpen]=useState(false);
  const [spaceRoles, setSpaceRoles] = useState<Array<{id:string;name:string;color:string;position:number;showInMemberList:boolean;isManaged:boolean}>>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [membersLoadingMore, setMembersLoadingMore] = useState(false);
  const [membersCursor, setMembersCursor] = useState<string | null>(null);
  const [membersTotal, setMembersTotal] = useState(0);
  const [appNotice, setAppNotice] = useState<AppNotice | null>(null);

  function closeTransientMobileOverlays() {
    if (!window.matchMedia("(max-width: 767px)").matches) return;
    setShowCreateSpace(false);
    setShowDiscovery(false);
    setShowEvents(false);
    setShowWiki(false);
    setShowSystemStatus(false);
    setCreateChannelTarget(null);
    setShowCreateCategory(false);
    setShowSpaceSettings(false);
    setShowRoleManager(false);
    setShowInviteManager(false);
    setShowMemberManager(false);
    setPermissionsChannel(null);
    setShowModeration(false);
    setShowGamification(false);
    setShowAccountSettings(false);
    setSelectedMember(null);
    setMobileChannelsOpen(false);
    setServerMenuOpen(false);
  }

  function openExclusiveOverlay(open: () => void) {
    closeTransientMobileOverlays();
    window.dispatchEvent(new Event("flipzero:close-notifications"));
    open();
  }

  useEffect(() => {
    const handler = () => closeTransientMobileOverlays();
    window.addEventListener("flipzero:mobile-overlay-open", handler);
    return () => window.removeEventListener("flipzero:mobile-overlay-open", handler);
  }, []);

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
    let etag = "";
    const refresh = async () => {
      if (document.visibilityState !== "visible") return;
      const response = await fetch(`/api/v1/spaces/${encodeURIComponent(activeSpaceId)}/voice-presence`, {
        cache: "no-store",
        headers: etag ? { "if-none-match": etag } : undefined,
      }).catch(() => null);
      if (response?.status === 304 || !response) return;
      etag = response.headers.get("etag") ?? etag;
      if (!response.ok || cancelled) return;
      const data = await response.json();
      if (!cancelled) {
        const next: Record<string, VoicePresence[]> = {};
        for (const [channelId, participants] of Object.entries(data.channels ?? {}) as [string, VoicePresence[]][]) next[channelId] = normalizeVoicePresence(participants);
        setVoicePresence(next);
        const limits = (data.limits ?? {}) as Record<string, number | null>;
        setVoiceManage((data.manage ?? {}) as Record<string, boolean>);
        setUserSpaces((current) => current.map((space) => {
          if (space.id !== activeSpaceId) return space;
          let changed = false;
          const channels = space.channels.map((channel) => {
            if (!Object.prototype.hasOwnProperty.call(limits, channel.id) || channel.userLimit === limits[channel.id]) return channel;
            changed = true;
            return { ...channel, userLimit: limits[channel.id] };
          });
          return changed ? { ...space, channels } : space;
        }));
      }
    };
    void refresh();
    const interval = window.setInterval(refresh, 3_000);
    const onVisibility = () => { if (document.visibilityState === "visible") void refresh(); };
    document.addEventListener("visibilitychange", onVisibility);
    return () => { cancelled = true; window.clearInterval(interval); document.removeEventListener("visibilitychange", onVisibility); };
  }, [activeSpaceId]);
  const activeRouteChannel = activeSpace?.channels.find((channel) => channel.name === activeChannel) ?? null;
  const activeApiChannel = activeSpace?.channels.find((channel) => channel.name === activeChannel && ["text", "forum", "announcement"].includes(channel.kind)) ?? null;
  const activeBoardChannel = activeSpace?.channels.find((channel) => channel.name === activeChannel && channel.kind === "board") ?? null;
  const activeForumChannel = activeSpace?.channels.find((channel) => channel.name === activeChannel && channel.kind === "forum") ?? null;
  const activeVoiceChannel = activeSpace?.channels.find((channel) => channel.name === activeChannel && ["voice", "stage"].includes(channel.kind)) ?? null;
  const memberGroups = (() => {
    const visibleRoles = [...spaceRoles].filter((role) => role.showInMemberList || role.isManaged).sort((a, b) => b.position - a.position);
    const groups = new Map<string, { key: string; label: string; color: string | null; position: number; members: SpaceMember[] }>();
    for (const member of spaceMembers) {
      const topRole = visibleRoles.find((role) => member.roleIds?.includes(role.id));
      const key = topRole?.id ?? "__members";
      const group = groups.get(key) ?? {
        key,
        label: topRole?.name ?? "Участники",
        color: topRole?.color ?? null,
        position: topRole?.position ?? Number.MIN_SAFE_INTEGER,
        members: [],
      };
      group.members.push(member);
      groups.set(key, group);
    }
    return [...groups.values()]
      .sort((a, b) => b.position - a.position || a.label.localeCompare(b.label, "ru"))
      .map((group) => ({
        ...group,
        members: group.members.sort((a, b) =>
          Number(Boolean(b.online)) - Number(Boolean(a.online)) ||
          (a.nickname || a.displayName).localeCompare(b.nickname || b.displayName, "ru"),
        ),
      }));
  })();
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
  function openVoiceChannel(channel: ApiChannel, participantId?: string) {
    if (!activeSpace) return;
    const participantCount = normalizeVoicePresence(voicePresence[channel.id] ?? []).length;
    const full = typeof channel.userLimit === "number" && participantCount >= channel.userLimit;
    const canBypassLimit = activeSpace.ownerId === user?.id || user?.platformRole === "admin" || Boolean(voiceManage[channel.id]);
    if (full && !canBypassLimit && voiceSession?.channelId !== channel.id) {
      setAppNotice({ message: "Канал заполнен", tone: "error" });
      return;
    }
    if (voiceSession?.connected && voiceSession.channelId !== channel.id) {
      setPendingVoiceSwitch({ channel, participantId });
      return;
    }
    setVoiceStreamTarget(participantId ? { channelId: channel.id, participantId } : null);
    selectChannel(channel.name, channel.id, activeSpace.id);
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
    const result = await response.json().catch(() => null); if (!response.ok) { setAppNotice({ message: result?.message ?? "Не удалось удалить пространство.", tone: "error" }); return; }
    const next = userSpaces.filter((space) => space.id !== activeSpace.id); setUserSpaces(next); setActiveSpaceId(next[0]?.id ?? null);
  }

  return (
    <><main className={`app-shell ${showMembers && activeSpace ? "" : "members-hidden"} ${mobileChannelsOpen ? "mobile-channels-open" : ""} ${platformView ? "platform-view-active" : ""}`}>
      <nav className="space-rail" aria-label="Сообщества">
        <button className={`rail-action home-action brand-symbol-wrap ${platformView === "social" ? "active" : ""}`} aria-label="Личные сообщения и друзья" title="Личные сообщения" onClick={() => openPlatformView("social")}><BrandMark size={45} /></button>
        {user?.platformRole === "admin" ? <button className={`rail-action platform-admin-rail ${platformView === "admin" ? "active" : ""}`} aria-label="Панель администратора" title="Панель администратора" onClick={() => openPlatformView("admin")}><ShieldCheck size={21} /></button> : null}
        <span className="rail-separator" />
        {spacesLoading ? <LoaderCircle className="rail-loader spin" size={20} /> : userSpaces.map((space) => <button key={space.id} className={`space-button ${space.id === activeSpaceId && !platformView ? "active" : ""}`} style={{ background: `linear-gradient(145deg, ${space.accentColor}, #7136ad)` }} aria-label={`Сообщество ${space.name}`} title={space.name} onClick={() => { setPlatformView(null); setActiveSpaceId(space.id); const first = space.channels.find((channel) => channel.kind === "text") ?? space.channels[0]; if (first) selectChannel(first.name, first.id, space.id); }}>{space.iconUrl ? <MediaImage src={space.iconUrl} /> : space.name.slice(0, 2).toLocaleUpperCase("ru")}</button>)}
        <button className="rail-action add-space" aria-label="Добавить сообщество" title="Создать пространство" onClick={() => openExclusiveOverlay(() => setShowCreateSpace(true))}><Plus size={22} /></button>
        <button className="rail-action discover" aria-label="Обзор сообществ" title="Обзор пространств" onClick={() => openExclusiveOverlay(() => setShowDiscovery(true))}><Compass size={21} /></button>
        <div className="rail-bottom"><button className={`rail-action ${platformView==="clans"?"active":""}`} aria-label="Кланы" title="Кланы" onClick={()=>openPlatformView("clans")}><Swords size={20}/></button><button className="rail-action" aria-label="Состояние системы" title="Состояние системы" onClick={() => openExclusiveOverlay(() => setShowSystemStatus(true))}><HelpCircle size={20} /></button></div>
      </nav>

      {user && platformView ? <section className="platform-workspace" aria-label={platformView === "social" ? "Личное пространство" : platformView === "clans" ? "Кланы" : "Панель администратора"}>{platformView === "social" ? <SocialHubDialog key={`${socialRoute.tab}:${socialRoute.userId ?? ""}:${socialRoute.nonce}`} currentUserId={user.id} embedded initialTab={socialRoute.tab} initialUserId={socialRoute.userId} isAdmin={user.platformRole === "admin"} onOpenAdmin={() => openPlatformView("admin")} /> : platformView === "clans" ? <ClanHub currentUserId={user.id} onOpenDirect={(userId)=>{setSocialRoute(route=>({tab:"messages",userId,nonce:route.nonce+1}));openPlatformView("social")}}/> : user.platformRole === "admin" ? <AdminDialog embedded /> : null}</section> : null}

      <aside className={`channel-panel ${activeSpace ? "has-server-banner" : ""}`}>
        <button className="mobile-drawer-close" aria-label="Закрыть список каналов" onClick={() => setMobileChannelsOpen(false)}><X size={19} /></button>
        <div className="mobile-space-switcher">{userSpaces.map((space) => <button key={space.id} className={space.id === activeSpaceId ? "active" : ""} style={{ background: `linear-gradient(145deg, ${space.accentColor}, #7136ad)` }} onClick={() => { setActiveSpaceId(space.id); const first = space.channels.find((channel) => channel.kind === "text") ?? space.channels[0]; if (first) selectChannel(first.name, first.id, space.id); }}>{space.name.slice(0, 2).toLocaleUpperCase("ru")}</button>)}<button className="mobile-add-space" onClick={() => openExclusiveOverlay(() => setShowCreateSpace(true))}><Plus size={18} /></button></div>
        <div className={`space-heading-wrap ${activeSpace ? "has-server-banner" : ""}`}>
          {!activeSpace ? <button className="space-heading discord-server-heading" disabled><span><strong>FlipZero</strong><small>{userSpaces.length ? "Пространство команды" : "Создайте пространство"}</small></span></button> : null}
          {activeSpace && serverMenuOpen ? <ServerContextMenu name={activeSpace.name} canManage={activeSpace.ownerId === user?.id || user?.platformRole === "admin"} isOwner={activeSpace.ownerId === user?.id} onClose={() => setServerMenuOpen(false)} onSettings={() => openExclusiveOverlay(() => setShowSpaceSettings(true))} onRoles={() => openExclusiveOverlay(() => setShowRoleManager(true))} onInvite={() => openExclusiveOverlay(() => setShowInviteManager(true))} onCommunityLink={copyCommunityLink} onCopyId={() => { void navigator.clipboard.writeText(activeSpace.id).then(() => setAppNotice({ message: "ID пространства скопирован.", tone: "success" })).catch(() => setAppNotice({ message: "Не удалось скопировать ID.", tone: "error" })); }} onProgress={() => openExclusiveOverlay(() => setShowGamification(true))} onEvents={() => openExclusiveOverlay(() => setShowEvents(true))} onWiki={() => openExclusiveOverlay(() => setShowWiki(true))} onMembers={() => openExclusiveOverlay(() => setShowMemberManager(true))} onModeration={() => openExclusiveOverlay(() => setShowModeration(true))} onCreateChannel={() => setCreateChannelTarget({ kind: "text", parentId: null })} onCreateCategory={() => openExclusiveOverlay(() => setShowCreateCategory(true))} onLeave={() => activeSpace && setPendingAction({ kind: "leave", name: activeSpace.name, id: activeSpace.id })} onDelete={() => activeSpace && setPendingAction({ kind: "delete", name: activeSpace.name, id: activeSpace.id })} /> : null}
        </div>
        {activeSpace ? <div className={`server-sidebar-banner ${activeSpace.bannerUrl ? "has-image" : ""}`} role="img" aria-label={`Баннер пространства ${activeSpace.name}`} style={{ backgroundImage: activeSpace.bannerUrl ? `linear-gradient(180deg, rgba(5,8,18,.06) 18%, rgba(5,8,18,.88) 100%), url("${activeSpace.bannerUrl}")` : `radial-gradient(circle at 85% 10%, ${activeSpace.accentColor}aa, transparent 46%), linear-gradient(135deg, #181b2b, ${activeSpace.accentColor}55)` }}><button className={`server-banner-heading ${serverMenuOpen ? "menu-open" : ""}`} aria-haspopup="menu" aria-expanded={serverMenuOpen} onClick={() => setServerMenuOpen((value) => !value)}><span><strong>{activeSpace.name}</strong><small>{activeSpace.description ?? "Пространство команды"}</small></span><ChevronDown size={17}/></button></div> : null}
        <div className="channel-scroll">
          {activeSpace ? <>{activeSpace.categories.map((category) => <ChannelGroup key={category.id} title={category.name.toLocaleUpperCase("ru")} onAdd={activeSpace.ownerId === user?.id ? () => setCreateChannelTarget({ kind: "text", parentId: category.id }) : undefined} onDelete={activeSpace.ownerId === user?.id ? () => setCategoryToDelete(category) : undefined}>{activeSpace.channels.filter((channel) => channel.parentId === category.id).map((channel) => <Channel key={channel.id} active={activeChannel === channel.name} icon={channelIcon(channel)} kind={channel.kind} label={channel.name} voice={["voice", "stage"].includes(channel.kind)} participants={voicePresence[channel.id]} userLimit={channel.userLimit} onSelect={() => openVoiceChannel(channel)} onViewStream={(participantId) => openVoiceChannel(channel, participantId)} onOpenProfile={(participant) => setVoiceProfile({ id: participant.id, name: participant.name })} onManage={activeSpace.ownerId === user?.id || user?.platformRole === "admin" || Boolean(voiceManage[channel.id]) ? () => setPermissionsChannel(channel) : undefined} onDelete={activeSpace.ownerId === user?.id ? () => setPendingAction({ kind: "channel", name: channel.name, id: channel.id }) : undefined} />)}</ChannelGroup>)}{activeSpace.channels.some((channel) => !channel.parentId) ? <ChannelGroup title="БЕЗ КАТЕГОРИИ" onAdd={activeSpace.ownerId === user?.id ? () => setCreateChannelTarget({ kind: "text", parentId: null }) : undefined}>{activeSpace.channels.filter((channel) => !channel.parentId).map((channel) => <Channel key={channel.id} active={activeChannel === channel.name} icon={channelIcon(channel)} kind={channel.kind} label={channel.name} voice={["voice", "stage"].includes(channel.kind)} participants={voicePresence[channel.id]} userLimit={channel.userLimit} onSelect={() => openVoiceChannel(channel)} onViewStream={(participantId) => openVoiceChannel(channel, participantId)} onOpenProfile={(participant) => setVoiceProfile({ id: participant.id, name: participant.name })} onManage={activeSpace.ownerId === user?.id || user?.platformRole === "admin" || Boolean(voiceManage[channel.id]) ? () => setPermissionsChannel(channel) : undefined} onDelete={activeSpace.ownerId === user?.id ? () => setPendingAction({ kind: "channel", name: channel.name, id: channel.id }) : undefined} />)}</ChannelGroup> : null}{activeSpace.ownerId === user?.id ? <button className="category-add" onClick={() => openExclusiveOverlay(() => setShowCreateCategory(true))}><Plus size={14} /> Новая категория</button> : null}</> : <div className="space-empty"><strong>Здесь пока пусто</strong><span>Создайте первое пространство, чтобы открыть каналы и роли.</span><button onClick={() => openExclusiveOverlay(() => setShowCreateSpace(true))}>Создать пространство</button></div>}
        </div>
        <UserDock user={user} externalVoiceSession={voiceSession} onOpenProfile={()=>setDockProfileOpen(true)} onOpenSettings={()=>{setAccountSettingsSection("profile");setMobileChannelsOpen(false);openExclusiveOverlay(()=>setShowAccountSettings(true))}} onOpenVoiceSettings={()=>{setAccountSettingsSection("voice");setMobileChannelsOpen(false);openExclusiveOverlay(()=>setShowAccountSettings(true))}} />
      </aside>

      <section className="chat-panel">
        <header className="chat-header"><button className="mobile-menu-button" aria-label="Открыть сообщества и каналы" onClick={() => setMobileChannelsOpen(true)}><Menu size={20} /></button><div className="channel-title"><Hash size={21} /><strong>{activeRouteChannel?.name ?? "Чат"}</strong><span>{activeRouteChannel?.topic ?? (activeSpace ? activeSpace.name : "Выберите пространство")}</span></div><div className="header-actions"><button aria-label="Единый поиск" title="Поиск Ctrl+K" onClick={()=>setGlobalSearchOpen(true)}><Search size={18}/></button><button className={`channel-share-action ${channelLinkCopied ? "is-active link-copied" : ""}`} aria-label={channelLinkCopied ? "Ссылка на канал скопирована" : "Поделиться ссылкой на канал"} title={channelLinkCopied ? "Скопировано" : "Поделиться ссылкой на канал"} onClick={shareChannelLink} disabled={!activeRouteChannel}>{channelLinkCopied ? <Check size={18} /> : <><Copy className="desktop-copy-icon" size={18} /><Share2 className="mobile-share-icon" size={18} /></>}</button><NotificationCenter onOpenMessages={(userId) => { setSocialRoute((route) => ({ tab: "messages", userId, nonce: route.nonce + 1 })); openPlatformView("social"); }} onOpenFriends={() => { setSocialRoute((route) => ({ tab: "friends", userId: null, nonce: route.nonce + 1 })); openPlatformView("social"); }} onOpenClans={()=>openPlatformView("clans")} /><button className={showMembers ? "is-active" : ""} aria-label={showMembers ? "Скрыть участников" : "Показать участников"} aria-pressed={showMembers} onClick={() => setShowMembers((value) => !value)}><Users size={19} /></button><label className="search-box"><Search size={16} /><input ref={searchInputRef} aria-label="Поиск" placeholder="Поиск · Ctrl+K" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} /></label></div></header>
        {activeBoardChannel ? <ChannelBoard channelId={activeBoardChannel.id} channelName={activeBoardChannel.name} /> : activeForumChannel ? <ForumChannel channelId={activeForumChannel.id} channelName={activeForumChannel.name} /> : activeVoiceChannel ? <VoiceRoom key={activeVoiceChannel.id} channelId={activeVoiceChannel.id} channelName={activeVoiceChannel.name} spaceName={activeSpace?.name ?? ""} autoJoin presence={voicePresence[activeVoiceChannel.id] ?? []} initialStreamId={voiceStreamTarget?.channelId===activeVoiceChannel.id?voiceStreamTarget.participantId:""} onPresenceChange={(participants) => setVoicePresence((current) => {
          const known = new Map((current[activeVoiceChannel.id] ?? []).map((participant) => [participant.id, participant]));
          return { ...current, [activeVoiceChannel.id]: normalizeVoicePresence(participants.map((participant) => ({ ...known.get(participant.id), ...participant }))) };
        })} /> : activeApiChannel && user ? <PersistentChat key={activeApiChannel.id} channelId={activeApiChannel.id} channelName={activeApiChannel.name} spaceId={activeSpace!.id} currentUserId={user.id} ownerId={activeSpace?.ownerId} searchQuery={searchQuery} onOpenDirect={(userId) => { setSocialRoute((route) => ({ tab: "messages", userId, nonce: route.nonce + 1 })); openPlatformView("social"); }} /> : <div className="message-list"><div className="search-empty app-empty-state"><Hash size={28} /><strong>{spacesLoading ? "Загружаем пространства…" : activeSpace ? "Выберите канал" : "Создайте пространство"}</strong><span>{activeSpace ? "Выберите канал слева, чтобы открыть переписку." : "Создайте пространство, чтобы начать общение и пригласить участников."}</span>{!spacesLoading && !activeSpace ? <button type="button" onClick={() => openExclusiveOverlay(() => setShowCreateSpace(true))}>Создать пространство</button> : null}</div></div>}
      </section>

      <aside className="member-panel">
        <div className="real-member-list">
          {membersLoading ? <div className="members-loading">Загрузка участников…</div> : memberGroups.length ? <>{memberGroups.map((group) => <section className="member-section member-role-group" key={group.key}><h2><span style={group.color ? { color: group.color } : undefined}>{group.label.toLocaleUpperCase("ru")} — {group.members.length}</span></h2>{group.members.map((member) => <button className={`member ${member.online ? "is-online" : "is-offline"}`} key={member.userId} type="button" aria-label={`Открыть профиль ${member.nickname || member.displayName} — ${member.online ? "в сети" : "не в сети"}`} title={`Открыть профиль ${member.nickname || member.displayName}`} onClick={() => openExclusiveOverlay(() => setSelectedMember(member))}><span className="mini-avatar avatar-coral">{member.avatarUrl ? <MediaImage src={member.avatarUrl} /> : (member.displayName || member.username || "?").slice(0, 2).toLocaleUpperCase("ru")}<i /></span><span><strong>{member.nickname || member.displayName}</strong><ClanTag clan={member.clan}/><small>@{member.username || "участник"} · {member.online ? "в сети" : "не в сети"}</small>{Object.values(voicePresence).some((items)=>items.some((participant)=>participant.id===member.userId))?<span className="member-voice-indicator" title="Сейчас в голосовом канале"><Mic size={12}/> в голосе</span>:null}</span></button>)}</section>)}{membersCursor ? <button className="members-load-more" onClick={() => void loadMoreMembers()} disabled={membersLoadingMore}>{membersLoadingMore ? <><LoaderCircle className="spin" size={14} /> Загружаем…</> : "Показать ещё"}</button> : null}</> : <div className="members-loading">В этом пространстве пока нет участников.</div>}
        </div>
      </aside>
      {user&&platformView?<div className="global-user-dock"><UserDock className="global-user-dock-inner" user={user} externalVoiceSession={voiceSession} onOpenProfile={()=>setDockProfileOpen(true)} onOpenSettings={()=>{setAccountSettingsSection("profile");openExclusiveOverlay(()=>setShowAccountSettings(true))}} onOpenVoiceSettings={()=>{setAccountSettingsSection("voice");openExclusiveOverlay(()=>setShowAccountSettings(true))}}/></div>:null}
      <button className="mobile-drawer-backdrop" aria-label="Закрыть меню каналов" onClick={() => setMobileChannelsOpen(false)} />
      {voiceSession?.connected ? <div className="mobile-voice-session" role="status"><button type="button" onClick={() => { const channel=activeSpace?.channels.find((item)=>item.id===voiceSession.channelId); if(channel) openVoiceChannel(channel); }}><Signal size={15}/><span><strong>Голосовая связь подключена</strong><small>{voiceSession.channelName}{voiceSession.spaceName?` · ${voiceSession.spaceName}`:""}</small></span></button><button type="button" aria-label="Отключиться от голосового канала" onClick={()=>window.dispatchEvent(new CustomEvent("flipzero:voice-control",{detail:{type:"leave"}}))}><PhoneOff size={17}/></button></div> : null}
      <nav className="mobile-tab-bar mobile-tab-bar-six" aria-label="Основная навигация"><button className={platformView === "social" ? "active" : ""} onClick={() => openPlatformView("social")}><MessageCircle size={20} /><span>Личное</span></button><button className={platformView==="clans"?"active":""} aria-label="Кланы" title="Кланы" onClick={()=>openPlatformView("clans")}><Swords size={20}/><span>Кланы</span></button><button onClick={() => openExclusiveOverlay(() => setShowDiscovery(true))}><Compass size={20} /><span>Обзор</span></button><button className={mobileChannelsOpen ? "active" : ""} onClick={() => { setPlatformView(null); setMobileChannelsOpen(true); }}><HomeIcon size={20} /><span>Пространства</span></button><button className={!platformView && !mobileChannelsOpen ? "active" : ""} onClick={() => { setPlatformView(null); setMobileChannelsOpen(false); }}><Hash size={20} /><span>Чат</span></button><button onClick={() => { setAccountSettingsSection("profile"); setMobileChannelsOpen(false); openExclusiveOverlay(() => setShowAccountSettings(true)); }}><UserRound size={20} /><span>Профиль</span></button></nav>
      {user && user.onboardingCompleted === false ? <OnboardingWizard initialStep={user.onboardingStep} onComplete={() => setUser((current) => current ? { ...current, onboardingCompleted: true, onboardingStep: 4 } : current)} /> : null}
    </main>{user?<PreferencesProvider userId={user.id}/>:null}<IncomingDirectCall/>{globalSearchOpen?<GlobalSearch onClose={()=>setGlobalSearchOpen(false)} onOpenPerson={(id)=>{setSocialRoute(route=>({tab:"messages",userId:id,nonce:route.nonce+1}));openPlatformView("social")}} onOpenDirect={async(id)=>{const response=await fetch("/api/messages");if(response.ok){const data=await response.json();const convo=data.conversations?.find((item:{id:string})=>item.id===id);if(convo?.other?.id){setSocialRoute(route=>({tab:"messages",userId:convo.other.id,nonce:route.nonce+1}));openPlatformView("social")}}}} onOpenSpace={(id)=>{setActiveSpaceId(id);setPlatformView(null)}} onOpenChannel={(spaceId,channelId)=>{const space=userSpaces.find(item=>item.id===spaceId);const channel=space?.channels.find(item=>item.id===channelId);setActiveSpaceId(spaceId);setPlatformView(null);selectChannel(channel?.name??"чат",channelId,spaceId)}}/>:null}{selectedMember ? <UserProfilePopover key={selectedMember.userId} userId={selectedMember.userId} displayName={selectedMember.nickname || selectedMember.displayName} onClose={() => setSelectedMember(null)} onOpenDirect={(userId) => { setSelectedMember(null); setSocialRoute((route) => ({ tab: "messages", userId, nonce: route.nonce + 1 })); openPlatformView("social"); }} /> : null}{voiceProfile ? <UserProfilePopover key={voiceProfile.id} userId={voiceProfile.id} displayName={voiceProfile.name} onClose={() => setVoiceProfile(null)} onOpenDirect={(userId) => { setVoiceProfile(null); setSocialRoute((route) => ({ tab: "messages", userId, nonce: route.nonce + 1 })); openPlatformView("social"); }} /> : null}{user&&dockProfileOpen?<UserProfilePopover userId={user.id} displayName={user.displayName} onClose={()=>setDockProfileOpen(false)} onOpenDirect={(userId)=>{setDockProfileOpen(false);setSocialRoute((route)=>({tab:"messages",userId,nonce:route.nonce+1}));openPlatformView("social")}}/>:null}{pendingVoiceSwitch ? <ConfirmDialog title={`Перейти в «${pendingVoiceSwitch.channel.name}»?`} description={voiceSession ? `Вы уже подключены к «${voiceSession.channelName}». Текущее голосовое соединение будет завершено.` : "Текущее голосовое соединение будет завершено."} confirmLabel="Перейти" onCancel={() => setPendingVoiceSwitch(null)} onConfirm={() => { const target = pendingVoiceSwitch; setPendingVoiceSwitch(null); window.dispatchEvent(new CustomEvent("flipzero:voice-control", { detail: { type: "leave" } })); setVoiceStreamTarget(target.participantId ? { channelId: target.channel.id, participantId: target.participantId } : null); window.setTimeout(() => { if (activeSpace) selectChannel(target.channel.name, target.channel.id, activeSpace.id); }, 120); }} /> : null}{pendingAction ? <ConfirmDialog title={pendingAction.kind === "leave" ? `Выйти из «${pendingAction.name}»?` : pendingAction.kind === "delete" ? `Удалить пространство «${pendingAction.name}»?` : `Удалить канал «${pendingAction.name}»?`} description={pendingAction.kind === "leave" ? "Вы покинете пространство и потеряете доступ к его каналам." : pendingAction.kind === "delete" ? "Все каналы, сообщения и настройки пространства будут удалены. Это действие нельзя отменить." : "Сообщения в этом канале будут удалены. Это действие нельзя отменить."} confirmLabel={pendingAction.kind === "leave" ? "Выйти" : "Удалить"} confirmationText={pendingAction.kind === "delete" ? pendingAction.name : undefined} destructive onCancel={() => setPendingAction(null)} onConfirm={() => { const action = pendingAction; setPendingAction(null); if (action.kind === "leave") void leaveActiveSpace(); else if (action.kind === "delete") void deleteActiveSpace(); else { const channel = activeSpace?.channels.find((item) => item.id === action.id); if (channel) void deleteChannel(channel); } }} /> : null}{categoryToDelete ? <ConfirmDialog title={`Удалить категорию «${categoryToDelete.name}»?`} description="Каналы останутся в пространстве без категории." confirmLabel="Удалить категорию" destructive onCancel={() => setCategoryToDelete(null)} onConfirm={() => void deleteCategory(categoryToDelete)} /> : null}{appNotice ? <div className={`app-toast app-toast-${appNotice.tone}`} role={appNotice.tone === "error" ? "alert" : "status"} aria-live="polite"><span>{appNotice.message}</span><button type="button" aria-label="Закрыть уведомление" onClick={() => setAppNotice(null)}><X size={16} /></button></div> : null}{user && showAccountSettings ? <AccountSettingsDialog user={user} initialSection={accountSettingsSection} onClose={() => setShowAccountSettings(false)} onSaved={setUser} /> : null}{showSystemStatus ? <SystemStatusDialog onClose={() => setShowSystemStatus(false)} /> : null}{activeSpace && showWiki ? <WikiDialog spaceId={activeSpace.id} onClose={() => setShowWiki(false)} /> : null}{activeSpace && showEvents ? <EventsDialog spaceId={activeSpace.id} onClose={() => setShowEvents(false)} /> : null}{showDiscovery ? <DiscoveryDialog onClose={() => setShowDiscovery(false)} onJoined={openJoinedSpace} /> : null}{showCreateSpace ? <CreateSpaceDialog onClose={() => setShowCreateSpace(false)} onCreated={(space) => { setUserSpaces((current) => [...current, space]); setActiveSpaceId(space.id); const first = space.channels.find((channel) => channel.kind === "text"); if (first) selectChannel(first.name, first.id, space.id); setShowCreateSpace(false); }} /> : null}{activeSpace && createChannelTarget ? <CreateChannelDialog spaceId={activeSpace.id} categories={activeSpace.categories} initialKind={createChannelTarget.kind} initialParentId={createChannelTarget.parentId} onClose={() => setCreateChannelTarget(null)} onCreated={addChannel} /> : null}{activeSpace && showCreateCategory ? <CreateCategoryDialog spaceId={activeSpace.id} onClose={() => setShowCreateCategory(false)} onCreated={addCategory} /> : null}{activeSpace && showSpaceSettings ? <SpaceSettingsDialog space={activeSpace} onClose={() => setShowSpaceSettings(false)} onSaved={saveSpaceSettings} onRoles={() => { setShowSpaceSettings(false); openExclusiveOverlay(() => setShowRoleManager(true)); }} onMembers={() => { setShowSpaceSettings(false); openExclusiveOverlay(() => setShowMemberManager(true)); }} onInvites={() => { setShowSpaceSettings(false); openExclusiveOverlay(() => setShowInviteManager(true)); }} onModeration={() => { setShowSpaceSettings(false); openExclusiveOverlay(() => setShowModeration(true)); }} onProgress={() => { setShowSpaceSettings(false); openExclusiveOverlay(() => setShowGamification(true)); }} /> : null}{activeSpace && showRoleManager ? <RoleManagerDialog spaceId={activeSpace.id} onClose={() => setShowRoleManager(false)} /> : null}{activeSpace && showInviteManager ? <InviteManagerDialog spaceId={activeSpace.id} onClose={() => setShowInviteManager(false)} /> : null}{activeSpace && showMemberManager ? <MemberManagerDialog spaceId={activeSpace.id} onClose={() => setShowMemberManager(false)} /> : null}{activeSpace && permissionsChannel ? <ChannelPermissionsDialog spaceId={activeSpace.id} channel={permissionsChannel} onClose={() => setPermissionsChannel(null)} onUpdated={(updated) => { setUserSpaces((current) => current.map((space) => space.id !== activeSpace.id ? space : { ...space, channels: space.channels.map((channel) => channel.id === updated.id ? { ...channel, userLimit: updated.userLimit } : channel) })); setPermissionsChannel((current) => current?.id === updated.id ? { ...current, userLimit: updated.userLimit } : current); }} /> : null}{activeSpace && showModeration ? <ModerationDialog spaceId={activeSpace.id} onClose={() => setShowModeration(false)} /> : null}{activeSpace && showGamification ? <GamificationDialog spaceId={activeSpace.id} isOwner={activeSpace.ownerId === user?.id} onClose={() => setShowGamification(false)} /> : null}</>
  );
}

function ChannelGroup({ title, onAdd, onDelete, children }: { title: string; onAdd?: () => void; onDelete?: () => void; children: React.ReactNode }) {
  return <section className="channel-group"><h2><span>{title}</span><span className="category-actions">{onAdd ? <button aria-label={`Добавить в ${title}`} onClick={onAdd}><Plus size={15} /></button> : null}{onDelete ? <button aria-label={`Удалить категорию ${title}`} onClick={onDelete}><Trash2 size={13} /></button> : null}</span></h2>{children}</section>;
}
function Channel({
  icon, kind, label, active = false, badge, voice = false, participants = [], userLimit = null,
  onSelect, onViewStream, onOpenProfile, onManage, onDelete,
}: {
  icon: React.ReactNode; kind: string; label: string; active?: boolean; badge?: string; voice?: boolean;
  participants?: VoicePresence[]; userLimit?: number | null; onSelect?: () => void; onViewStream?: (participantId: string) => void;
  onOpenProfile?: (participant: VoicePresence) => void; onManage?: () => void; onDelete?: () => void;
}) {
  const normalized = normalizeVoicePresence(participants);
  const visible = normalized.slice(0, 12);
  const hiddenCount = Math.max(0, normalized.length - visible.length);
  const full = voice && typeof userLimit === "number" && normalized.length >= userLimit;
  const countLabel = voice ? (typeof userLimit === "number" ? `${normalized.length}/${userLimit}` : String(normalized.length)) : "";
  const [context, setContext] = useState<{ participant: VoicePresence; x: number; y: number } | null>(null);
  const longPressRef = useRef<number | null>(null);

  useEffect(() => {
    if (!context) return;
    const close = (event: PointerEvent) => {
      if ((event.target as HTMLElement | null)?.closest?.(".voice-user-context-menu")) return;
      setContext(null);
    };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") setContext(null); };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", close); document.removeEventListener("keydown", escape); };
  }, [context]);

  function openParticipant(participant: VoicePresence) {
    if (participant.streaming || participant.sharing) onViewStream?.(participant.id);
    else onOpenProfile?.(participant);
  }
  function openContext(participant: VoicePresence, x: number, y: number) {
    setContext({ participant, x: Math.min(x, window.innerWidth - 250), y: Math.min(y, window.innerHeight - 250) });
  }
  function beginLongPress(participant: VoicePresence, event: ReactPointerEvent) {
    if (longPressRef.current) window.clearTimeout(longPressRef.current);
    const { clientX, clientY } = event;
    longPressRef.current = window.setTimeout(() => openContext(participant, clientX, clientY), 480);
  }
  function cancelLongPress() {
    if (longPressRef.current) window.clearTimeout(longPressRef.current);
    longPressRef.current = null;
  }

  return <div className={`channel-row ${active ? "active" : ""} ${full ? "voice-channel-full" : ""}`}>
    <button className="channel" type="button" aria-label={`${channelKindLabels[kind] ?? "Канал"} ${label}`} title={`${channelKindLabels[kind] ?? "Канал"} · ${label}`} aria-current={active ? "page" : undefined} onClick={() => { if (onSelect) onSelect(); else if (!voice) window.dispatchEvent(new CustomEvent("flipzero:select-channel", { detail: label })); }}>
      <span aria-hidden="true">{icon}</span><strong>{label}</strong>
      {voice && full ? <Lock size={12} className="voice-channel-lock" aria-label="Канал заполнен" /> : null}
      {voice && (normalized.length > 0 || typeof userLimit === "number") ? <span className="voice-channel-count" aria-label={typeof userLimit === "number" ? `${normalized.length} из ${userLimit} участников` : `${normalized.length} участников`}>{countLabel}</span> : null}
      {badge ? <b>{badge}</b> : null}
    </button>
    {onManage ? <button className="channel-manage" aria-label={`Настроить права канала ${label}`} title={`Настроить права канала ${label}`} onClick={onManage}><Settings2 size={14} /></button> : null}
    {onDelete ? <button className="channel-delete" aria-label={`Удалить канал ${label}`} title={`Удалить канал ${label}`} onClick={onDelete}><Trash2 size={14} /></button> : null}
    {voice && normalized.length ? <div className="voice-channel-participants" role="list" aria-label={`Участники канала ${label}`}>
      {visible.map((participant) => <div key={participant.id} role="listitem" className={`voice-sidebar-person ${participant.speaking ? "speaking" : ""} ${participant.streaming || participant.sharing ? "streaming" : ""}`}
        onContextMenu={(event) => { event.preventDefault(); openContext(participant, event.clientX, event.clientY); }}
        onPointerDown={(event) => beginLongPress(participant, event)} onPointerUp={cancelLongPress} onPointerCancel={cancelLongPress} onPointerMove={cancelLongPress}>
        <button type="button" className="voice-participant-main" onClick={() => openParticipant(participant)} aria-label={participant.streaming || participant.sharing ? `Смотреть стрим ${participant.name}` : `Открыть профиль ${participant.name}`}>
          <span className="voice-sidebar-avatar">{participant.avatarUrl ? <MediaImage src={participant.avatarUrl} /> : participant.name.slice(0,2).toLocaleUpperCase("ru")}</span>
          <strong title={participant.name}>{participant.name}</strong>
        </button>
        <span className="voice-sidebar-status" aria-label="Состояние участника">
          {participant.camera ? <Video size={12} aria-label="Камера включена" /> : null}
          {participant.deafened ? <Headphones size={12} aria-label="Звук выключен" /> : participant.muted ? <MicOff size={12} aria-label="Микрофон выключен" /> : null}
          {participant.streaming || participant.sharing ? <button type="button" className="voice-live-badge" onClick={(event) => { event.stopPropagation(); onViewStream?.(participant.id); }} aria-label={`Смотреть стрим ${participant.name}`}>LIVE</button> : null}
        </span>
      </div>)}
      {hiddenCount ? <button type="button" className="voice-more" onClick={onSelect} aria-label={`Показать ещё ${hiddenCount} участников`}>+{hiddenCount}</button> : null}
    </div> : null}
    {context ? <div className="voice-user-context-menu" style={{ left: context.x, top: context.y }} role="menu" aria-label={`Действия для ${context.participant.name}`}>
      <strong>{context.participant.name}</strong>
      <label><span>Громкость</span><input type="range" min="0" max="100" defaultValue="100" onChange={(event)=>window.dispatchEvent(new CustomEvent("flipzero:voice-control",{detail:{type:"participant-volume",participantId:context.participant.id,value:Number(event.target.value)}}))}/></label>
      <button type="button" role="menuitem" onClick={()=>window.dispatchEvent(new CustomEvent("flipzero:voice-control",{detail:{type:"participant-volume",participantId:context.participant.id,value:0}}))}><Volume2 size={15}/>Заглушить у себя</button>
      <button type="button" role="menuitem" onClick={()=>{onOpenProfile?.(context.participant);setContext(null)}}><UserRound size={15}/>Профиль</button>
      {context.participant.streaming || context.participant.sharing ? <button type="button" role="menuitem" onClick={()=>{onViewStream?.(context.participant.id);setContext(null)}}><MonitorUp size={15}/>Смотреть стрим</button>:null}
    </div>:null}
  </div>;
}
