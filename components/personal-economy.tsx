"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AppIcon } from "./app-icon";
import { StoreTab } from "./economy/store-tab";
import { InventoryTab } from "./economy/inventory-tab";
import { QuestsTab } from "./economy/quests-tab";
import { HistoryTab } from "./economy/history-tab";
import { Dialog } from "./ui/dialog";
import { ItemCard, Currency } from "./economy/item-card";
import {
  type Ledger,
  type Quest,
  type StoreItem,
  type StoreResponse,
  type InventoryResponse,
  type StoreProfile,
  slotLabels,
  categoryLabels,
} from "./economy/types";
import { ProfileAppearanceSurface } from "./profile-appearance-surface";

function withEquippedState<T extends StoreItem>(
  items: T[],
  equipped: Record<string, string>,
) {
  const equippedIds = new Set(Object.values(equipped));
  return items.map(
    (item) =>
      ({
        ...item,
        state: equippedIds.has(item.id)
          ? "equipped"
          : item.state === "not_owned"
            ? "not_owned"
            : "owned",
      }) as T,
  );
}

export function PersonalEconomy({
  onOpenSuperFlip,
}: { onOpenSuperFlip?: () => void } = {}) {
  const router = useRouter();
  const [tab, setTab] = useState<"quests" | "store" | "inventory" | "history">(
    "store",
  );
  const [balance, setBalance] = useState(0);
  const [superflipActive, setSuperflipActive] = useState(false);
  const [ledger, setLedger] = useState<Ledger[]>([]);
  const [quests, setQuests] = useState<Quest[]>([]);
  const [streak, setStreak] = useState(0);
  const [profile, setProfile] = useState<StoreProfile | null>(null);
  const [storeItems, setStoreItems] = useState<StoreItem[]>([]);
  const [inventory, setInventory] = useState<InventoryResponse>({
    items: [],
    equipped: {},
    slots: [],
  });
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [sort, setSort] = useState("featured");
  const [inventoryQuery, setInventoryQuery] = useState("");
  const [inventorySlot, setInventorySlot] = useState("all");
  const [inventorySort, setInventorySort] = useState("newest");
  const [visibleLimit, setVisibleLimit] = useState(12);
  const [preview, setPreview] = useState<StoreItem | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [economyResponse, questResponse, storeResponse, inventoryResponse] =
        await Promise.all([
          fetch("/api/v1/economy", { cache: "no-store" }),
          fetch("/api/v1/quests", { cache: "no-store" }),
          fetch("/api/store?limit=100", { cache: "no-store" }),
          fetch("/api/inventory", { cache: "no-store" }),
        ]);
      if (
        !economyResponse.ok ||
        !questResponse.ok ||
        !storeResponse.ok ||
        !inventoryResponse.ok
      )
        throw Error("Не удалось загрузить магазин.");
      const [economy, questData, store, inventoryData] = await Promise.all([
        economyResponse.json(),
        questResponse.json(),
        storeResponse.json() as Promise<StoreResponse>,
        inventoryResponse.json() as Promise<InventoryResponse>,
      ]);
      setBalance(economy.balance);
      setLedger(economy.transactions);
      setQuests(questData.quests);
      setStreak(questData.streak);
      setStoreItems(withEquippedState(store.items, inventoryData.equipped));
      setInventory({
        ...inventoryData,
        items: withEquippedState(inventoryData.items, inventoryData.equipped),
      });
      setSuperflipActive(Boolean(store.superflipActive));
      setError("");
    } catch {
      setError("Не удалось загрузить данные. Повторите попытку.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void refresh(), 0);
    void fetch("/api/v1/auth/me", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then(async (data) => {
        const user = data?.user;
        if (!user?.id) return;
        const response = await fetch(`/api/v1/users/${user.id}/profile`, {
          cache: "no-store",
        });
        const result = await response.json().catch(() => null);
        if (response.ok && result?.profile) setProfile(result.profile);
        else
          setProfile({
            id: user.id,
            username: user.username ?? "flipzero",
            displayName: user.displayName ?? user.username ?? "Ваш профиль",
            avatarUrl: user.avatarUrl ?? null,
            bannerUrl: user.bannerUrl ?? null,
            presence: "online",
            globalLevel: 1,
            globalXp: 0,
            cosmetics: {},
          });
      })
      .catch(() => undefined);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  async function post(path: string, body: object) {
    const response = await fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw Error(data.message ?? "Действие не выполнено.");
    return data;
  }

  async function claimQuest(key: string) {
    setBusy(key);
    setError("");
    try {
      await post("/api/v1/quests", { questKey: key });
      await refresh();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Не удалось забрать награду.",
      );
    } finally {
      setBusy("");
    }
  }

  async function purchase(item: StoreItem) {
    if (item.superflipOnly && !superflipActive) {
      setError("Для этого предмета нужен активный SuperFlip.");
      return;
    }
    if (balance < item.priceOrbs) {
      setError(`Не хватает ${item.priceOrbs - balance} монет.`);
      return;
    }
    setBusy(item.id);
    setError("");
    try {
      await post("/api/store/purchase", { itemId: item.id });
      await refresh();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Покупка не выполнена.",
      );
    } finally {
      setBusy("");
    }
  }

  async function equip(item: StoreItem) {
    const previous = inventory;
    const nextEquipped = { ...inventory.equipped, [item.slot]: item.id };
    setInventory((current) => ({
      ...current,
      equipped: nextEquipped,
      items: withEquippedState(current.items, nextEquipped),
    }));
    setStoreItems((current) => withEquippedState(current, nextEquipped));
    setBusy(item.id);
    setError("");
    try {
      const data = await post("/api/inventory/equip", { itemId: item.id });
      if (data.inventory)
        setInventory({
          ...data.inventory,
          items: withEquippedState(
            data.inventory.items,
            data.inventory.equipped,
          ),
        });
      if (item.slot === "app_theme")
        window.dispatchEvent(new Event("flipzero:preferences-updated"));
      await refresh();
    } catch (reason) {
      setInventory(previous);
      setStoreItems((current) => withEquippedState(current, previous.equipped));
      setError(
        reason instanceof Error ? reason.message : "Не удалось надеть предмет.",
      );
    } finally {
      setBusy("");
    }
  }

  async function unequip(item: StoreItem) {
    const previous = inventory;
    const nextEquipped = { ...inventory.equipped };
    delete nextEquipped[item.slot];
    setInventory((current) => ({
      ...current,
      equipped: nextEquipped,
      items: withEquippedState(current.items, nextEquipped),
    }));
    setStoreItems((current) => withEquippedState(current, nextEquipped));
    setBusy(item.id);
    setError("");
    try {
      const data = await post("/api/inventory/unequip", { slot: item.slot });
      if (data.inventory)
        setInventory({
          ...data.inventory,
          items: withEquippedState(
            data.inventory.items,
            data.inventory.equipped,
          ),
        });
      if (item.slot === "app_theme")
        window.dispatchEvent(new Event("flipzero:preferences-updated"));
      await refresh();
    } catch (reason) {
      setInventory(previous);
      setStoreItems((current) => withEquippedState(current, previous.equipped));
      setError(
        reason instanceof Error ? reason.message : "Не удалось снять предмет.",
      );
    } finally {
      setBusy("");
    }
  }

  const filteredStore = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("ru");
    const rarityWeight: Record<string, number> = {
      common: 1,
      rare: 2,
      epic: 3,
      legendary: 4,
      limited: 5,
    };
    return [...storeItems]
      .filter(
        (item) =>
          (category === "all" || item.category === category) &&
          (!q ||
            item.title.toLocaleLowerCase("ru").includes(q) ||
            item.description.toLocaleLowerCase("ru").includes(q)),
      )
      .sort((a, b) => {
        if (sort === "price_asc") return a.priceOrbs - b.priceOrbs;
        if (sort === "price_desc") return b.priceOrbs - a.priceOrbs;
        if (sort === "newest")
          return (
            Number(b.isNew) - Number(a.isNew) ||
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
        if (sort === "rarity")
          return (rarityWeight[b.rarity] ?? 0) - (rarityWeight[a.rarity] ?? 0);
        return (
          Number(b.isBundle) - Number(a.isBundle) ||
          Number(b.isAnimated) - Number(a.isAnimated) ||
          a.priceOrbs - b.priceOrbs
        );
      });
  }, [storeItems, query, category, sort]);

  const filteredInventory = useMemo(() => {
    const q = inventoryQuery.trim().toLocaleLowerCase("ru");
    const rarityWeight: Record<string, number> = {
      common: 1,
      rare: 2,
      epic: 3,
      legendary: 4,
      limited: 5,
    };
    return [...inventory.items]
      .filter(
        (item) =>
          (inventorySlot === "all" || item.slot === inventorySlot) &&
          (!q || item.title.toLocaleLowerCase("ru").includes(q)),
      )
      .sort((a, b) => {
        if (inventorySort === "name")
          return a.title.localeCompare(b.title, "ru");
        if (inventorySort === "rarity")
          return (rarityWeight[b.rarity] ?? 0) - (rarityWeight[a.rarity] ?? 0);
        return (
          new Date(b.acquiredAt).getTime() - new Date(a.acquiredAt).getTime()
        );
      });
  }, [inventory.items, inventoryQuery, inventorySlot, inventorySort]);

  const featuredBundles = storeItems
    .filter((item) => item.isBundle)
    .slice(0, 2);
  const equippedItems = Object.entries(inventory.equipped).map(
    ([slot, itemId]) => ({
      slot,
      item: inventory.items.find((item) => item.id === itemId) ?? null,
    }),
  );
  const previewItem = preview
    ? (storeItems.find((item) => item.id === preview.id) ??
      inventory.items.find((item) => item.id === preview.id) ??
      preview)
    : null;
  const previewAppliedItems = useMemo(() => {
    if (!previewItem) return [] as StoreItem[];
    const all = [...storeItems, ...inventory.items];
    if (previewItem.isBundle)
      return previewItem.bundleItems
        .map((id) => all.find((item) => item.id === id))
        .filter((item): item is StoreItem => Boolean(item));
    return [previewItem];
  }, [previewItem, storeItems, inventory.items]);
  const previewCosmetics = useMemo(() => {
    const resolved = { ...(profile?.cosmetics ?? {}) };
    const all = [...storeItems, ...inventory.items];
    for (const itemId of Object.values(inventory.equipped)) {
      const equippedItem = all.find((item) => item.id === itemId);
      if (
        equippedItem &&
        [
          "avatar_frame",
          "profile_effect",
          "banner",
          "nickname",
          "message_effect",
          "badge",
        ].includes(equippedItem.category)
      )
        resolved[equippedItem.category] = equippedItem.preview;
    }
    for (const item of previewAppliedItems) {
      if (
        [
          "avatar_frame",
          "profile_effect",
          "banner",
          "nickname",
          "message_effect",
          "badge",
        ].includes(item.category)
      )
        resolved[item.category] = item.preview;
    }
    return resolved;
  }, [
    profile?.cosmetics,
    previewAppliedItems,
    storeItems,
    inventory.items,
    inventory.equipped,
  ]);
  const previewChangedSlots = previewAppliedItems.map(
    (item) =>
      slotLabels[item.slot] ?? categoryLabels[item.category] ?? item.category,
  );

  function actionFor(item: StoreItem) {
    if (item.isBundle) {
      if (item.superflipOnly && !superflipActive && item.state === "not_owned")
        return (
          <button
            onClick={() =>
              onOpenSuperFlip ? onOpenSuperFlip() : router.push("/superflip")
            }
          >
            <AppIcon name="superflip" size={14} />
            Нужен SuperFlip
          </button>
        );
      return (
        <button
          disabled={!!busy || item.state !== "not_owned"}
          onClick={() => void purchase(item)}
        >
          {busy === item.id ? (
            "Покупаем…"
          ) : item.state !== "not_owned" ? (
            "Набор куплен"
          ) : (
            <>
              <AppIcon name="buy" size={14} />
              Купить · <Currency amount={item.priceOrbs} />
            </>
          )}
        </button>
      );
    }
    if (item.state === "equipped")
      return (
        <button
          className="secondary"
          disabled={!!busy}
          onClick={() => void unequip(item)}
        >
          {busy === item.id ? (
            "Снимаем…"
          ) : (
            <>
              <AppIcon name="unequip" size={14} />
              Снять
            </>
          )}
        </button>
      );
    if (item.state === "owned")
      return (
        <button disabled={!!busy} onClick={() => void equip(item)}>
          {busy === item.id ? (
            "Надеваем…"
          ) : (
            <>
              <AppIcon name="equip" size={14} />
              Надеть
            </>
          )}
        </button>
      );
    if (item.superflipOnly && !superflipActive)
      return (
        <button
          onClick={() =>
            onOpenSuperFlip ? onOpenSuperFlip() : router.push("/superflip")
          }
        >
          Нужен SuperFlip
        </button>
      );
    return (
      <button
        disabled={!!busy || balance < item.priceOrbs}
        onClick={() => void purchase(item)}
      >
        {busy === item.id ? (
          "Покупаем…"
        ) : balance < item.priceOrbs ? (
          `Не хватает ${item.priceOrbs - balance}`
        ) : (
          <>
            <AppIcon name="buy" size={14} />
            Купить · <Currency amount={item.priceOrbs} />
          </>
        )}
      </button>
    );
  }

  return (
    <div className="personal-economy store-shell">
      <header className="store-shell-head">
        <div>
          <small>FLIPZERO STYLE</small>
          <h3>Магазин и коллекция</h3>
          <p>
            Собирайте предметы, настраивайте профиль и меняйте стиль без
            перезагрузки.
          </p>
        </div>
        <strong>
          <AppIcon name="currency" size={22} />
          {balance.toLocaleString("ru-RU")} <small>монет</small>
        </strong>
      </header>

      <nav className="store-main-tabs" aria-label="Экономика и косметика">
        <button
          className={tab === "store" ? "active" : ""}
          onClick={() => setTab("store")}
        >
          <AppIcon name="store" size={17} />
          Магазин
        </button>
        <button
          className={tab === "inventory" ? "active" : ""}
          onClick={() => setTab("inventory")}
        >
          <AppIcon name="inventory" size={17} />
          Инвентарь
        </button>
        <button
          className={tab === "quests" ? "active" : ""}
          onClick={() => setTab("quests")}
        >
          <AppIcon name="quests" size={17} />
          Квесты
        </button>
        <button
          className={tab === "history" ? "active" : ""}
          onClick={() => setTab("history")}
        >
          <AppIcon name="currency" size={17} />
          История
        </button>
      </nav>

      {error ? (
        <div role="alert" className="store-error">
          {error}
          <button
            type="button"
            aria-label="Закрыть сообщение об ошибке"
            onClick={() => setError("")}
          >
            <AppIcon name="close" size={15} />
          </button>
        </div>
      ) : null}
      {loading ? (
        <div className="social-loading">
          <AppIcon name="loading" className="spin" />
          Загружаем коллекцию…
        </div>
      ) : null}

      {!loading && tab === "store" ? (
        <StoreTab
          featuredBundles={featuredBundles}
          storeItems={storeItems}
          filteredStore={filteredStore}
          query={query}
          sort={sort}
          category={category}
          visibleLimit={visibleLimit}
          setCategory={setCategory}
          setQuery={setQuery}
          setSort={setSort}
          setVisibleLimit={setVisibleLimit}
          setTab={setTab}
          setPreview={setPreview}
          actionFor={actionFor}
        />
      ) : null}

      {!loading && tab === "inventory" ? (
        <InventoryTab
          inventory={inventory}
          equippedItems={equippedItems}
          filteredInventory={filteredInventory}
          inventoryQuery={inventoryQuery}
          inventorySlot={inventorySlot}
          inventorySort={inventorySort}
          busy={busy}
          setInventoryQuery={setInventoryQuery}
          setInventorySlot={setInventorySlot}
          setInventorySort={setInventorySort}
          setTab={setTab}
          setPreview={setPreview}
          actionFor={actionFor}
          unequip={unequip}
        />
      ) : null}

      {!loading && tab === "quests" ? (
        <QuestsTab
          streak={streak}
          quests={quests}
          busy={busy}
          claimQuest={claimQuest}
        />
      ) : null}

      {!loading && tab === "history" ? <HistoryTab ledger={ledger} /> : null}

      {previewItem ? (
        <Dialog
          backdropClassName="store-preview-backdrop"
          className="store-preview-dialog"
          label={`Предпросмотр: ${previewItem.title}`}
          onClose={() => setPreview(null)}
        >
          <button
            className="store-preview-close"
            onClick={() => setPreview(null)}
            aria-label="Закрыть"
          >
            <AppIcon name="close" size={20} />
          </button>
          <div className="store-preview-stage">
            {profile ? (
              <ProfileAppearanceSurface
                profile={profile}
                cosmetics={previewCosmetics}
                className="store-profile-live-preview"
                previewLabel="ПРЕДПРОСМОТР ОФОРМЛЕНИЯ"
                showMessagePreview
              />
            ) : (
              <div className="store-preview-loading">
                <AppIcon name="loading" className="spin" />
                <span>Загружаем ваш профиль…</span>
              </div>
            )}
          </div>
          <ItemCard
            item={previewItem}
            previewMode
            action={actionFor(previewItem)}
          >
            <div className="store-preview-impact">
              <strong>На вашем профиле изменится</strong>
              <div>
                {previewChangedSlots.length ? (
                  previewChangedSlots.map((label, index) => (
                    <span key={`${label}-${index}`}>{label}</span>
                  ))
                ) : (
                  <span>Предмет не меняет профиль напрямую.</span>
                )}
              </div>
            </div>
            <p>
              {previewItem.isAnimated ? "Анимированный предмет. " : ""}
              {previewItem.isBundle ? "Включает несколько предметов." : ""}
            </p>
          </ItemCard>
        </Dialog>
      ) : null}
    </div>
  );
}
