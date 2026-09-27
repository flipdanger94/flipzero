"use client";
import { AppIcon } from "../app-icon";

import { Currency } from "./item-card";
import { type Quest } from "./types";

type Props = {
  streak: number;
  quests: Quest[];
  busy: string;
  claimQuest: (key: string) => Promise<void>;
};
export function QuestsTab({ streak, quests, busy, claimQuest }: Props) {
  return (
    <div className="quests-page">
      <div className="personal-streak">
        <AppIcon name="gift" size={22} />
        <span>
          <strong>Серия: {streak} дн.</strong>
          <small>Зарабатывайте монет и открывайте новые предметы.</small>
        </span>
      </div>
      {!quests.length?<div className="store-empty"><strong>Заданий пока нет</strong><p>Новые квесты появятся здесь.</p></div>:null}
      <div className="personal-economy-grid">
        {quests.map((quest) => (
          <article key={quest.key}>
            <small>
              {quest.period === "daily" ? "ЕЖЕДНЕВНЫЙ" : "ЕЖЕНЕДЕЛЬНЫЙ"}
            </small>
            <strong>{quest.title}</strong>
            <p>{quest.description}</p>
            <div
              className="personal-progress"
              role="progressbar"
              aria-valuenow={quest.progress}
              aria-valuemin={0}
              aria-valuemax={quest.target}
              aria-label={quest.title}
            >
              <i
                style={{
                  width: `${Math.min(100, (100 * quest.progress) / quest.target)}%`,
                }}
              />
            </div>
            <span>
              {quest.progress}/{quest.target} · {quest.xp} XP ·{" "}
              <Currency amount={quest.coins} />
            </span>
            <button
              disabled={
                quest.claimed || quest.progress < quest.target || !!busy
              }
              onClick={() => void claimQuest(quest.key)}
            >
              {quest.claimed
                ? "Получено"
                : busy === quest.key
                  ? "Забираем…"
                  : "Забрать"}
            </button>
          </article>
        ))}
      </div>
    </div>
  );
}
