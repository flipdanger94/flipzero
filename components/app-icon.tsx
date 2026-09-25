import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowUpDown,
  Ban,
  BadgeCheck,
  Backpack,
  Badge,
  Bell,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  CircleOff,
  Coins,
  Compass,
  Copy,
  Ellipsis,
  Eye,
  Flag,
  Filter,
  Image,
  Gem,
  Gift,
  Headphones,
  Home,
  Hash,
  LoaderCircle,
  MessageCircle,
  MessageSquareText,
  MicOff,
  Mic,
  Music2,
  Palette,
  Pencil,
  Phone,
  Paintbrush,
  PhoneOff,
  Plus,
  Search,
  Settings,
  Signal,
  SlidersHorizontal,
  ShoppingCart,
  Sparkles,
  Store,
  Swords,
  Trophy,
  Gamepad2,
  Type,
  Upload,
  UserMinus,
  UserPlus,
  UserRound,
  Video,
  Volume2,
  VolumeX,
  Users,
  X,
  Save,
  type LucideIcon,
} from "lucide-react";

export type AppIconName =
  | "animated"
  | "block"
  | "call"
  | "copy"
  | "edit"
  | "game"
  | "more"
  | "music"
  | "report"
  | "save"
  | "user-remove"
  | "video"
  | "move-up"
  | "move-down"
  | "audio"
  | "audio-off"
  | "avatar-decoration"
  | "badge"
  | "banner"
  | "appearance"
  | "back"
  | "buy"
  | "chat-style"
  | "channel"
  | "check"
  | "close"
  | "currency"
  | "compass"
  | "disconnect"
  | "equip"
  | "filter"
  | "forward"
  | "gift"
  | "headphones"
  | "home"
  | "inventory"
  | "nameplate"
  | "loading"
  | "menu-up"
  | "menu-down"
  | "messages"
  | "notifications"
  | "microphone"
  | "microphone-off"
  | "next"
  | "people"
  | "friends"
  | "clans"
  | "profile-effect"
  | "plus"
  | "preview"
  | "previous"
  | "search"
  | "settings"
  | "signal"
  | "controls"
  | "sort"
  | "store"
  | "superflip"
  | "theme"
  | "quests"
  | "unequip"
  | "upload"
  | "user";

const ICONS: Record<AppIconName, LucideIcon> = {
  animated: Sparkles,
  block: Ban,
  call: Phone,
  copy: Copy,
  edit: Pencil,
  game: Gamepad2,
  more: Ellipsis,
  music: Music2,
  report: Flag,
  save: Save,
  "user-remove": UserMinus,
  video: Video,
  "move-up": ArrowUp,
  "move-down": ArrowDown,
  audio: Volume2,
  "audio-off": VolumeX,
  "avatar-decoration": UserRound,
  badge: Badge,
  banner: Image,
  appearance: Palette,
  back: ArrowLeft,
  buy: ShoppingCart,
  "chat-style": MessageSquareText,
  channel: Hash,
  check: Check,
  close: X,
  currency: Coins,
  compass: Compass,
  disconnect: PhoneOff,
  equip: BadgeCheck,
  filter: Filter,
  forward: ArrowRight,
  gift: Gift,
  headphones: Headphones,
  home: Home,
  inventory: Backpack,
  nameplate: Type,
  loading: LoaderCircle,
  "menu-up": ChevronUp,
  "menu-down": ChevronDown,
  messages: MessageCircle,
  notifications: Bell,
  microphone: Mic,
  "microphone-off": MicOff,
  next: ChevronRight,
  people: Users,
  friends: UserPlus,
  clans: Swords,
  "profile-effect": Sparkles,
  plus: Plus,
  preview: Eye,
  previous: ChevronLeft,
  search: Search,
  settings: Settings,
  signal: Signal,
  controls: SlidersHorizontal,
  sort: ArrowUpDown,
  store: Store,
  superflip: Gem,
  theme: Paintbrush,
  quests: Trophy,
  unequip: CircleOff,
  upload: Upload,
  user: UserRound,
};

export function AppIcon({
  name,
  size = 18,
  label,
  className = "",
}: {
  name: AppIconName;
  size?: number;
  label?: string;
  className?: string;
}) {
  const Icon = ICONS[name];
  return (
    <Icon
      className={`fz-icon ${className}`.trim()}
      size={size}
      viewBox={APP_ICON_VIEWBOX}
      strokeWidth={1.8}
      color="currentColor"
      aria-hidden={label ? undefined : true}
      aria-label={label}
      focusable="false"
    />
  );
}

export const APP_ICON_VIEWBOX = "0 0 24 24";
