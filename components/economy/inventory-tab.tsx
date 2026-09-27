"use client";
import { AppIcon } from "../app-icon";
import { CosmeticArt } from "../cosmetic-art";
import { ItemCard } from "./item-card";
import {
  type StoreItem,
  type InventoryResponse,
  slotLabels,
  slotIcons,
} from "./types";
import type { ReactNode } from "react";

type Props = {
  inventory: InventoryResponse;
  equippedItems: { slot: string; item: StoreItem | null }[];
  filteredInventory: InventoryResponse["items"];
  inventoryQuery: string;
  inventorySlot: string;
  inventorySort: string;
  busy: string;
  setInventoryQuery: (value: string) => void;
  setInventorySlot: (value: string) => void;
  setInventorySort: (value: string) => void;
  setTab: (value: "store" | "inventory" | "quests" | "history") => void;
  setPreview: (item: StoreItem) => void;
  actionFor: (item: StoreItem) => ReactNode;
  unequip: (item: StoreItem) => Promise<void>;
};
export function InventoryTab({
  inventory,
  equippedItems,
  filteredInventory,
  inventoryQuery,
  inventorySlot,
  inventorySort,
  busy,
  setInventoryQuery,
  setInventorySlot,
  setInventorySort,
  setTab,
  setPreview,
  actionFor,
  unequip,
}: Props) {
  return (
    <div className="inventory-page">
      <section className="inventory-equipped">
        <div className="store-section-title">
          <div>
            <small>НАДЕТО</small>
            <h3>Текущий образ</h3>
          </div>
          <span>
            Новый предмет автоматически заменяет старый в том же слоте.
          </span>
        </div>
        <div className="equipped-slots">
          {(inventory.slots.length ? inventory.slots : Object.keys(slotLabels))
            .filter((slot) => slot !== "bundle")
            .map((slot) => {
              const current =
                equippedItems.find((entry) => entry.slot === slot)?.item ??
                null;
              return (
                <article key={slot} className={current ? "filled" : ""}>
                  <div className="equipped-slot-head">
                    <span>
                      <AppIcon
                        name={slotIcons[slot] ?? "inventory"}
                        size={15}
                      />
                      {slotLabels[slot] ?? slot}
                    </span>
                    {current ? <b>Надето</b> : null}
                  </div>
                  {current ? (
                    <>
                      <CosmeticArt live item={current} />
                      <strong>{current.title}</strong>
                      <button
                        onClick={() => void unequip(current)}
                        disabled={!!busy}
                      >
                        Снять
                      </button>
                    </>
                  ) : (
                    <>
                      <div className="equipped-placeholder">
                        <AppIcon name="animated" size={24} />
                      </div>
                      <strong>Слот свободен</strong>
                      <button
                        onClick={() => {
                          setInventorySlot(slot);
                          document
                            .querySelector(".inventory-all")
                            ?.scrollIntoView({ behavior: "smooth" });
                        }}
                      >
                        Выбрать предмет
                      </button>
                    </>
                  )}
                </article>
              );
            })}
        </div>
      </section>

      <section className="inventory-all">
        <div className="store-section-title">
          <div>
            <small>КОЛЛЕКЦИЯ</small>
            <h3>Все предметы</h3>
          </div>
          <span>{inventory.items.length} в коллекции</span>
        </div>
        <div className="store-toolbar">
          <label className="store-search">
            <AppIcon name="search" size={16} />
            <input
              value={inventoryQuery}
              onChange={(event) => setInventoryQuery(event.target.value)}
              placeholder="Поиск в инвентаре"
              aria-label="Поиск в инвентаре"
            />
          </label>
          <select
            value={inventorySlot}
            onChange={(event) => setInventorySlot(event.target.value)}
            aria-label="Фильтр по слоту"
          >
            <option value="all">Все слоты</option>
            {inventory.slots
              .filter((slot) => slot !== "bundle")
              .map((slot) => (
                <option key={slot} value={slot}>
                  {slotLabels[slot] ?? slot}
                </option>
              ))}
          </select>
          <select
            value={inventorySort}
            onChange={(event) => setInventorySort(event.target.value)}
            aria-label="Сортировка инвентаря"
          >
            <option value="newest">Сначала новые</option>
            <option value="rarity">По редкости</option>
            <option value="name">По названию</option>
          </select>
        </div>
        <div className="inventory-grid">
          {filteredInventory.map((item) => (
            <ItemCard
              key={item.id}
              item={item}
              acquiredAt={item.acquiredAt}
              extraAction={
                <button className="preview" onClick={() => setTab("store")}>
                  В магазин
                </button>
              }
              onPreview={() => setPreview(item)}
              action={actionFor(item)}
            />
          ))}
        </div>
        {!filteredInventory.length ? (
          <div className="store-empty">
            <AppIcon name="inventory" size={30} />
            <strong>В этом разделе пока пусто</strong>
            <p>Откройте магазин и добавьте первые предметы в коллекцию.</p>
            <button onClick={() => setTab("store")}>Открыть магазин</button>
          </div>
        ) : null}
      </section>
    </div>
  );
}
