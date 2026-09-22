"use client";

import { type FormEvent, useEffect, useState } from "react";
import { CalendarDays, Check, Clock3, LoaderCircle, MapPin, Plus, Trash2, Users, X } from "lucide-react";
import { useModalA11y } from "@/hooks/use-modal-a11y";

type CommunityEvent = { id: string; title: string; description: string | null; location: string | null; startsAt: string; endsAt: string | null; capacity: number | null; attendeeCount: number; attending: boolean };

function dateTime(value: string) {
  return new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

export function EventsDialog({
  const dialogRef = useModalA11y(onClose); spaceId, onClose }: { spaceId: string; onClose: () => void }) {
  const [items, setItems] = useState<CommunityEvent[]>([]);
  const [isOwner, setIsOwner] = useState(false);
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/v1/spaces/${spaceId}/events`).then(async (response) => ({ response, data: await response.json() })).then(({ response, data }) => { if (!response.ok) throw new Error(data.message); setItems(data.events ?? []); setIsOwner(Boolean(data.isOwner)); }).catch((reason) => setError(reason.message ?? "Не удалось загрузить события.")).finally(() => setLoading(false));
  }, [spaceId]);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError("");
    const form = new FormData(event.currentTarget);
    const startsAt = String(form.get("startsAt"));
    const endsAt = String(form.get("endsAt"));
    const response = await fetch(`/api/v1/spaces/${spaceId}/events`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ title: form.get("title"), description: form.get("description"), location: form.get("location"), startsAt: startsAt ? new Date(startsAt).toISOString() : "", endsAt: endsAt ? new Date(endsAt).toISOString() : "", capacity: form.get("capacity") }) });
    const data = await response.json().catch(() => null); setSaving(false);
    if (!response.ok) return setError(data?.message ?? "Не удалось создать событие.");
    setItems((current) => [...current, data.event].sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())); setCreating(false);
  }

  async function toggle(item: CommunityEvent) {
    setWorkingId(item.id); setError("");
    const response = await fetch(`/api/v1/spaces/${spaceId}/events`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "attend", eventId: item.id, attending: !item.attending }) });
    const data = await response.json().catch(() => null); setWorkingId(null);
    if (!response.ok) return setError(data?.message ?? "Не удалось изменить участие.");
    setItems((current) => current.map((event) => event.id === item.id ? { ...event, attending: data.attending, attendeeCount: Math.max(0, event.attendeeCount + (data.attending ? 1 : -1)) } : event));
  }

  async function remove(eventId: string) {
    if (!window.confirm("Удалить это событие?")) return;
    setWorkingId(eventId); setError("");
    const response = await fetch(`/api/v1/spaces/${spaceId}/events?eventId=${encodeURIComponent(eventId)}`, { method: "DELETE" });
    const data = await response.json().catch(() => null); setWorkingId(null);
    if (!response.ok) return setError(data?.message ?? "Не удалось удалить событие.");
    setItems((current) => current.filter((event) => event.id !== eventId));
  }

  return <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section ref={dialogRef} tabIndex={-1} className="space-dialog events-dialog" role="dialog" aria-modal="true" aria-labelledby="events-title"><button className="dialog-close" onClick={onClose} aria-label="Закрыть"><X size={19} /></button><div className="events-heading"><span className="dialog-symbol"><CalendarDays size={22} /></span><div><h2 id="events-title">События сообщества</h2><p>Встречи, эфиры и совместные активности.</p></div>{isOwner ? <button className="events-add" onClick={() => setCreating((value) => !value)}><Plus size={16} /> Создать</button> : null}</div>{error ? <div className="auth-error" role="alert">{error}</div> : null}{creating ? <form className="event-create" onSubmit={create}><label><span>Название</span><input name="title" minLength={2} maxLength={80} placeholder="Например, Открытый микрофон" autoFocus required /></label><label><span>Место или ссылка</span><input name="location" maxLength={120} placeholder="Голосовой канал или адрес" /></label><label className="event-wide"><span>Описание</span><textarea name="description" maxLength={500} rows={2} placeholder="Расскажите, что будет происходить" /></label><label><span>Начало</span><input name="startsAt" type="datetime-local" required /></label><label><span>Окончание</span><input name="endsAt" type="datetime-local" /></label><label><span>Количество мест</span><input name="capacity" type="number" min="1" max="100000" placeholder="Без ограничений" /></label><button className="auth-submit" disabled={saving}>{saving ? <LoaderCircle className="spin" size={16} /> : <><CalendarDays size={16} /> Опубликовать</>}</button></form> : null}{loading ? <div className="events-state"><LoaderCircle className="spin" size={24} /> Загружаем события...</div> : items.length ? <div className="event-list">{items.map((item) => { const full = item.capacity !== null && item.attendeeCount >= item.capacity; return <article key={item.id} className={item.attending ? "attending" : ""}><div className="event-date"><strong>{new Date(item.startsAt).getDate()}</strong><span>{new Date(item.startsAt).toLocaleDateString("ru-RU", { month: "short" }).replace(".", "")}</span></div><div className="event-copy"><h3>{item.title}</h3>{item.description ? <p>{item.description}</p> : null}<div><span><Clock3 size={13} /> {dateTime(item.startsAt)}{item.endsAt ? ` — ${new Date(item.endsAt).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}` : ""}</span>{item.location ? <span><MapPin size={13} /> {item.location}</span> : null}<span><Users size={13} /> {item.attendeeCount}{item.capacity ? ` / ${item.capacity}` : ""}</span></div></div><div className="event-actions"><button className={item.attending ? "joined" : ""} onClick={() => toggle(item)} disabled={workingId === item.id || (full && !item.attending)}>{workingId === item.id ? <LoaderCircle className="spin" size={15} /> : item.attending ? <><Check size={15} /> Вы идёте</> : full ? "Мест нет" : "Участвовать"}</button>{isOwner ? <button className="event-delete" onClick={() => remove(item.id)} aria-label="Удалить событие"><Trash2 size={15} /></button> : null}</div></article>; })}</div> : <div className="events-state"><CalendarDays size={31} /><strong>Ближайших событий нет</strong><span>{isOwner ? "Создайте первую встречу для участников." : "Новые встречи появятся здесь."}</span></div>}</section></div>;
}
