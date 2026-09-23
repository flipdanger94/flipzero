"use client";

import { type FormEvent, useEffect, useState } from "react";
import { Bot, Check, Code2, Copy, KeyRound, LoaderCircle, Plus, ShieldCheck, Trash2, X } from "lucide-react";
import { DeveloperIntegrations } from "@/components/developer-integrations";
import { ConfirmDialog } from "@/components/action-dialogs";
import { useModalA11y } from "@/hooks/use-modal-a11y";

type Token = { id: string; appId: string; name: string; prefix: string; scopes: string[]; lastUsedAt: string | null; revokedAt: string | null; createdAt: string };
type DeveloperApp = { id: string; name: string; description: string | null; createdAt: string; tokens: Token[] };

export function DeveloperDialog({onClose, embedded = false }: { onClose: () => void; embedded?: boolean }) {
  const dialogRef = useModalA11y(onClose, !embedded);
  const [apps, setApps] = useState<DeveloperApp[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [secret, setSecret] = useState("");
  const [copied, setCopied] = useState(false);
  const [tokenScopes, setTokenScopes] = useState<string[]>(["profile:read", "spaces:read"]);
  const [error, setError] = useState("");
  const [pendingOperation, setPendingOperation] = useState<{ kind: "token" | "app"; id: string; name: string } | null>(null);

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
    const response = await fetch("/api/v1/developer/apps", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "create_token", appId: selected.id, name: "Основной ключ", scopes: tokenScopes }) });
    const data = await response.json().catch(() => null); setWorking(false);
    if (!response.ok) return setError(data?.message ?? "Не удалось создать ключ.");
    setApps((current) => current.map((app) => app.id === selected.id ? { ...app, tokens: [data.token, ...app.tokens] } : app)); setSecret(data.secret);
  }

  async function revoke(tokenId: string) {
    setWorking(true); setError("");
    const response = await fetch(`/api/v1/developer/apps?tokenId=${encodeURIComponent(tokenId)}`, { method: "DELETE" });
    const data = await response.json().catch(() => null); setWorking(false);
    if (!response.ok) return setError(data?.message ?? "Не удалось отозвать ключ.");
    setApps((current) => current.map((app) => ({ ...app, tokens: app.tokens.map((token) => token.id === tokenId ? { ...token, revokedAt: new Date().toISOString() } : token) })));
  }

  async function removeApp(appId: string) {
    setWorking(true); setError("");
    const response = await fetch(`/api/v1/developer/apps?appId=${encodeURIComponent(appId)}`, { method: "DELETE" });
    const data = await response.json().catch(() => null); setWorking(false);
    if (!response.ok) return setError(data?.message ?? "Не удалось удалить приложение.");
    const remaining = apps.filter((app) => app.id !== appId);
    setApps(remaining);
    setSelectedId((current) => current === appId ? remaining[0]?.id ?? null : current);
    setSecret("");
  }

  async function copySecret() {
    await navigator.clipboard.writeText(secret); setCopied(true); window.setTimeout(() => setCopied(false), 1600);
  }

  return <div className={embedded ? "developer-standalone" : "dialog-backdrop"} role="presentation" onMouseDown={(event) => { if (!embedded && event.target === event.currentTarget) onClose(); }}>{pendingOperation ? <ConfirmDialog title={pendingOperation.kind === "app" ? `Удалить приложение «${pendingOperation.name}»?` : `Отозвать ключ «${pendingOperation.name}»?`} description={pendingOperation.kind === "app" ? "Приложение, установки и все его ключи будут удалены. Это действие нельзя отменить." : "Ключ сразу перестанет работать. Это действие нельзя отменить."} confirmLabel={pendingOperation.kind === "app" ? "Удалить приложение" : "Отозвать ключ"} confirmationText={pendingOperation.kind === "app" ? pendingOperation.name : undefined} destructive onCancel={() => setPendingOperation(null)} onConfirm={() => { const operation = pendingOperation; setPendingOperation(null); if (operation.kind === "app") void removeApp(operation.id); else void revoke(operation.id); }} /> : null}<section ref={dialogRef} tabIndex={embedded ? undefined : -1} className="space-dialog developer-dialog" role={embedded ? undefined : "dialog"} aria-modal={embedded ? undefined : true} aria-labelledby="developer-title">{embedded ? null : <button className="dialog-close" onClick={onClose} aria-label="Закрыть"><X size={19} /></button>}<header className="developer-heading"><span className="dialog-symbol"><Code2 size={22} /></span><div><h2 id="developer-title">Платформа разработчиков</h2><p>API-ключи, приложения ботов и интеграции.</p></div><button onClick={() => setCreating((value) => !value)}><Plus size={16} /> Приложение</button></header>{error ? <div className="auth-error" role="alert">{error}</div> : null}{creating ? <form className="developer-create" onSubmit={createApp}><input name="name" minLength={2} maxLength={60} placeholder="Название приложения" autoFocus required /><input name="description" maxLength={240} placeholder="Что будет делать интеграция" /><button className="auth-submit" disabled={working}>{working ? <LoaderCircle className="spin" size={16} /> : "Создать"}</button></form> : null}{loading ? <div className="developer-state"><LoaderCircle className="spin" size={25} /> Загружаем приложения...</div> : <div className="developer-layout"><aside>{apps.map((app) => <button key={app.id} className={app.id === selectedId ? "active" : ""} onClick={() => { setSelectedId(app.id); setSecret(""); }}><Bot size={17} /><span><strong>{app.name}</strong><small>{app.tokens.filter((token) => !token.revokedAt).length} активных ключей</small></span></button>)}{!apps.length ? <div><Bot size={27} /><span>Создайте первое приложение</span></div> : null}</aside><main>{selected ? <><div className="developer-app-head"><div><small>ПРИЛОЖЕНИЕ БОТА</small><h3>{selected.name}</h3><p>{selected.description || "Описание не указано"}</p></div><button onClick={() => setPendingOperation({ kind: "app", id: selected.id, name: selected.name })} title="Удалить приложение"><Trash2 size={16} /></button></div>{secret ? <section className="secret-reveal"><ShieldCheck size={20} /><div><strong>Скопируйте ключ сейчас</strong><span>После закрытия он больше не будет показан.</span><code>{secret}</code></div><button onClick={copySecret}>{copied ? <Check size={16} /> : <Copy size={16} />}</button></section> : null}<div className="token-title"><div><h4>API-ключи</h4><span>Передавайте ключ как Bearer token только с сервера.</span></div><button onClick={createToken} disabled={working || tokenScopes.length === 0}><KeyRound size={15} /> Создать ключ</button></div><div className="token-scope-picker">{["profile:read","spaces:read"].map((scope) => <label key={scope}><input type="checkbox" checked={tokenScopes.includes(scope)} onChange={() => setTokenScopes((current) => current.includes(scope) ? current.filter((item) => item !== scope) : [...current, scope])} /><span>{scope}</span></label>)}</div><div className="token-list">{selected.tokens.map((token) => <article key={token.id} className={token.revokedAt ? "revoked" : ""}><KeyRound size={16} /><div><strong>{token.name}</strong><code>{token.prefix}</code><span>{token.scopes.join(" · ")} · {token.lastUsedAt ? `использован ${new Date(token.lastUsedAt).toLocaleDateString("ru-RU")}` : "ещё не использован"}</span></div>{token.revokedAt ? <b>ОТОЗВАН</b> : <button onClick={() => setPendingOperation({ kind: "token", id: token.id, name: token.name })} title="Отозвать ключ"><Trash2 size={15} /></button>}</article>)}{!selected.tokens.length ? <div className="developer-empty">Создайте ключ для доступа к API.</div> : null}</div><DeveloperIntegrations appId={selected.id} /><section className="api-example"><small>БЫСТРЫЙ СТАРТ</small><code>curl https://flipzeroapp.vercel.app/api/public/v1/me \<br />&nbsp;&nbsp;-H &quot;Authorization: Bearer $FLIPZERO_API_TOKEN&quot;</code><span><a href="/developers/docs">Документация API</a> · SDK: <b>sdk/flipzero.ts</b></span></section></> : <div className="developer-state"><Bot size={34} /><strong>Приложений пока нет</strong><span>Создайте приложение для первой интеграции.</span></div>}</main></div>}</section></div>;
}
