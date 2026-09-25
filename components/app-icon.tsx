"use client";

import type { ComponentType, SVGProps } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpDown,
  BadgeCheck,
  Backpack,
  Bell,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleOff,
  Coins,
  Compass,
  Crown,
  Eye,
  Filter,
  Gem,
  Gift,
  Headphones,
  Home,
  LoaderCircle,
  MessageCircle,
  Mic,
  PackageOpen,
  Palette,
  Plus,
  Search,
  Settings,
  ShoppingCart,
  Sparkles,
  Store,
  Trophy,
  Upload,
  UserRound,
  Users,
  X,
} from "lucide-react";

export type AppIconName =
  | "animated"
  | "appearance"
  | "back"
  | "buy"
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
  | "loading"
  | "menu-down"
  | "messages"
  | "microphone"
  | "next"
  | "people"
  | "plus"
  | "preview"
  | "previous"
  | "search"
  | "settings"
  | "sort"
  | "store"
  | "superflip"
  | "quests"
  | "unequip"
  | "upload"
  | "user";

type IconComponent = ComponentType<SVGProps<SVGSVGElement> & { size?: number | string; strokeWidth?: number | string }>;

const ICONS: Record<AppIconName, IconComponent> = {
  animated: Sparkles,
  appearance: Palette,
  back: ArrowLeft,
  buy: ShoppingCart,
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
  loading: LoaderCircle,
  "menu-down": ChevronDown,
  messages: MessageCircle,
  microphone: Mic,
  next: ChevronRight,
  people: Users,
  plus: Plus,
  preview: Eye,
  previous: ChevronLeft,
  search: Search,
  settings: Settings,
  sort: ArrowUpDown,
  store: Store,
  superflip: Gem,
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
