import {
  ArrowLeft,
  ArrowRight,
  ArrowUpDown,
  BadgeCheck,
  Backpack,
  Badge,
  Bell,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleOff,
  Coins,
  Compass,
  Eye,
  Filter,
  Image,
  Gem,
  Gift,
  Headphones,
  Home,
  LoaderCircle,
  MessageCircle,
  MessageSquareText,
  Mic,
  Palette,
  Paintbrush,
  Plus,
  Search,
  Settings,
  ShoppingCart,
  Sparkles,
  Store,
  Swords,
  Trophy,
  Type,
  Upload,
  UserPlus,
  UserRound,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";

export type AppIconName =
  | "animated"
  | "avatar-decoration"
  | "badge"
  | "banner"
  | "appearance"
  | "back"
  | "buy"
  | "chat-style"
  | "check"
  | "close"
  | "currency"
  | "compass"
  | "equip"
  | "filter"
  | "forward"
  | "gift"
  | "headphones"
  | "home"
  | "inventory"
  | "nameplate"
  | "loading"
  | "menu-down"
  | "messages"
  | "notifications"
  | "microphone"
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
  "avatar-decoration": UserRound,
  badge: Badge,
  banner: Image,
  appearance: Palette,
  back: ArrowLeft,
  buy: ShoppingCart,
  "chat-style": MessageSquareText,
  check: Check,
  close: X,
  currency: Coins,
  compass: Compass,
  equip: BadgeCheck,
  filter: Filter,
  forward: ArrowRight,
  gift: Gift,
  headphones: Headphones,
  home: Home,
  inventory: Backpack,
  nameplate: Type,
  loading: LoaderCircle,
  "menu-down": ChevronDown,
  messages: MessageCircle,
  notifications: Bell,
  microphone: Mic,
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
      strokeWidth={1.8}
      color="currentColor"
      aria-hidden={label ? undefined : true}
      aria-label={label}
      focusable="false"
    />
  );
}

export const APP_ICON_VIEWBOX = "0 0 24 24";
