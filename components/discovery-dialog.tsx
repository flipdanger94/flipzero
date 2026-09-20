"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, Compass, LoaderCircle, Search, Users, X } from "lucide-react";
import { MediaImage } from "./media-image";

type Community = { id: string; name: string; slug: string; description: string | null; iconUrl: string | null; accentColor: string; memberCount: number; joined: boolean };

export function DiscoveryDialog({ onClose, onJoined }: { onClose: () => void; onJoined: (spaceId: string) => void | Promise<void> }) {
  const [query, setQuery] = useState("");
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
  async function join(spaceId: string) {
    setJoiningId(spaceId); setError("");
    const response = await fetch("/api/v1/discovery", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ spaceId }) });
    const data = await response.json().catch(() => null);
    if (!response.ok) { setError(data?.message ?? "Не удалось вступить в сообщество."); setJoiningId(null); return; }
    setItems((current) => current.map((item) => item.id === spaceId ? { ...item, joined: true, memberCount: item.memberCount + (data.joined ? 1 : 0) } : item));
    setJoiningId(null); await onJoined(spaceId);
  }
  return <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="space-dialog discovery-dialog" role="dialog" aria-modal="true" aria-labelledby="discovery-title"><button className="dialog-close" onClick={onClose} aria-label="Закрыть"><X size={19} /></button><div className="discovery-heading"><span className="dialog-symbol"><Compass size={22} /></span><div><h2 id="discovery-title">Откройте сообщество</h2><p>Найдите открытое пространство и присоединитесь в один клик.</p></div></div><label className="discovery-search"><Search size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Поиск по названию или описанию" autoFocus /></label>{error ? <div className="auth-error" role="alert">{error}</div> : null}{loading ? <div className="discovery-state"><LoaderCircle className="spin" size={25} /><strong>Ищем сообщества...</strong></div> : items.length ? <div className="discovery-grid">{items.map((item) => <article key={item.id}><div className="discovery-cover" style={{ background: `linear-gradient(135deg, ${item.accentColor}, #7136ad)` }}><span>{item.iconUrl ? <MediaImage src={item.iconUrl} /> : item.name.slice(0, 2).toLocaleUpperCase("ru")}</span></div><div className="discovery-copy"><h3><Link href={`/communities/${encodeURIComponent(item.slug)}`}>{item.name}</Link></h3><p>{item.description || "Открытое сообщество FlipZero"}</p><small><Users size={13} /> {item.memberCount.toLocaleString("ru-RU")} участников · @{item.slug}</small></div><button className={item.joined ? "joined" : ""} onClick={() => item.joined ? onJoined(item.id) : join(item.id)} disabled={joiningId === item.id}>{joiningId === item.id ? <LoaderCircle className="spin" size={16} /> : item.joined ? <><Check size={16} /> Открыть</> : "Вступить"}</button></article>)}</div> : <div className="discovery-state"><Compass size={30} /><strong>Сообщества не найдены</strong><span>Попробуйте другой запрос или загляните позже.</span></div>}</section></div>;
}
