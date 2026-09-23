"use client";

import { Suspense, useEffect, useState } from "react";
import { Bot, Check, LoaderCircle, Server, ShieldCheck } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { BrandMark } from "@/components/brand-mark";

type InstallApp = { id: string; name: string; description: string | null };
type InstallSpace = { id: string; name: string; slug: string; accentColor: string; installed: boolean };

function InstallContent() {
  const searchParams = useSearchParams();
  const appId = searchParams.get("app_id") ?? "";
  const [app, setApp] = useState<InstallApp | null>(null);
  const [spaces, setSpaces] = useState<InstallSpace[]>([]);
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/v1/developer/install?appId=${encodeURIComponent(appId)}`, { cache: "no-store" })
      .then(async (response) => ({ response, data: await response.json().catch(() => null) }))
      .then(({ response, data }) => {
        if (!response.ok) throw new Error(data?.message ?? "Не удалось открыть установку.");
        if (cancelled) return;
        setApp(data.app);
        setSpaces(data.spaces ?? []);
      })
      .catch((reason) => { if (!cancelled) setError(reason instanceof Error ? reason.message : "Не удалось открыть установку."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [appId]);

  async function toggle(space: InstallSpace) {
    setWorkingId(space.id); setError("");
    const response = await fetch(space.installed
      ? `/api/v1/developer/install?appId=${encodeURIComponent(appId)}&spaceId=${encodeURIComponent(space.id)}`
      : "/api/v1/developer/install", space.installed
      ? { method: "DELETE" }
      : { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ appId, spaceId: space.id }) });
    const data = await response.json().catch(() => null);
    setWorkingId(null);
    if (!response.ok) return setError(data?.message ?? "Не удалось изменить установку.");
    setSpaces((current) => current.map((item) => item.id === space.id ? { ...item, installed: !space.installed } : item));
  }

  if (loading) return <main className="oauth-consent-page"><div className="oauth-consent-card oauth-loading"><LoaderCircle className="spin" size={28} /><span>Загружаем приложение…</span></div></main>;
  if (!app || error && !spaces.length) return <main className="oauth-consent-page"><div className="oauth-consent-card"><BrandMark /><h1>Установка недоступна</h1><p className="oauth-error">{error || "Приложение не найдено."}</p><a href="/app">Вернуться в FlipZero</a></div></main>;

  return <main className="oauth-consent-page">
    <section className="oauth-consent-card install-card">
      <div className="oauth-brand"><BrandMark /><span>FlipZero Apps</span></div>
      <div className="oauth-app-icon"><Bot size={28} /></div>
      <p className="oauth-kicker">УСТАНОВКА ПРИЛОЖЕНИЯ</p>
      <h1>{app.name}</h1>
      <p className="install-description">{app.description || "Приложение FlipZero запрашивает доступ к событиям выбранного пространства."}</p>

      <div className="install-permission"><ShieldCheck size={17} /><div><strong>events:read</strong><span>Приложение сможет получать выбранные webhook-события только из пространства, куда вы его установите.</span></div></div>
      {error ? <div className="auth-error" role="alert">{error}</div> : null}

      <div className="install-space-list">
        <small>ВАШИ ПРОСТРАНСТВА</small>
        {spaces.map((space) => <article key={space.id} className={space.installed ? "installed" : ""}>
          <span style={{ background: space.accentColor }}>{space.name.slice(0, 2).toLocaleUpperCase("ru")}</span>
          <div><strong>{space.name}</strong><small>{space.installed ? "Приложение установлено" : "Можно установить приложение"}</small></div>
          <button onClick={() => toggle(space)} disabled={workingId !== null}>{workingId === space.id ? <LoaderCircle className="spin" size={14} /> : space.installed ? <><Check size={14} /> Установлено</> : <><Server size={14} /> Установить</>}</button>
        </article>)}
        {!spaces.length ? <p className="developer-empty">У вас нет пространств, которыми вы владеете.</p> : null}
      </div>

      <a className="install-back" href="/app">Вернуться в FlipZero</a>
    </section>
  </main>;
}

export default function OAuthInstallPage() {
  return <Suspense fallback={<main className="oauth-consent-page"><div className="oauth-consent-card oauth-loading"><LoaderCircle className="spin" size={28} /></div></main>}><InstallContent /></Suspense>;
}
