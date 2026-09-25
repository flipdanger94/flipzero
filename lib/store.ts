import "server-only";

import { and, eq, gt, inArray, isNull, or, sql } from "drizzle-orm";
import { getDatabase } from "@/db/client";
import {
  cosmeticBundleEntries,
  cosmeticEquipped,
  cosmeticInventory,
  cosmeticItems,
  userPreferences,
  userWallets,
} from "@/db/schema";
import { debitCoins } from "@/lib/economy";
import { getSuperFlipCapabilities } from "@/lib/superflip";

export const STORE_SLOTS = [
  "avatar_decoration",
  "profile_effect",
  "profile_banner",
  "nameplate",
  "chat_style",
  "badge",
  "app_theme",
] as const;

export type StoreSlot = (typeof STORE_SLOTS)[number];
export type StoreItemState = "not_owned" | "owned" | "equipped";

export class StoreActionError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

type StoreFilters = {
  q?: string | null;
  category?: string | null;
  slot?: string | null;
  rarity?: string | null;
  sort?: string | null;
  offset?: number;
  limit?: number;
};

function activeItem(item: typeof cosmeticItems.$inferSelect, now = new Date()) {
  return item.isActive && (!item.availableUntil || item.availableUntil > now);
}

function isNewItem(createdAt: Date, now = new Date()) {
  return now.getTime() - createdAt.getTime() <= 14 * 24 * 60 * 60 * 1000;
}

function publicItem(
  item: typeof cosmeticItems.$inferSelect,
  owned: Set<string>,
  equipped: Set<string>,
  bundleItems: string[] = [],
) {
  const state: StoreItemState = equipped.has(item.id)
    ? "equipped"
    : owned.has(item.id)
      ? "owned"
      : "not_owned";
  return {
    id: item.id,
    slug: item.slug,
    title: item.title,
    description: item.description,
    category: item.category,
    type: item.type,
    slot: item.slot,
    rarity: item.rarity,
    priceOrbs: item.price,
    priceMoneyCents: item.priceMoneyCents,
    preview: item.preview,
    previewImage: item.previewImage ?? item.preview,
    previewAnimation: item.previewAnimation,
    superflipOnly: item.superflipOnly,
    isBundle: item.isBundle,
    isAnimated: item.isAnimated,
    isActive: item.isActive,
    isNew: isNewItem(item.createdAt),
    availableUntil: item.availableUntil,
    createdAt: item.createdAt,
    state,
    bundleItems,
  };
}

function sortItems<T extends { price: number; createdAt: Date; rarity: string; title: string }>(items: T[], sort = "featured") {
  const rarityWeight: Record<string, number> = { common: 1, rare: 2, epic: 3, legendary: 4, limited: 5 };
  return [...items].sort((a, b) => {
    if (sort === "price_asc") return a.price - b.price || a.title.localeCompare(b.title, "ru");
    if (sort === "price_desc") return b.price - a.price || a.title.localeCompare(b.title, "ru");
    if (sort === "newest") return b.createdAt.getTime() - a.createdAt.getTime();
    if (sort === "rarity") return (rarityWeight[b.rarity] ?? 0) - (rarityWeight[a.rarity] ?? 0) || a.title.localeCompare(b.title, "ru");
    return Number(b.isBundle ?? false) - Number(a.isBundle ?? false) || Number(b.isAnimated ?? false) - Number(a.isAnimated ?? false) || a.price - b.price;
  });
}

export async function getStoreSnapshot(userId: string, filters: StoreFilters = {}) {
  const db = getDatabase();
  const now = new Date();
  const [allItems, inventoryRows, equippedRows, [wallet], superflip] = await Promise.all([
    db.select().from(cosmeticItems).where(and(eq(cosmeticItems.isActive, true), or(isNull(cosmeticItems.availableUntil), gt(cosmeticItems.availableUntil, now)))),
    db.select().from(cosmeticInventory).where(eq(cosmeticInventory.userId, userId)),
    db.select().from(cosmeticEquipped).where(eq(cosmeticEquipped.userId, userId)),
    db.select({ balance: userWallets.balance }).from(userWallets).where(eq(userWallets.userId, userId)).limit(1),
    getSuperFlipCapabilities(userId),
  ]);

  const q = filters.q?.trim().toLocaleLowerCase("ru") ?? "";
  let visible = allItems.filter((item) =>
    (!q || item.title.toLocaleLowerCase("ru").includes(q) || item.description.toLocaleLowerCase("ru").includes(q) || item.slug.toLocaleLowerCase("ru").includes(q)) &&
    (!filters.category || filters.category === "all" || item.category === filters.category) &&
    (!filters.slot || filters.slot === "all" || item.slot === filters.slot) &&
    (!filters.rarity || filters.rarity === "all" || item.rarity === filters.rarity),
  );
  visible = sortItems(visible, filters.sort ?? "featured");

  const offset = Math.max(0, filters.offset ?? 0);
  const limit = Math.max(1, Math.min(100, filters.limit ?? 24));
  const pageItems = visible.slice(offset, offset + limit);
  const bundleIds = pageItems.filter((item) => item.isBundle).map((item) => item.id);
  const bundleRows = bundleIds.length
    ? await db.select().from(cosmeticBundleEntries).where(inArray(cosmeticBundleEntries.bundleId, bundleIds))
    : [];
  const bundleMap = new Map<string, string[]>();
  for (const row of bundleRows) bundleMap.set(row.bundleId, [...(bundleMap.get(row.bundleId) ?? []), row.itemId]);

  const owned = new Set(inventoryRows.map((row) => row.itemId));
  const equipped = new Set(equippedRows.map((row) => row.itemId));
  return {
    items: pageItems.map((item) => publicItem(item, owned, equipped, bundleMap.get(item.id) ?? [])),
    total: visible.length,
    offset,
    limit,
    hasMore: offset + pageItems.length < visible.length,
    balance: wallet?.balance ?? 0,
    superflipActive: superflip.active,
    equipped: Object.fromEntries(equippedRows.map((row) => [row.slot, row.itemId])),
    categories: [...new Set(allItems.map((item) => item.category))].sort(),
    slots: [...new Set(allItems.filter((item) => !item.isBundle).map((item) => item.slot))].sort(),
    rarities: [...new Set(allItems.map((item) => item.rarity))],
  };
}

export async function getInventorySnapshot(userId: string) {
  const db = getDatabase();
  const [ownedRows, equippedRows] = await Promise.all([
    db.select({
      item: cosmeticItems,
      source: cosmeticInventory.source,
      acquiredAt: cosmeticInventory.acquiredAt,
    }).from(cosmeticInventory).innerJoin(cosmeticItems, eq(cosmeticItems.id, cosmeticInventory.itemId)).where(eq(cosmeticInventory.userId, userId)),
    db.select().from(cosmeticEquipped).where(eq(cosmeticEquipped.userId, userId)),
  ]);
  const owned = new Set(ownedRows.map((row) => row.item.id));
  const equipped = new Set(equippedRows.map((row) => row.itemId));
  const bundleIds = ownedRows.filter((row) => row.item.isBundle).map((row) => row.item.id);
  const bundleRows = bundleIds.length
    ? await db.select().from(cosmeticBundleEntries).where(inArray(cosmeticBundleEntries.bundleId, bundleIds))
    : [];
  const bundleMap = new Map<string, string[]>();
  for (const row of bundleRows) bundleMap.set(row.bundleId, [...(bundleMap.get(row.bundleId) ?? []), row.itemId]);

  const items = ownedRows
    .map((row) => ({
      ...publicItem(row.item, owned, equipped, bundleMap.get(row.item.id) ?? []),
      source: row.source,
      acquiredAt: row.acquiredAt,
    }))
    .sort((a, b) => b.acquiredAt.getTime() - a.acquiredAt.getTime());

  return {
    items,
    equipped: Object.fromEntries(equippedRows.map((row) => [row.slot, row.itemId])),
    slots: STORE_SLOTS,
  };
}

export async function getStoreCategories(userId: string) {
  const snapshot = await getStoreSnapshot(userId, { limit: 1 });
  return { categories: snapshot.categories, slots: snapshot.slots, rarities: snapshot.rarities };
}

export async function purchaseStoreItem(userId: string, itemId: string) {
  const db = getDatabase();
  const [item] = await db.select().from(cosmeticItems).where(eq(cosmeticItems.id, itemId)).limit(1);
  if (!item || !activeItem(item)) throw new StoreActionError("unavailable", "Предмет сейчас недоступен.", 404);
  if (item.superflipOnly && !(await getSuperFlipCapabilities(userId)).active) {
    throw new StoreActionError("superflip_required", "Для этого предмета нужен активный SuperFlip.", 403);
  }
  if (!Number.isSafeInteger(item.price) || item.price < 0) throw new StoreActionError("invalid_price", "Некорректная цена предмета.", 409);

  const result = await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${userId}))`);
    const [alreadyOwned] = await tx.select({ itemId: cosmeticInventory.itemId }).from(cosmeticInventory)
      .where(and(eq(cosmeticInventory.userId, userId), eq(cosmeticInventory.itemId, itemId))).limit(1);
    if (alreadyOwned) return "already_owned" as const;

    const bundleEntries = item.isBundle
      ? await tx.select({ itemId: cosmeticBundleEntries.itemId }).from(cosmeticBundleEntries).where(eq(cosmeticBundleEntries.bundleId, item.id))
      : [];
    if (item.isBundle && !bundleEntries.length) return "empty_bundle" as const;

    if (item.price > 0) {
      const charged = await debitCoins(tx, userId, item.price, `Покупка: ${item.title}`, `store:${item.id}`);
      if (!charged) return "insufficient_funds" as const;
    }

    await tx.insert(cosmeticInventory).values({ userId, itemId: item.id, source: "purchase" });
    for (const entry of bundleEntries) {
      await tx.insert(cosmeticInventory).values({ userId, itemId: entry.itemId, source: "bundle" }).onConflictDoNothing();
    }
    return "purchased" as const;
  });

  if (result === "already_owned") throw new StoreActionError("already_owned", "Предмет уже есть в инвентаре.", 409);
  if (result === "empty_bundle") throw new StoreActionError("empty_bundle", "В наборе пока нет предметов.", 409);
  if (result === "insufficient_funds") throw new StoreActionError("insufficient_funds", "Недостаточно Orbs.", 409);
  return getInventorySnapshot(userId);
}

export async function equipInventoryItem(userId: string, itemId: string) {
  const db = getDatabase();
  await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${userId}))`);
    const [row] = await tx.select({ item: cosmeticItems, ownedItemId: cosmeticInventory.itemId })
      .from(cosmeticInventory)
      .innerJoin(cosmeticItems, eq(cosmeticItems.id, cosmeticInventory.itemId))
      .where(and(eq(cosmeticInventory.userId, userId), eq(cosmeticInventory.itemId, itemId)))
      .limit(1);
    if (!row) throw new StoreActionError("not_owned", "Сначала добавьте предмет в инвентарь.", 403);
    if (row.item.isBundle || row.item.slot === "bundle") throw new StoreActionError("bundle_not_equippable", "Набор нельзя надеть целиком.", 409);
    if (!STORE_SLOTS.includes(row.item.slot as StoreSlot)) throw new StoreActionError("invalid_slot", "Этот предмет нельзя экипировать.", 409);

    await tx.insert(cosmeticEquipped)
      .values({ userId, slot: row.item.slot, itemId })
      .onConflictDoUpdate({
        target: [cosmeticEquipped.userId, cosmeticEquipped.slot],
        set: { itemId },
      });
    if (row.item.slot === "app_theme") {
      await tx.insert(userPreferences).values({ userId, theme: row.item.preview })
        .onConflictDoUpdate({ target: userPreferences.userId, set: { theme: row.item.preview, updatedAt: new Date() } });
    }
  });
  return getInventorySnapshot(userId);
}

export async function unequipInventorySlot(userId: string, slot: string) {
  if (!STORE_SLOTS.includes(slot as StoreSlot)) throw new StoreActionError("invalid_slot", "Неизвестный слот.", 400);
  const db = getDatabase();
  await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${userId}))`);
    await tx.delete(cosmeticEquipped).where(and(eq(cosmeticEquipped.userId, userId), eq(cosmeticEquipped.slot, slot)));
    if (slot === "app_theme") {
      await tx.insert(userPreferences).values({ userId, theme: "midnight" })
        .onConflictDoUpdate({ target: userPreferences.userId, set: { theme: "midnight", updatedAt: new Date() } });
    }
  });
  return getInventorySnapshot(userId);
}
