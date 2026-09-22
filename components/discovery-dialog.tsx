"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Check, Compass, Gamepad2, GraduationCap, Headphones, LayoutGrid, LoaderCircle, Search, ShieldCheck, Sparkles, Users, X } from "lucide-react";
import { MediaImage } from "./media-image";

type Community = { id: string; name: string; slug: string; description: string | null; iconUrl: string | null; bannerUrl: string | null; accentColor: string; visibility: "public" | "application"; memberCount: number; joined: boolean; joinRequestStatus: string | null };
type Category = "all" | "gaming" | "music" | "education" | "technology";

const categories: Array<{ id: Category; label: string; icon: React.ReactNode }> = [
  { id: "all", label: "Все серверы", icon: <LayoutGrid size={18} /> },
  { id: "gaming", label: "Игры", icon: <Gamepad2 size={18} /> },
  { id: "music", label: "Музыка", icon: <Headphones size={18} /> },
  { id: "education", label: "Образование", icon: <GraduationCap size={18} /> },
  { id: "technology", label: "Технологии", icon: <Sparkles size={18} /> },
];

function matchesCategory(item: Community, category: Category) {
  if (category === "all") return true;
  const text = `${item.name} ${item.description ?? ""}`.toLocaleLowerCase("ru");
  const words: Record<Exclude<Category, "all">, string[]> = {
    gaming: ["игр", "gaming", "game", "киберспорт"],
    music: ["музык", "music", "аудио", "артист"],
    education: ["обуч", "образован", "курс", "учеб", "english"],
    technology: ["технолог", "разработ", "дизайн", "код", "ai", "ии", "startup"],
  };
  return words[category].some((word) => text.includes(word));
}

export function DiscoveryDialog({ onClose, onJoined }: { onClose: () => void; onJoined: (spaceId: string) => void | Promise<void> }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<Category>("all");
  const [items, setItems] = useState<Community[]>([]);
  const [loading, setLoading] = useState(true);
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading(true); setError("");
      fetch(`/api/v1/discovery?q=${encodeURIComponent(query.trim())}`, { signal: controller.signal }).then(async (response) => ({ response, data: await response.json() })).then(({ response, data }) => { if (!response.ok) throw new Error(data.message); setItems(data.spaces ?? []); }).catch((reason) => { if (reason.name !== "AbortError") setError(reason.message ?? "Не удалось загрузить каталог."); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    }, 250);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [query]);
  const visible = useMemo(() => items.filter((item) => matchesCategory(item, category)), [category, items]);
  const official = visible.find((item) => item.name.toLocaleLowerCase("ru") === "flipzero hq");
  const rest = visible.filter((item) => item.id !== official?.id);
  async function join(spaceId: string) {
    const item = items.find((entry) => entry.id === spaceId);
    if (!item) return;
    let message = "";
    if (item.visibility === "application") {
      const value = window.prompt("Коротко расскажите, почему хотите вступить (необязательно):", "");
      if (value === null) return;
      message = value;
    }
    setJoiningId(spaceId); setError("");
    const response = await fetch("/api/v1/discovery", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ spaceId, message }) });
    const data = await response.json().catch(() => null);
    if (!response.ok) { setError(data?.message ?? "Не удалось отправить запрос."); setJoiningId(null); return; }
    setItems((current) => current.map((entry) => entry.id === spaceId ? {
      ...entry,
      joined: Boolean(data.joined) || entry.joined,
      memberCount: entry.memberCount + (data.joined && !entry.joined ? 1 : 0),
      joinRequestStatus: data.requestStatus ?? entry.joinRequestStatus,
    } : entry));
    setJoiningId(null);
    if (data.joined) await onJoined(spaceId);
  }

  async function cancelApplication(spaceId: string) {
    setJoiningId(spaceId); setError("");
    const response = await fetch(`/api/v1/discovery?spaceId=${encodeURIComponent(spaceId)}`, { method: "DELETE" });
    const data = await response.json().catch(() => null);
    setJoiningId(null);
    if (!response.ok) { setError(data?.message ?? "Не удалось отменить заявку."); return; }
    setItems((current) => current.map((item) => item.id === spaceId ? { ...item, joinRequestStatus: null } : item));
  }
  const card = (item: Community, featured = false) => <article className={featured ? "discovery-card featured" : "discovery-card"} key={item.id}>
    <div className="discovery-card-banner" style={{ backgroundImage: item.bannerUrl ? `linear-gradient(180deg,transparent,rgba(8,10,14,.78)),url(${item.bannerUrl})` : `linear-gradient(135deg,${item.accentColor},#6f5cff 55%,#10131b)` }} />
    <span className="discovery-card-icon" style={{ background: `linear-gradient(135deg,${item.accentColor},#6f5cff)` }}>{item.iconUrl ? <MediaImage src={item.iconUrl} sizes="58px" /> : item.name.slice(0, 2).toLocaleUpperCase("ru")}</span>
    <div className="discovery-card-copy"><h3><Link href={`/communities/${encodeURIComponent(item.slug)}`}>{item.name}</Link>{featured ? <ShieldCheck size={16} aria-label="Официальный сервер" /> : null}</h3><p>{item.description || (item.visibility === "application" ? "Вступление после одобрения администрации" : "Открытое сообщество FlipZero")}</p><small><i /> {item.memberCount.toLocaleString("ru-RU")} участников{item.visibility === "application" ? " · по заявке" : ""}</small></div>
    <button className={item.joined || item.joinRequestStatus === "pending" ? "joined" : ""} onClick={() => item.joined ? onJoined(item.id) : item.joinRequestStatus === "pending" ? cancelApplication(item.id) : join(item.id)} disabled={joiningId === item.id}>{joiningId === item.id ? <LoaderCircle className="spin" size={16} /> : item.joined ? <><Check size={16} /> Открыть</> : item.joinRequestStatus === "pending" ? "Отменить заявку" : item.visibility === "application" ? "Подать заявку" : "Вступить"}</button>
  </article>;
  return <div className="dialog-backdrop discovery-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="discovery-dialog" role="dialog" aria-modal="true" aria-labelledby="discovery-title">
    <button className="discovery-close" onClick={onClose} aria-label="Закрыть"><X size={21} /></button>
    <aside className="discovery-nav"><div className="discovery-nav-brand"><Compass size={23} /><span><strong>Обзор</strong><small>Публичные серверы</small></span></div><nav>{categories.map((item) => <button key={item.id} className={category === item.id ? "active" : ""} onClick={() => setCategory(item.id)}>{item.icon}<span>{item.label}</span></button>)}</nav><p>Находите людей по интересам и присоединяйтесь к открытым сообществам.</p></aside>
    <main className="discovery-content"><header className="discovery-hero"><span>ОТКРЫВАЙ НОВЫЕ МИРЫ</span><h2 id="discovery-title">Сообщества<br/>для <b>твоих идей</b></h2><p>Игры, творчество, технологии, обучение и многое другое — найди своё комьюнити в FlipZero.</p><label className="discovery-search"><Search size={19} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Поиск серверов..." autoFocus /></label></header><div className="discovery-chips">{categories.map((item)=><button key={item.id} className={category===item.id?"active":""} onClick={()=>setCategory(item.id)}>{item.icon}{item.label}</button>)}</div>
      {error ? <div className="auth-error" role="alert">{error}</div> : null}
      {loading ? <div className="discovery-state"><LoaderCircle className="spin" size={28} /><strong>Открываем каталог...</strong></div> : visible.length ? <div className="discovery-results">{official ? <section className="discovery-official"><div className="discovery-section-title"><div><span>РЕКОМЕНДУЕМ НАЧАТЬ ОТСЮДА</span><h3>Официальный сервер</h3></div><ShieldCheck size={20} /></div>{card(official, true)}</section> : null}{rest.length ? <section><div className="discovery-section-title"><div><span>ПУБЛИЧНЫЕ СООБЩЕСТВА</span><h3>{category === "all" ? "Популярные серверы" : categories.find((item) => item.id === category)?.label}</h3></div><Users size={20} /></div><div className="discovery-grid">{rest.map((item) => card(item))}</div></section> : null}</div> : <div className="discovery-state"><Compass size={34} /><strong>Серверы не найдены</strong><span>Выберите другую категорию или измените запрос.</span><button onClick={() => { setCategory("all"); setQuery(""); }}>Показать все серверы</button></div>}
    </main>
  </section></div>;
}
