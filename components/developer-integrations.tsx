"use client";

import { type FormEvent, useEffect, useState } from "react";
import { Check, Copy, LoaderCircle, Plus, RefreshCw, Save, ShieldCheck, Trash2, Webhook } from "lucide-react";

type OAuthConfig = { appId: string; clientId: string; secretPrefix: string; redirectUris: string[]; scopes: string[]; updatedAt: string };
type WebhookItem = { id: string; name: string; url: string; eventTypes: string[]; secretPrefix: string; enabled: boolean; updatedAt: string };
type SecretNotice = { title: string; value: string } | null;

const oauthScopes = ["identify", "profile:read", "spaces:read"];
const webhookEvents = ["message.created", "member.joined", "member.left", "space.updated"];

async function json(response: Response) { return response.json().catch(() => null); }

export function DeveloperIntegrations({ appId }: { appId: string }) {
  const [tab, setTab] = useState<"oauth" | "webhooks">("oauth");
  const [oauth, setOauth] = useState<OAuthConfig | null>(null);
  const [redirectUris, setRedirectUris] = useState("");
  const [selectedScopes, setSelectedScopes] = useState<string[]>(["identify"]);
  const [webhooks, setWebhooks] = useState<WebhookItem[]>([]);
  const [events, setEvents] = useState<string[]>(["message.created"]);
  const [secret, setSecret] = useState<SecretNotice>(null);
  const [copied, setCopied] = useState(false);
  const [authorizeCopied, setAuthorizeCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError(""); setSecret(null);
    Promise.all([
      fetch(`/api/v1/developer/oauth?appId=${encodeURIComponent(appId)}`, { cache: "no-store" }).then(async (response) => ({ response, data: await json(response) })),
      fetch(`/api/v1/developer/webhooks?appId=${encodeURIComponent(appId)}`, { cache: "no-store" }).then(async (response) => ({ response, data: await json(response) })),
    ]).then(([oauthResult, webhookResult]) => {
      if (!oauthResult.response.ok) throw new Error(oauthResult.data?.message ?? "Не удалось загрузить OAuth.");
      if (!webhookResult.response.ok) throw new Error(webhookResult.data?.message ?? "Не удалось загрузить webhooks.");
      if (cancelled) return;
      const config = oauthResult.data?.oauth as OAuthConfig | null;
      setOauth(config); setRedirectUris(config?.redirectUris.join("\n") ?? ""); setSelectedScopes(config?.scopes?.length ? config.scopes : ["identify"]);
      setWebhooks((webhookResult.data?.webhooks ?? []) as WebhookItem[]);
    }).catch((reason) => { if (!cancelled) setError(reason instanceof Error ? reason.message : "Не удалось загрузить интеграции."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [appId]);

  function toggle(value: string, current: string[], setter: (value: string[]) => void) {
    setter(current.includes(value) ? current.filter((item) => item !== value) : [...current, value]);
  }

  async function saveOAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setWorking(true); setError(""); setSecret(null);
    const response = await fetch("/api/v1/developer/oauth", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ appId, redirectUris: redirectUris.split(/\r?\n/).map((item) => item.trim()).filter(Boolean), scopes: selectedScopes }) });
    const data = await json(response); setWorking(false);
    if (!response.ok) return setError(data?.message ?? "Не удалось сохранить OAuth.");
    setOauth(data.oauth as OAuthConfig); if (data.secret) setSecret({ title: "OAuth client secret", value: data.secret });
  }

  async function regenerateOAuth() {
    if (!oauth || !window.confirm("Старый OAuth secret перестанет работать. Продолжить?")) return;
    setWorking(true); setError(""); setSecret(null);
    const response = await fetch("/api/v1/developer/oauth", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ appId, action: "regenerate_secret" }) });
    const data = await json(response); setWorking(false);
    if (!response.ok) return setError(data?.message ?? "Не удалось обновить secret.");
    setOauth(data.oauth as OAuthConfig); setSecret({ title: "Новый OAuth client secret", value: data.secret });
  }

  async function createWebhook(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setWorking(true); setError(""); setSecret(null);
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/v1/developer/webhooks", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ appId, name: form.get("name"), url: form.get("url"), eventTypes: events }) });
    const data = await json(response); setWorking(false);
    if (!response.ok) return setError(data?.message ?? "Не удалось создать webhook.");
    setWebhooks((current) => [data.webhook as WebhookItem, ...current]); setSecret({ title: "Webhook signing secret", value: data.secret }); event.currentTarget.reset();
  }

  async function mutateWebhook(webhook: WebhookItem, action: "toggle" | "regenerate" | "delete") {
    setWorking(true); setError(""); if (action === "regenerate") setSecret(null);
    let response: Response;
    if (action === "delete") response = await fetch(`/api/v1/developer/webhooks?appId=${encodeURIComponent(appId)}&webhookId=${encodeURIComponent(webhook.id)}`, { method: "DELETE" });
    else if (action === "regenerate") response = await fetch("/api/v1/developer/webhooks", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ appId, webhookId: webhook.id, action: "regenerate_secret" }) });
    else response = await fetch("/api/v1/developer/webhooks", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ appId, webhookId: webhook.id, enabled: !webhook.enabled }) });
    const data = await json(response); setWorking(false);
    if (!response.ok) return setError(data?.message ?? "Не удалось изменить webhook.");
    if (action === "delete") setWebhooks((current) => current.filter((item) => item.id !== webhook.id));
    else if (action === "regenerate") { setWebhooks((current) => current.map((item) => item.id === webhook.id ? { ...item, secretPrefix: data.webhook.secretPrefix, updatedAt: data.webhook.updatedAt } : item)); setSecret({ title: `Новый secret — ${webhook.name}`, value: data.secret }); }
    else setWebhooks((current) => current.map((item) => item.id === webhook.id ? data.webhook as WebhookItem : item));
  }

  async function copySecret() { if (!secret) return; await navigator.clipboard.writeText(secret.value); setCopied(true); window.setTimeout(() => setCopied(false), 1500); }

  const authorizePath = oauth?.redirectUris[0] ? `/oauth/authorize?client_id=${encodeURIComponent(oauth.clientId)}&redirect_uri=${encodeURIComponent(oauth.redirectUris[0])}&response_type=code&scope=${encodeURIComponent(oauth.scopes.join(" "))}` : "";

  async function copyAuthorizeUrl() {
    if (!authorizePath) return;
    await navigator.clipboard.writeText(`${window.location.origin}${authorizePath}`);
    setAuthorizeCopied(true);
    window.setTimeout(() => setAuthorizeCopied(false), 1500);
  }

  if (loading) return <div className="developer-inline-loading"><LoaderCircle className="spin" size={18} /> Загружаем OAuth и Webhooks…</div>;

  return <section className="developer-integrations">
    <div className="developer-tabs"><button className={tab === "oauth" ? "active" : ""} onClick={() => setTab("oauth")}><ShieldCheck size={14} /> OAuth</button><button className={tab === "webhooks" ? "active" : ""} onClick={() => setTab("webhooks")}><Webhook size={14} /> Webhooks</button></div>
    {error ? <div className="auth-error" role="alert">{error}</div> : null}
    {secret ? <div className="secret-reveal"><ShieldCheck size={18} /><div><strong>{secret.title}</strong><span>Скопируйте сейчас: повторно secret не показывается.</span><code>{secret.value}</code></div><button onClick={copySecret}>{copied ? <Check size={15} /> : <Copy size={15} />}</button></div> : null}

    {tab === "oauth" ? <div className="developer-section"><div className="developer-section-head"><div><small>OAUTH CLIENT</small><h4>{oauth ? "OAuth настроен" : "Создать OAuth client"}</h4><p>Redirect URI проверяются на backend, полный secret хранится только в виде SHA-256 хеша.</p></div>{oauth ? <button className="secondary-action" onClick={regenerateOAuth} disabled={working}><RefreshCw size={14} /> Новый secret</button> : null}</div>{oauth ? <><div className="oauth-credentials"><label><span>Client ID</span><code>{oauth.clientId}</code></label><label><span>Secret prefix</span><code>{oauth.secretPrefix}</code></label></div>{authorizePath ? <div className="oauth-authorize-url"><code>{authorizePath}</code><button onClick={copyAuthorizeUrl} title="Копировать authorization URL">{authorizeCopied ? <Check size={14} /> : <Copy size={14} />}</button></div> : null}</> : null}<form className="oauth-form" onSubmit={saveOAuth}><label><span>Redirect URI — по одному на строку</span><textarea value={redirectUris} onChange={(event) => setRedirectUris(event.target.value)} rows={3} placeholder="https://example.com/oauth/callback" required /></label><div className="developer-choice-row wrap">{oauthScopes.map((scope) => <label key={scope}><input type="checkbox" checked={selectedScopes.includes(scope)} onChange={() => toggle(scope, selectedScopes, setSelectedScopes)} /><span>{scope}</span></label>)}</div><button className="primary-action" disabled={working || selectedScopes.length === 0}><Save size={14} /> {oauth ? "Сохранить" : "Создать client"}</button></form></div> : null}

    {tab === "webhooks" ? <div className="developer-section"><div className="developer-section-head"><div><small>WEBHOOK ENDPOINTS</small><h4>Подписки на события</h4><p>Разрешены только HTTPS endpoint. Signing secret выдаётся один раз при создании или регенерации.</p></div></div><form className="webhook-create" onSubmit={createWebhook}><div className="webhook-inputs"><input name="name" minLength={2} maxLength={60} placeholder="Production webhook" required /><input name="url" type="url" placeholder="https://api.example.com/flipzero" required /></div><div className="developer-choice-row wrap">{webhookEvents.map((eventName) => <label key={eventName}><input type="checkbox" checked={events.includes(eventName)} onChange={() => toggle(eventName, events, setEvents)} /><span>{eventName}</span></label>)}</div><button className="primary-action" disabled={working || events.length === 0}><Plus size={14} /> Создать webhook</button></form><div className="webhook-list">{webhooks.map((webhook) => <article key={webhook.id} className={webhook.enabled ? "" : "disabled"}><Webhook size={16} /><div><strong>{webhook.name}</strong><code>{webhook.url}</code><span>{webhook.eventTypes.join(" · ")} · {webhook.secretPrefix}</span></div><div className="webhook-actions"><button onClick={() => mutateWebhook(webhook, "toggle")}>{webhook.enabled ? "On" : "Off"}</button><button onClick={() => mutateWebhook(webhook, "regenerate")}><RefreshCw size={13} /></button><button onClick={() => mutateWebhook(webhook, "delete")}><Trash2 size={13} /></button></div></article>)}{!webhooks.length ? <div className="developer-empty">Webhooks пока не созданы.</div> : null}</div></div> : null}
  </section>;
}
