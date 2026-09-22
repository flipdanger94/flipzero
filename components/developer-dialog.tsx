"use client";

import { type FormEvent, useEffect, useState } from "react";
import { Bot, Check, Code2, Copy, KeyRound, LoaderCircle, Plus, ShieldCheck, Trash2, X } from "lucide-react";
import { DeveloperIntegrations } from "@/components/developer-integrations";

type Token = { id: string; appId: string; name: string; prefix: string; scopes: string[]; lastUsedAt: string | null; revokedAt: string | null; createdAt: string };
type DeveloperApp = { id: string; name: string; description: string | null; createdAt: string; tokens: Token[] };

export function DeveloperDialog({ onClose }: { onClose: () => void }) {
  const [apps, setApps] = useState<DeveloperApp[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [secret, setSecret] = useState("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { fetch("/api/v1/developer/apps").then(async (response) => ({ response, data: await response.json() })).then(({ response, data }) => { if (!response.ok) throw new Error(data.message); const loaded = data.apps ?? []; setApps(loaded); setSelectedId(loaded[0]?.id ?? null); }).catch((reason) => setError(reason.message ?? "Не удалось загрузить приложения.")).finally(() => setLoading(false)); }, []);
  const selected = apps.find((app) => app.id === selectedId) ?? null;

  async function createApp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setWorking(true); setError("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/v1/developer/apps", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: form.get("name"), description: form.get("description") }) });
    const data = await response.json().catch(() => null); setWorking(false);
    if (!response.ok) return setError(data?.message ?? "Не удалось создать приложение.");
    setApps((current) => [data.app, ...current]); setSelectedId(data.app.id); setCreating(false);
  }

  async function createToken() {
    if (!selected) return;
    setWorking(true); setError(""); setSecret("");
    const response = await fetch("/api/v1/developer/apps", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "create_token", appId: selected.id, name: "Основной ключ" }) });
    const data = await response.json().catch(() => null); setWorking(false);
    if (!response.ok) return setError(data?.message ?? "Не удалось создать ключ.");
    setApps((current) => current.map((app) => app.id === selected.id ? { ...app, tokens: [data.token, ...app.tokens] } : app)); setSecret(data.secret);
  }

  async function revoke(tokenId: string) {
    if (!window.confirm("Отозвать этот API-ключ? Вернуть его будет невозможно.")) return;
    setWorking(true); setError("");
    const response = await fetch(`/api/v1/developer/apps?tokenId=${encodeURIComponent(tokenId)}`, { method: "DELETE" });
    const data = await response.json().catch(() => null); setWorking(false);
    if (!response.ok) return setError(data?.message ?? "Не удалось отозвать ключ.");
    setApps((current) => current.map((app) => ({ ...app, tokens: app.tokens.map((token) => token.id === tokenId ? { ...token, revokedAt: new Date().toISOString() } : token) })));
  }

  async function removeApp() {
    if (!selected || !window.confirm(`Удалить приложение «${selected.name}» и все его ключи?`)) return;
    setWorking(true); setError("");
    const response = await fetch(`/api/v1/developer/apps?appId=${encodeURIComponent(selected.id)}`, { method: "DELETE" });
    const data = await response.json().catch(() => null); setWorking(false);
    if (!response.ok) return setError(data?.message ?? "Не удалось удалить приложение.");
    setApps((current) => { const next = current.filter((app) => app.id !== selected.id); setSelectedId(next[0]?.id ?? null); return next; }); setSecret("");
  }

  async function copySecret() {
    await navigator.clipboard.writeText(secret); setCopied(true); window.setTimeout(() => setCopied(false), 1600);
  }

  return <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="space-dialog developer-dialog" role="dialog" aria-modal="true" aria-labelledby="developer-title"><button className="dialog-close" onClick={onClose} aria-label="Закрыть"><X size={19} /></button><header className="developer-heading"><span className="dialog-symbol"><Code2 size={22} /></span><div><h2 id="developer-title">Платформа разработчиков</h2><p>API-ключи, приложения ботов и интеграции.</p></div><button onClick={() => setCreating((value) => !value)}><Plus size={16} /> Приложение</button></header>{error ? <div className="auth-error" role="alert">{error}</div> : null}{creating ? <form className="developer-create" onSubmit={createApp}><input name="name" minLength={2} maxLength={60} placeholder="Название приложения" autoFocus required /><input name="description" maxLength={240} placeholder="Что будет делать интеграция" /><button className="auth-submit" disabled={working}>{working ? <LoaderCircle className="spin" size={16} /> : "Создать"}</button></form> : null}{loading ? <div className="developer-state"><LoaderCircle className="spin" size={25} /> Загружаем приложения...</div> : <div className="developer-layout"><aside>{apps.map((app) => <button key={app.id} className={app.id === selectedId ? "active" : ""} onClick={() => { setSelectedId(app.id); setSecret(""); }}><Bot size={17} /><span><strong>{app.name}</strong><small>{app.tokens.filter((token) => !token.revokedAt).length} активных ключей</small></span></button>)}{!apps.length ? <div><Bot size={27} /><span>Создайте первое приложение</span></div> : null}</aside><main>{selected ? <><div className="developer-app-head"><div><small>ПРИЛОЖЕНИЕ БОТА</small><h3>{selected.name}</h3><p>{selected.description || "Описание не указано"}</p></div><button onClick={removeApp} title="Удалить приложение"><Trash2 size={16} /></button></div>{secret ? <section className="secret-reveal"><ShieldCheck size={20} /><div><strong>Скопируйте ключ сейчас</strong><span>После закрытия он больше не будет показан.</span><code>{secret}</code></div><button onClick={copySecret}>{copied ? <Check size={16} /> : <Copy size={16} />}</button></section> : null}<div className="token-title"><div><h4>API-ключи</h4><span>Передавайте ключ как Bearer token только с сервера.</span></div><button onClick={createToken} disabled={working}><KeyRound size={15} /> Создать ключ</button></div><div className="token-list">{selected.tokens.map((token) => <article key={token.id} className={token.revokedAt ? "revoked" : ""}><KeyRound size={16} /><div><strong>{token.name}</strong><code>{token.prefix}</code><span>{token.scopes.join(" · ")} · {token.lastUsedAt ? `использован ${new Date(token.lastUsedAt).toLocaleDateString("ru-RU")}` : "ещё не использован"}</span></div>{token.revokedAt ? <b>ОТОЗВАН</b> : <button onClick={() => revoke(token.id)} title="Отозвать ключ"><Trash2 size={15} /></button>}</article>)}{!selected.tokens.length ? <div className="developer-empty">Создайте ключ для доступа к API.</div> : null}</div><DeveloperIntegrations appId={selected.id} /><section className="api-example"><small>БЫСТРЫЙ СТАРТ</small><code>curl https://flipzeroapp.vercel.app/api/public/v1/me \<br />&nbsp;&nbsp;-H &quot;Authorization: Bearer $FLIPZERO_API_TOKEN&quot;</code><span>SDK находится в каталоге <b>sdk/flipzero.ts</b>.</span></section></> : <div className="developer-state"><Bot size={34} /><strong>Приложений пока нет</strong><span>Создайте приложение для первой интеграции.</span></div>}</main></div>}</section></div>;
}
