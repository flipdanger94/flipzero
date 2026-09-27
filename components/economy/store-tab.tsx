"use client";
import { AppIcon } from "../app-icon";
import { CosmeticArt } from "../cosmetic-art";
import { ItemCard } from "./item-card";
import { type StoreItem, categoryLabels } from "./types";
import type { ReactNode, Dispatch, SetStateAction } from "react";

type Props = {
  featuredBundles: StoreItem[];
  storeItems: StoreItem[];
  filteredStore: StoreItem[];
  query: string;
  sort: string;
  category: string;
  visibleLimit: number;
  setCategory: (value: string) => void;
  setQuery: (value: string) => void;
  setSort: (value: string) => void;
  setVisibleLimit: Dispatch<SetStateAction<number>>;
  setTab: (value: "store" | "inventory" | "quests" | "history") => void;
  setPreview: (item: StoreItem) => void;
  actionFor: (item: StoreItem) => ReactNode;
};
export function StoreTab({
  featuredBundles,
  storeItems,
  filteredStore,
  query,
  sort,
  category,
  visibleLimit,
  setCategory,
  setQuery,
  setSort,
  setVisibleLimit,
  setTab,
  setPreview,
  actionFor,
}: Props) {
  return (
    <div className="store-page">
      <section className="store-hero">
        <div>
          <span>
            <AppIcon name="animated" size={14} /> КОЛЛЕКЦИИ FLIPZERO
          </span>
          <h2>Найдите свой стиль.</h2>
          <p>
            Рамки, живые эффекты, баннеры, темы и наборы. Анимированные предметы
            запускаются при наведении и в предпросмотре.
          </p>
          <div>
            <button
              onClick={() => {
                setCategory("bundle");
                document
                  .querySelector(".store-catalog")
                  ?.scrollIntoView({ behavior: "smooth" });
              }}
            >
              Смотреть наборы
            </button>
            <button className="ghost" onClick={() => setTab("inventory")}>
              Моя коллекция
            </button>
          </div>
        </div>
        <div className="store-hero-art" aria-hidden="true">
          <CosmeticArt
            live
            item={
              featuredBundles[0] ??
              storeItems[0] ?? { title: "FlipZero", preview: "bundle-neon" }
            }
          />
          <CosmeticArt
            live
            item={
              featuredBundles[1] ??
              storeItems[1] ?? { title: "FlipZero", preview: "aurora-wave" }
            }
          />
        </div>
      </section>

      {featuredBundles.length ? (
        <section className="store-featured">
          <div className="store-section-title">
            <div>
              <small>ПОДБОРКА</small>
              <h3>Наборы недели</h3>
            </div>
            <span>В одном наборе — несколько предметов для разных слотов.</span>
          </div>
          <div className="store-featured-grid">
            {featuredBundles.map((item) => (
              <ItemCard
                key={item.id}
                item={item}
                onPreview={() => setPreview(item)}
                action={actionFor(item)}
              />
            ))}
          </div>
        </section>
      ) : null}

      <section className="store-catalog">
        <div className="store-section-title">
          <div>
            <small>МАГАЗИН</small>
            <h3>Косметика</h3>
          </div>
          <span>{filteredStore.length} предметов</span>
        </div>
        <div className="store-toolbar">
          <label className="store-search">
            <AppIcon name="search" size={16} />
            <input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setVisibleLimit(12);
              }}
              placeholder="Поиск по магазину"
              aria-label="Поиск по магазину"
            />
          </label>
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value)}
            aria-label="Сортировка магазина"
          >
            <option value="featured">Для вас</option>
            <option value="newest">Сначала новые</option>
            <option value="rarity">По редкости</option>
            <option value="price_asc">Сначала дешевле</option>
            <option value="price_desc">Сначала дороже</option>
          </select>
        </div>
        <div className="store-categories" aria-label="Категории">
          <button
            className={category === "all" ? "active" : ""}
            onClick={() => {
              setCategory("all");
              setVisibleLimit(12);
            }}
          >
            Все
          </button>
          {[...new Set(storeItems.map((item) => item.category))].map(
            (value) => (
              <button
                key={value}
                className={category === value ? "active" : ""}
                onClick={() => {
                  setCategory(value);
                  setVisibleLimit(12);
                }}
              >
                {categoryLabels[value] ?? value}
              </button>
            ),
          )}
        </div>
        <div className="store-grid">
          {filteredStore.slice(0, visibleLimit).map((item) => (
            <ItemCard
              key={item.id}
              item={item}
              onPreview={() => setPreview(item)}
              action={actionFor(item)}
            />
          ))}
        </div>
        {visibleLimit < filteredStore.length ? (
          <div className="store-more">
            <span>Это ещё далеко не всё</span>
            <button onClick={() => setVisibleLimit((value) => value + 16)}>
              Показать ещё предметы
            </button>
          </div>
        ) : null}
        {!filteredStore.length ? (
          <div className="store-empty">
            <AppIcon name="search" size={28} />
            <strong>Ничего не найдено</strong>
            <p>Попробуйте другой запрос или категорию.</p>
          </div>
        ) : null}
      </section>
    </div>
  );
}
