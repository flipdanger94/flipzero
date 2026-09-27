import type { AppIconName } from "../app-icon";
import type { ProfileAppearanceData } from "../profile-appearance-surface";
export type Ledger = {
  id: string;
  amount: number;
  reason: string;
  createdAt: string;
};
export type Quest = {
  key: string;
  title: string;
  description: string;
  period: "daily" | "weekly";
  target: number;
  progress: number;
  coins: number;
  xp: number;
  claimed: boolean;
};
export type ItemState = "not_owned" | "owned" | "equipped";
export type StoreItem = {
  id: string;
  slug: string;
  title: string;
  description: string;
  category: string;
  type: string;
  slot: string;
  rarity: string;
  priceOrbs: number;
  preview: string;
  previewImage: string | null;
  previewAnimation: string | null;
  superflipOnly: boolean;
  isBundle: boolean;
  isAnimated: boolean;
  isActive: boolean;
  isNew: boolean;
  state: ItemState;
  bundleItems: string[];
  createdAt: string;
  availableUntil: string | null;
};
export type InventoryItem = StoreItem & { source: string; acquiredAt: string };
export type StoreResponse = {
  items: StoreItem[];
  balance: number;
  superflipActive: boolean;
  equipped: Record<string, string>;
  categories: string[];
  slots: string[];
  rarities: string[];
};
export type InventoryResponse = {
  items: InventoryItem[];
  equipped: Record<string, string>;
  slots: string[];
};
export type StoreProfile = ProfileAppearanceData & { id: string };

export const slotLabels: Record<string, string> = {
  avatar_decoration: "Рамка аватара",
  profile_effect: "Эффект профиля",
  profile_banner: "Баннер профиля",
  nameplate: "Стиль имени",
  chat_style: "Стиль сообщений",
  badge: "Значок",
  app_theme: "Тема приложения",
};
export const categoryLabels: Record<string, string> = {
  avatar_frame: "Рамки",
  profile_effect: "Эффекты профиля",
  banner: "Баннеры",
  nickname: "Стили имени",
  message_effect: "Сообщения",
  badge: "Значки",
  theme: "Темы",
  bundle: "Наборы",
};
export const rarityLabels: Record<string, string> = {
  common: "Обычный",
  rare: "Редкий",
  epic: "Эпический",
  legendary: "Легендарный",
  limited: "Лимитированный",
};
export const slotIcons: Record<string, AppIconName> = {
  avatar_decoration: "avatar-decoration",
  profile_effect: "profile-effect",
  profile_banner: "banner",
  nameplate: "nameplate",
  chat_style: "chat-style",
  badge: "badge",
  app_theme: "theme",
};
