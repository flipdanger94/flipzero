"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { Check, ExternalLink, LoaderCircle, ShieldCheck, X } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { BrandMark } from "@/components/brand-mark";

type Authorization = {
  appName: string;
  redirectUri: string;
  scopes: string[];
  state: string | null;
};

const scopeDescriptions: Record<string, string> = {
  identify: "Увидеть ваш ID, имя и username",
  "profile:read": "Читать базовую информацию профиля",
  "spaces:read": "Видеть список ваших сообществ",
};

function AuthorizeContent() {
  const searchParams = useSearchParams();
  const queryString = searchParams.toString();
  const [authorization, setAuthorization] = useState<Authorization | null>(null);
  const [user, setUser] = useState<{ displayName: string; username: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");

  const requestBody = useMemo(() => ({
    clientId: searchParams.get("client_id"),
    redirectUri: searchParams.get("redirect_uri"),
    responseType: searchParams.get("response_type") ?? "code",
    scope: searchParams.get("scope") ?? "identify",
    state: searchParams.get("state"),
    codeChallenge: searchParams.get("code_challenge"),
    codeChallengeMethod: searchParams.get("code_challenge_method"),
  }), [searchParams]);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/v1/developer/oauth/authorize?${queryString}`, { cache: "no-store" })
      .then(async (response) => ({ response, data: await response.json().catch(() => null) }))
      .then(({ response, data }) => {
        if (!response.ok) throw new Error(data?.message ?? "Не удалось проверить OAuth-запрос.");
        if (cancelled) return;
        setAuthorization(data.authorization);
        setUser(data.user);
      })
      .catch((reason) => { if (!cancelled) setError(reason instanceof Error ? reason.message : "Не удалось открыть запрос авторизации."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [queryString]);

  async function approve() {
    if (!authorization) return;
    setWorking(true); setError("");
    const response = await fetch("/api/v1/developer/oauth/authorize", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(requestBody),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) { setWorking(false); setError(data?.message ?? "Не удалось подтвердить доступ."); return; }
    window.location.assign(data.redirectUrl);
  }

  function deny() {
    if (!authorization) return;
    const redirect = new URL(authorization.redirectUri);
    redirect.searchParams.set("error", "access_denied");
    if (authorization.state) redirect.searchParams.set("state", authorization.state);
    window.location.assign(redirect.toString());
  }

  if (loading) return <main className="oauth-consent-page"><div className="oauth-consent-card oauth-loading"><LoaderCircle className="spin" size={28} /><span>Проверяем OAuth-запрос…</span></div></main>;
  if (!authorization || error) return <main className="oauth-consent-page"><div className="oauth-consent-card"><BrandMark /><h1>Запрос OAuth отклонён</h1><p className="oauth-error">{error || "Параметры авторизации недействительны."}</p><a href="/app">Вернуться в FlipZero</a></div></main>;

  let redirectHost = authorization.redirectUri;
  try { redirectHost = new URL(authorization.redirectUri).host; } catch {}

  return <main className="oauth-consent-page">
    <section className="oauth-consent-card">
      <div className="oauth-brand"><BrandMark /><span>FlipZero OAuth</span></div>
      <div className="oauth-app-icon"><ShieldCheck size={27} /></div>
      <p className="oauth-kicker">СТОРОННЕЕ ПРИЛОЖЕНИЕ</p>
      <h1>{authorization.appName} запрашивает доступ</h1>
      <p className="oauth-user">Вы вошли как <strong>{user?.displayName}</strong> <span>@{user?.username}</span></p>

      <div className="oauth-permissions">
        <small>ПРИЛОЖЕНИЕ СМОЖЕТ</small>
        {authorization.scopes.map((scope) => <div key={scope}><Check size={15} /><span><strong>{scope}</strong><small>{scopeDescriptions[scope] ?? "Доступ к данным в рамках этого scope"}</small></span></div>)}
      </div>

      <div className="oauth-redirect"><ExternalLink size={14} /><span>После подтверждения вы вернётесь на <strong>{redirectHost}</strong></span></div>
      {error ? <div className="auth-error" role="alert">{error}</div> : null}

      <div className="oauth-actions">
        <button className="oauth-deny" onClick={deny} disabled={working}><X size={16} /> Отмена</button>
        <button className="oauth-approve" onClick={approve} disabled={working}>{working ? <LoaderCircle className="spin" size={16} /> : <ShieldCheck size={16} />} Разрешить</button>
      </div>
      <p className="oauth-footnote">Разрешайте доступ только приложениям, которым доверяете. Доступ ограничен перечисленными scopes.</p>
    </section>
  </main>;
}

export default function OAuthAuthorizePage() {
  return <Suspense fallback={<main className="oauth-consent-page"><div className="oauth-consent-card oauth-loading"><LoaderCircle className="spin" size={28} /></div></main>}><AuthorizeContent /></Suspense>;
}
