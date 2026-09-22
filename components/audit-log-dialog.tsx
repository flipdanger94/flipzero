"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, LoaderCircle, Search, X } from "lucide-react";

type AuditItem = {
  id: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  actor: { id: string; displayName: string; username: string; avatarUrl: string | null } | null;
};

const labels: Record<string, string> = {
  "space.update": "Изменены настройки сервера",
  "space.ownership.transfer": "Передано владение сервером",
  "channel.create": "Создан канал",
  "channel.update": "Изменён канал",
  "channel.delete": "Удалён канал",
  "category.create": "Создана категория",
  "category.update": "Изменена категория",
  "category.delete": "Удалена категория",
  "category.reorder": "Изменён порядок категорий",
  "role.create": "Создана роль",
  "role.update": "Изменена роль",
  "role.delete": "Удалена роль",
  "role.reorder": "Изменён порядок ролей",
  "member.roles.update": "Изменены роли участника",
  "member.kick": "Участник исключён",
  "member.leave": "Участник вышел",
  "moderation.warn": "Выдано предупреждение",
  "moderation.timeout": "Выдан таймаут",
  "moderation.kick": "Участник исключён модерацией",
  "moderation.ban": "Участник заблокирован",
  "moderation.unban": "Пользователь разблокирован",
  "moderation.flag.remove": "Удалено сообщение по флагу",
  "moderation.flag.dismiss": "Флаг модерации отклонён",
};

export function AuditLogDialog({ spaceId, onClose }: { spaceId: string; onClose: () => void }) {
  const [items, setItems] = useState<AuditItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/v1/spaces/${spaceId}/audit`, { signal: controller.signal, cache: "no-store" })
      .then(async (response) => ({ response, data: await response.json() }))
      .then(({ response, data }) => {
        if (!response.ok) throw new Error(data?.message ?? "Не удалось загрузить журнал.");
        setItems(data.logs ?? []);
      })
      .catch((reason) => {
        if (reason?.name !== "AbortError") setError(reason?.message ?? "Не удалось загрузить журнал.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [spaceId]);

  const filtered = useMemo(() => {
    const value = query.trim().toLocaleLowerCase("ru");
    if (!value) return items;
    return items.filter((item) => {
      const actor = item.actor ? `${item.actor.displayName} @${item.actor.username}` : "";
      const target = `${item.targetType ?? ""} ${item.targetId ?? ""}`;
      return `${labels[item.action] ?? item.action} ${actor} ${target}`.toLocaleLowerCase("ru").includes(value);
    });
  }, [items, query]);

  return <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="space-dialog audit-dialog" role="dialog" aria-modal="true" aria-labelledby="audit-title">
      <button className="dialog-close" onClick={onClose} aria-label="Закрыть"><X size={19} /></button>
      <div className="dialog-symbol"><Activity size={22} /></div>
      <h2 id="audit-title">Журнал действий</h2>
      <p>Последние изменения и модераторские действия в сервере.</p>
      <label className="audit-search"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Поиск по действию или участнику" /></label>
      {error ? <div className="auth-error" role="alert">{error}</div> : null}
      {loading ? <div className="role-loading"><LoaderCircle className="spin" size={20} /> Загружаем журнал...</div> : filtered.length ? <div className="audit-list">{filtered.map((item) => <article key={item.id}><span className="audit-dot" /><div><strong>{labels[item.action] ?? item.action}</strong><small>{item.actor ? `${item.actor.displayName} · @${item.actor.username}` : "Системное действие"} · {new Date(item.createdAt).toLocaleString("ru-RU")}</small>{item.targetId ? <code>{item.targetType ?? "target"}: {item.targetId}</code> : null}</div></article>)}</div> : <div className="role-protected"><Activity size={28} /><strong>Записей нет</strong><span>Новые изменения сервера появятся здесь.</span></div>}
    </section>
  </div>;
}
