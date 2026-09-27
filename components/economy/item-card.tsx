"use client";
import { useState, type ReactNode } from "react";
import { AppIcon } from "../app-icon";
import { CosmeticArt } from "../cosmetic-art";
import { type StoreItem, categoryLabels, rarityLabels } from "./types";

export function Currency({ amount }: { amount: number }) {
  return (
    <span className="store-currency">
      <AppIcon name="currency" size={14} />
      <span>{amount.toLocaleString("ru-RU")}</span>
      <span className="sr-only"> монет</span>
    </span>
  );
}

export function ItemBadges({ item }: { item: StoreItem }) {
  return (
    <div className="store-item-badges">
      {item.state !== "not_owned" ? (
        <span className={item.state}>
          <AppIcon name="check" size={11} />
          {item.state === "equipped" ? "Надето" : "Куплено"}
        </span>
      ) : null}
      {item.availableUntil ? (
        <span>
          <time dateTime={item.availableUntil}>
            До{" "}
            {new Date(item.availableUntil).toLocaleString("ru-RU", {
              dateStyle: "short",
              timeStyle: "short",
            })}
          </time>
        </span>
      ) : item.rarity === "limited" ? (
        <span>Лимитировано</span>
      ) : item.isNew ? (
        <span>Новое</span>
      ) : null}
    </div>
  );
}

export function ItemCard({
  item,
  action,
  onPreview,
  acquiredAt,
  previewMode = false,
  children,
  extraAction,
}: {
  item: StoreItem;
  action: ReactNode;
  onPreview?: () => void;
  acquiredAt?: string;
  previewMode?: boolean;
  children?: ReactNode;
  extraAction?: ReactNode;
}) {
  const [live, setLive] = useState(false);
  return (
    <article
      className={previewMode ? "store-preview-copy" : "store-item-card"}
      onMouseEnter={() => setLive(true)}
      onMouseLeave={() => setLive(false)}
      onFocus={() => setLive(true)}
      onBlur={() => setLive(false)}
    >
      {!previewMode ? (
        <div className="store-item-visual">
          <CosmeticArt live={live} item={item} />
          <ItemBadges item={item} />
        </div>
      ) : (
        <ItemBadges item={item} />
      )}
      <div className="store-item-copy">
        <small>
          {rarityLabels[item.rarity] ?? item.rarity} ·{" "}
          {categoryLabels[item.category] ?? item.category}
        </small>
        <h4>{item.title}</h4>
        <p>{item.description}</p>
        {acquiredAt ? (
          <p>Получено {new Date(acquiredAt).toLocaleDateString("ru-RU")}</p>
        ) : (
          <div className="store-item-price">
            <strong>
              <Currency amount={item.priceOrbs} />
            </strong>
            {item.superflipOnly ? (
              <span>
                <AppIcon name="superflip" size={12} />
                SuperFlip
              </span>
            ) : null}
          </div>
        )}
        {children}
      </div>
      <div className="store-card-actions">
        {onPreview ? (
          <button className="preview" onClick={onPreview}>
            <AppIcon name="preview" size={15} />
            Просмотр
          </button>
        ) : null}
        {extraAction}
        {action}
      </div>
    </article>
  );
}
