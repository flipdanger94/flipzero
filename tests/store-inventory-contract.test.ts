import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("store and inventory contracts", () => {
  it("extends the existing cosmetics model instead of creating a duplicate store stack", async () => {
    const [schema, migration] = await Promise.all([
      readFile("db/schema.ts", "utf8"),
      readFile("drizzle/0033_store_inventory.sql", "utf8"),
    ]);
    expect(schema).toContain('export const cosmeticItems=pgTable("cosmetic_items"');
    expect(schema).toContain('export const cosmeticInventory=pgTable("cosmetic_inventory"');
    expect(schema).toContain('export const cosmeticEquipped=pgTable("cosmetic_equipped"');
    expect(schema).toContain('export const cosmeticBundleEntries=pgTable("cosmetic_bundle_entries"');
    expect(migration).toContain("PRIMARY KEY(bundle_id,item_id)");
    expect(migration).toContain("ALTER TABLE cosmetic_equipped RENAME COLUMN category TO slot");
    expect(migration).toContain("cosmetic_items_slug_unique");
  });

  it("keeps one equipped item per slot and replaces the previous item atomically", async () => {
    const source = await readFile("lib/store.ts", "utf8");
    expect(source).toContain('SELECT pg_advisory_xact_lock');
    expect(source).toContain("target: [cosmeticEquipped.userId, cosmeticEquipped.slot]");
    expect(source).toContain("set: { itemId }");
    expect(source).toContain('throw new StoreActionError("not_owned"');
    expect(source).toContain('throw new StoreActionError("bundle_not_equippable"');
  });

  it("keeps deactivated owned items equippable but blocks unavailable purchases", async () => {
    const source = await readFile("lib/store.ts", "utf8");
    expect(source).toContain("if (!item || !activeItem(item))");
    const equipStart = source.indexOf("export async function equipInventoryItem");
    const equipEnd = source.indexOf("export async function unequipInventorySlot");
    const equipSource = source.slice(equipStart, equipEnd);
    expect(equipSource).not.toContain("activeItem(");
  });

  it("expands bundles into inventory and blocks buying the same container twice", async () => {
    const source = await readFile("lib/store.ts", "utf8");
    expect(source).toContain('return "already_owned" as const');
    expect(source).toContain('source: "bundle"');
    expect(source).toContain("cosmeticBundleEntries.bundleId");
    expect(source).toContain('new StoreActionError("already_owned"');
  });

  it("exposes the requested store and inventory endpoints", async () => {
    const routes = await Promise.all([
      readFile("app/api/store/route.ts", "utf8"),
      readFile("app/api/store/categories/route.ts", "utf8"),
      readFile("app/api/store/purchase/route.ts", "utf8"),
      readFile("app/api/inventory/route.ts", "utf8"),
      readFile("app/api/inventory/equip/route.ts", "utf8"),
      readFile("app/api/inventory/unequip/route.ts", "utf8"),
    ]);
    expect(routes.every((source) => source.includes("getCurrentUser"))).toBe(true);
    expect(routes[2]).toContain("purchaseStoreItem");
    expect(routes[4]).toContain("equipInventoryItem");
    expect(routes[5]).toContain("unequipInventorySlot");
  });

  it("seeds animated items and bundles with static fallback metadata", async () => {
    const items = JSON.parse(await readFile("config/cosmetics.json", "utf8")) as Array<Record<string, unknown>>;
    expect(items.some((item) => item.isAnimated === true && typeof item.previewAnimation === "string")).toBe(true);
    expect(items.some((item) => item.isBundle === true && Array.isArray(item.bundleItems))).toBe(true);
    for (const item of items.filter((entry) => entry.isAnimated === true)) {
      expect(typeof item.previewImage).toBe("string");
    }
  });
});
