"use client";
import { AppIcon } from "../app-icon";

import { Currency } from "./item-card";
import { type Ledger } from "./types";

type Props = { ledger: Ledger[] };
export function HistoryTab({ ledger }: Props) {
  return (
    <div className="personal-ledger">
      {ledger.length ? (
        ledger.map((entry) => (
          <article key={entry.id}>
            <span>
              <strong>{entry.reason}</strong>
              <small>{new Date(entry.createdAt).toLocaleString("ru-RU")}</small>
            </span>
            <b className={entry.amount > 0 ? "positive" : ""}>
              {entry.amount > 0 ? "+" : ""}
              <Currency amount={entry.amount} />
            </b>
          </article>
        ))
      ) : (
        <div className="store-empty">
          <AppIcon name="currency" size={28} />
          <strong>Операций пока нет</strong>
          <p>Выполните квест или купите первый предмет.</p>
        </div>
      )}
    </div>
  );
}
